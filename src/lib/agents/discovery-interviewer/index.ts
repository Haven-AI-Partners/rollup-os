import { streamText, zodSchema } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/lib/db";
import { discoveryWorkflows, discoveryDependencies, discoverySessions, discoveryMessages } from "@/lib/db/schema";
import { eq, sql, and } from "drizzle-orm";
import { workflowExtractionSchema, dependencySchema, sentimentSchema, type WorkflowExtraction, type DependencyExtraction } from "./schema";
import { buildInterviewerPrompt } from "./prompt";
import { calculateAutomationScore, parseTimeToMinutes } from "@/lib/discovery/automation-score";

const MODEL_ID = "gemini-2.5-flash";

interface InterviewContext {
  sessionId: string;
  campaignId: string;
  employeeId: string;
  employeeName: string;
  companyName: string;
  campaignDescription?: string;
  agentName?: string;
}

async function handleSaveWorkflow(ctx: InterviewContext, workflow: WorkflowExtraction): Promise<string> {
  const timeMinutes = parseTimeToMinutes(workflow.timeSpentPerCycle);
  const score = calculateAutomationScore({
    ruleBasedNature: workflow.ruleBasedNature,
    standardizationLevel: workflow.standardizationLevel,
    timeSpentMinutes: timeMinutes,
    frequency: workflow.frequency,
    volume: workflow.volume,
    riskLevel: workflow.riskLevel,
    businessImpact: "medium",
  });

  await db.insert(discoveryWorkflows).values({
    sessionId: ctx.sessionId,
    campaignId: ctx.campaignId,
    employeeId: ctx.employeeId,
    title: workflow.title,
    shortDescription: workflow.shortDescription,
    frequency: workflow.frequency,
    volume: workflow.volume,
    timeSpentPerCycle: workflow.timeSpentPerCycle,
    timeSpentMinutes: timeMinutes,
    trigger: workflow.trigger,
    peopleInvolved: workflow.peopleInvolved,
    toolsInvolved: workflow.toolsInvolved,
    inputsRequired: workflow.inputsRequired,
    outputProduced: workflow.outputProduced,
    outputDestination: workflow.outputDestination,
    ruleBasedNature: workflow.ruleBasedNature,
    standardizationLevel: workflow.standardizationLevel,
    stepsRepetitive: workflow.stepsRepetitive,
    stepsRequiringJudgment: workflow.stepsRequiringJudgment,
    dataQualityRequirements: workflow.dataQualityRequirements,
    riskLevel: workflow.riskLevel,
    complianceSensitivity: workflow.complianceSensitivity,
    bottlenecks: workflow.bottlenecks,
    errorProneSteps: workflow.errorProneSteps,
    idealAutomationOutcome: workflow.idealAutomationOutcome,
    stepsMustStayHuman: workflow.stepsMustStayHuman,
    notes: workflow.notes ?? null,
    automationScore: String(score),
    isConfirmed: true,
  });

  // Update workflow count on session using SQL count
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(discoveryWorkflows)
    .where(eq(discoveryWorkflows.sessionId, ctx.sessionId));

  await db
    .update(discoverySessions)
    .set({
      workflowCount: count,
      lastActiveAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(discoverySessions.id, ctx.sessionId));

  return `ワークフロー「${workflow.title}」を保存しました（自動化スコア: ${score}/100）。次のワークフローに進んでください。`;
}

async function handleSaveDependency(ctx: InterviewContext, dep: DependencyExtraction): Promise<string> {
  const [sourceWorkflow] = await db
    .select({ id: discoveryWorkflows.id })
    .from(discoveryWorkflows)
    .where(and(
      eq(discoveryWorkflows.sessionId, ctx.sessionId),
      sql`lower(${discoveryWorkflows.title}) = lower(${dep.sourceWorkflowTitle})`,
    ))
    .limit(1);

  if (!sourceWorkflow) {
    return `ワークフロー「${dep.sourceWorkflowTitle}」が見つかりませんでした。`;
  }

  let dependsOnId: string | null = null;
  if (dep.dependencyType === "internal" && dep.targetWorkflowTitle) {
    const [target] = await db
      .select({ id: discoveryWorkflows.id })
      .from(discoveryWorkflows)
      .where(and(
        eq(discoveryWorkflows.sessionId, ctx.sessionId),
        sql`lower(${discoveryWorkflows.title}) = lower(${dep.targetWorkflowTitle})`,
      ))
      .limit(1);
    dependsOnId = target?.id ?? null;
  }

  await db.insert(discoveryDependencies).values({
    workflowId: sourceWorkflow.id,
    dependsOnWorkflowId: dependsOnId,
    dependencyType: dep.dependencyType,
    description: dep.description,
    externalSystem: dep.externalSystem ?? null,
  });

  return `依存関係を記録しました：${dep.description}`;
}

export async function runInterviewStream(
  ctx: InterviewContext,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
) {
  const systemPrompt = buildInterviewerPrompt({
    agentName: ctx.agentName ?? "太郎",
    employeeName: ctx.employeeName,
    companyName: ctx.companyName,
    campaignDescription: ctx.campaignDescription,
  });

  const result = streamText({
    model: google(MODEL_ID),
    system: systemPrompt,
    messages,
    tools: {
      save_workflow: {
        description: "従業員が確認したワークフローを保存します。確認を取ってから呼び出してください。",
        inputSchema: zodSchema(workflowExtractionSchema),
        execute: async (workflow: WorkflowExtraction) => handleSaveWorkflow(ctx, workflow),
      },
      save_dependency: {
        description: "ワークフロー間の依存関係を保存します。",
        inputSchema: zodSchema(dependencySchema),
        execute: async (dep: DependencyExtraction) => handleSaveDependency(ctx, dep),
      },
      update_sentiment: {
        description: "従業員のセンチメント（気持ち・エンゲージメント）を更新します。",
        inputSchema: zodSchema(sentimentSchema),
        execute: async (sentiment: { score: number; notes: string }) => {
          await db
            .update(discoverySessions)
            .set({
              sentimentScore: String(sentiment.score),
              sentimentNotes: sentiment.notes,
              lastActiveAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(discoverySessions.id, ctx.sessionId));
          return "センチメントを更新しました。";
        },
      },
    },
    temperature: 0.7,
  });

  return result;
}

/** Save a message to the transcript */
export async function saveMessage(
  sessionId: string,
  role: "assistant" | "user" | "system",
  content: string,
) {
  await db.insert(discoveryMessages).values({
    sessionId,
    role,
    content,
  });
}

/** Load all messages for a session */
export async function loadMessages(sessionId: string) {
  return db
    .select()
    .from(discoveryMessages)
    .where(eq(discoveryMessages.sessionId, sessionId))
    .orderBy(discoveryMessages.createdAt);
}
