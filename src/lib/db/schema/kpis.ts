import { pgTable, uuid, text, timestamp, numeric, boolean, jsonb, index } from "drizzle-orm/pg-core";
import { portcos } from "./portcos";
import { deals } from "./deals";
import { agentRuns } from "./agents";

export const kpiDefinitions = pgTable("kpi_definitions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").unique().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  phase: text("phase").notNull().$type<
    "sourcing" | "evaluation" | "diligence" | "closing" | "pmi"
  >(),
  category: text("category").$type<
    "speed" | "quality" | "financial" | "operational" | "integration"
  >(),
  unit: text("unit").$type<"days" | "percent" | "currency" | "count" | "score">(),
  direction: text("direction").$type<"higher_is_better" | "lower_is_better">(),
  targetValue: numeric("target_value"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const kpiValues = pgTable(
  "kpi_values",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kpiDefinitionId: uuid("kpi_definition_id")
      .references(() => kpiDefinitions.id)
      .notNull(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    dealId: uuid("deal_id").references(() => deals.id, { onDelete: "cascade" }),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id),
    value: numeric("value").notNull(),
    targetValue: numeric("target_value"),
    period: text("period"),
    metadata: jsonb("metadata"),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_kpi_values_lookup").on(
      table.portcoId,
      table.kpiDefinitionId,
      table.dealId,
      table.period
    ),
    index("idx_kpi_values_deal").on(table.dealId),
    index("idx_kpi_values_agent_run").on(table.agentRunId),
  ]
);
