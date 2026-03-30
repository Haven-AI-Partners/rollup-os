import { pgTable, uuid, text, timestamp, integer, jsonb, numeric, index } from "drizzle-orm/pg-core";
import { files } from "./files";
import { users } from "./users";

/** An eval run processes one file N times and compares results */
export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentSlug: text("agent_slug").notNull(),
  fileId: uuid("file_id")
    .references(() => files.id)
    .notNull(),
  fileName: text("file_name").notNull(),
  iterations: integer("iterations").notNull(),
  /** Prompt version used for this eval */
  promptVersionId: uuid("prompt_version_id"),
  promptVersionLabel: text("prompt_version_label"),
  /** Model used for this eval */
  modelId: text("model_id"),
  status: text("status").notNull().default("running").$type<
    "running" | "completed" | "failed"
  >(),
  /** Per-dimension score std dev */
  scoreVariance: jsonb("score_variance").$type<Record<string, number>>(),
  /** Overall score std dev */
  overallScoreStdDev: numeric("overall_score_std_dev"),
  /** Fraction of red flags that appear in all iterations (0-1) */
  flagAgreementRate: numeric("flag_agreement_rate"),
  /** Whether company name was identical across all iterations */
  nameConsistent: text("name_consistent"),
  error: text("error"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
},
(table) => [
  index("idx_eval_runs_created_by").on(table.createdBy),
]);

/** Individual iteration result within an eval run */
export const evalIterations = pgTable("eval_iterations", {
  id: uuid("id").primaryKey().defaultRandom(),
  evalRunId: uuid("eval_run_id")
    .references(() => evalRuns.id, { onDelete: "cascade" })
    .notNull(),
  iteration: integer("iteration").notNull(),
  companyName: text("company_name"),
  overallScore: numeric("overall_score"),
  scores: jsonb("scores").$type<Record<string, number>>(),
  redFlagIds: jsonb("red_flag_ids").$type<string[]>(),
  infoGapIds: jsonb("info_gap_ids").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
