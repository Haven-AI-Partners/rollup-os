import { pgTable, uuid, text, timestamp, boolean, jsonb, unique, integer, index } from "drizzle-orm/pg-core";
import { portcos } from "./portcos";
import { users } from "./users";
import { deals } from "./deals";

export const agentDefinitions = pgTable("agent_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  phase: text("phase").notNull().$type<
    "sourcing" | "evaluation" | "diligence" | "closing" | "pmi"
  >(),
  triggerTaskId: text("trigger_task_id").notNull(),
  inputSchema: jsonb("input_schema"),
  configSchema: jsonb("config_schema"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const portcoAgentConfigs = pgTable(
  "portco_agent_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    agentDefinitionId: uuid("agent_definition_id")
      .references(() => agentDefinitions.id)
      .notNull(),
    isEnabled: boolean("is_enabled").notNull().default(true),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.portcoId, table.agentDefinitionId)]
);

export const promptVersions = pgTable("prompt_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentSlug: text("agent_slug").notNull(),
  version: integer("version").notNull(),
  template: text("template").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  changeNote: text("change_note"),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_prompt_versions_created_by").on(table.createdBy),
]);

export const agentRuns = pgTable("agent_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentDefinitionId: uuid("agent_definition_id")
    .references(() => agentDefinitions.id)
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
  triggerJobId: text("trigger_job_id"),
  langfuseTraceId: text("langfuse_trace_id"),
  status: text("status").notNull().default("queued").$type<
    "queued" | "running" | "completed" | "failed"
  >(),
  input: jsonb("input"),
  output: jsonb("output"),
  error: text("error"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_agent_runs_deal").on(table.dealId),
]);
