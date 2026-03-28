import { pgTable, uuid, text, timestamp, numeric, integer, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { portcos } from "./portcos";
import { users } from "./users";
import { companyEmployees } from "./company-employees";

export const discoveryCampaigns = pgTable("discovery_campaigns", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  name: text("name").notNull(),
  description: text("description"),
  campaignType: text("campaign_type").notNull().$type<
    "workflow_discovery" | "sentiment_survey" | "custom"
  >(),
  status: text("status").notNull().default("draft").$type<
    "draft" | "active" | "paused" | "completed"
  >(),
  promptConfig: jsonb("prompt_config"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_discovery_campaigns_deal").on(table.dealId),
  index("idx_discovery_campaigns_portco").on(table.portcoId),
]);

export const discoverySessions = pgTable("discovery_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  campaignId: uuid("campaign_id")
    .references(() => discoveryCampaigns.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => companyEmployees.id)
    .notNull(),
  passwordHash: text("password_hash").notNull(),
  status: text("status").notNull().default("pending").$type<
    "pending" | "in_progress" | "paused" | "completed"
  >(),
  sentimentScore: numeric("sentiment_score"),
  sentimentNotes: text("sentiment_notes"),
  workflowCount: integer("workflow_count").notNull().default(0),
  feedbackRating: integer("feedback_rating"),
  feedbackTags: jsonb("feedback_tags").$type<string[]>(),
  feedbackComment: text("feedback_comment"),
  feedbackAt: timestamp("feedback_at", { withTimezone: true }),
  promptVersionId: uuid("prompt_version_id"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_discovery_sessions_campaign").on(table.campaignId),
  index("idx_discovery_sessions_employee").on(table.employeeId),
]);

export const discoveryMessages = pgTable("discovery_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => discoverySessions.id, { onDelete: "cascade" })
    .notNull(),
  role: text("role").notNull().$type<"assistant" | "user" | "system">(),
  content: text("content").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_discovery_messages_session").on(table.sessionId),
]);

export const discoveryWorkflows = pgTable("discovery_workflows", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => discoverySessions.id, { onDelete: "cascade" })
    .notNull(),
  campaignId: uuid("campaign_id")
    .references(() => discoveryCampaigns.id, { onDelete: "cascade" })
    .notNull(),
  employeeId: uuid("employee_id")
    .references(() => companyEmployees.id)
    .notNull(),
  title: text("title").notNull(),
  shortDescription: text("short_description"),
  frequency: text("frequency"),
  volume: text("volume"),
  timeSpentPerCycle: text("time_spent_per_cycle"),
  timeSpentMinutes: integer("time_spent_minutes"),
  trigger: text("trigger"),
  peopleInvolved: text("people_involved"),
  toolsInvolved: text("tools_involved"),
  inputsRequired: text("inputs_required"),
  outputProduced: text("output_produced"),
  outputDestination: text("output_destination"),
  ruleBasedNature: integer("rule_based_nature"),
  standardizationLevel: text("standardization_level"),
  stepsRepetitive: text("steps_repetitive"),
  stepsRequiringJudgment: text("steps_requiring_judgment"),
  dataQualityRequirements: text("data_quality_requirements"),
  riskLevel: text("risk_level"),
  complianceSensitivity: text("compliance_sensitivity"),
  bottlenecks: text("bottlenecks"),
  errorProneSteps: text("error_prone_steps"),
  idealAutomationOutcome: text("ideal_automation_outcome"),
  stepsMustStayHuman: text("steps_must_stay_human"),
  notes: text("notes"),
  automationScore: numeric("automation_score"),
  businessImpact: text("business_impact").default("medium"),
  isConfirmed: boolean("is_confirmed").notNull().default(false),
  overlapGroupId: uuid("overlap_group_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_discovery_workflows_campaign").on(table.campaignId),
  index("idx_discovery_workflows_session").on(table.sessionId),
  index("idx_discovery_workflows_employee").on(table.employeeId),
]);

export const discoveryDependencies = pgTable("discovery_dependencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  workflowId: uuid("workflow_id")
    .references(() => discoveryWorkflows.id, { onDelete: "cascade" })
    .notNull(),
  dependsOnWorkflowId: uuid("depends_on_workflow_id")
    .references(() => discoveryWorkflows.id, { onDelete: "set null" }),
  dependencyType: text("dependency_type").notNull().$type<"internal" | "external">(),
  description: text("description"),
  externalSystem: text("external_system"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_discovery_deps_workflow").on(table.workflowId),
]);
