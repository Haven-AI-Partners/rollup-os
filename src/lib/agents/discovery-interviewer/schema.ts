import { z } from "zod";

/** Schema for a single extracted workflow — used as tool call parameter */
export const workflowExtractionSchema = z.object({
  title: z.string().describe("業務の名前 (Workflow title)"),
  shortDescription: z.string().describe("業務の概要 (Brief description of what this workflow does)"),
  frequency: z.enum(["daily", "weekly", "monthly", "quarterly", "annually", "ad_hoc"])
    .describe("この業務はどのくらいの頻度で行われるか (How often this workflow occurs)"),
  volume: z.enum(["high", "medium", "low"])
    .describe("1回あたりの処理件数 (Number of items processed each time - high: 100+, medium: 10-100, low: <10)"),
  timeSpentPerCycle: z.string()
    .describe("1回あたりにかかる時間 (Time spent per cycle, e.g. '30分', '2時間')"),
  trigger: z.string()
    .describe("業務のきっかけ (What initiates this workflow)"),
  peopleInvolved: z.string()
    .describe("関わる人や部署 (People or departments involved)"),
  toolsInvolved: z.string()
    .describe("使用するツール (Tools, software, or systems used)"),
  inputsRequired: z.string()
    .describe("必要な入力情報 (Data or materials needed to start)"),
  outputProduced: z.string()
    .describe("成果物 (What is produced or delivered)"),
  outputDestination: z.string()
    .describe("成果物の送り先 (Where the output goes - person, system, or process)"),
  ruleBasedNature: z.number().min(0).max(100)
    .describe("ルールベースの度合い (0-100, where 100 = fully rule-based with no judgment, 0 = entirely judgment-based)"),
  standardizationLevel: z.enum(["high", "medium", "low"])
    .describe("標準化の度合い (How standardized the process is - high: documented SOP, medium: informal but consistent, low: ad-hoc)"),
  stepsRepetitive: z.string()
    .describe("繰り返しの多いステップ (Steps that are repetitive and mechanical)"),
  stepsRequiringJudgment: z.string()
    .describe("判断が必要なステップ (Steps that require human judgment or expertise)"),
  dataQualityRequirements: z.string()
    .describe("データ品質の要件 (What data quality standards must be met)"),
  riskLevel: z.enum(["low", "medium", "high"])
    .describe("リスクレベル (Risk if automation fails - low: easily recoverable, high: financial/legal/safety impact)"),
  complianceSensitivity: z.enum(["public", "internal", "confidential"])
    .describe("機密レベル (Data sensitivity level)"),
  bottlenecks: z.string()
    .describe("ボトルネック (Where the process gets stuck or slowed down)"),
  errorProneSteps: z.string()
    .describe("エラーが起きやすいステップ (Steps where mistakes commonly occur)"),
  idealAutomationOutcome: z.string()
    .describe("理想的な自動化の結果 (What would the ideal automated version look like)"),
  stepsMustStayHuman: z.string()
    .describe("人間が行うべきステップ (Steps that MUST remain human-performed)"),
  notes: z.string().optional()
    .describe("補足事項 (Additional notes or context)"),
});

export type WorkflowExtraction = z.infer<typeof workflowExtractionSchema>;

/** Schema for a workflow dependency */
export const dependencySchema = z.object({
  sourceWorkflowTitle: z.string().describe("The workflow that depends on something"),
  dependencyType: z.enum(["internal", "external"]).describe("Internal = another workflow, External = outside system/actor"),
  targetWorkflowTitle: z.string().optional().describe("Title of the upstream workflow (internal deps only)"),
  description: z.string().describe("Description of the dependency relationship"),
  externalSystem: z.string().optional().describe("Name of external system or actor (external deps only)"),
});

export type DependencyExtraction = z.infer<typeof dependencySchema>;

/** Schema for sentiment update */
export const sentimentSchema = z.object({
  score: z.number().min(0).max(100).describe("Employee engagement/sentiment score based on conversation tone"),
  notes: z.string().describe("Brief observation about employee's sentiment"),
});
