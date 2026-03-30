import { pgTable, uuid, text, timestamp, numeric, integer, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portcos } from "./portcos";
import { brokerFirms, brokerContacts } from "./brokers";

export const pipelineStages = pgTable("pipeline_stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  name: text("name").notNull(),
  phase: text("phase").notNull().$type<
    "sourcing" | "evaluation" | "diligence" | "closing" | "pmi"
  >(),
  position: integer("position").notNull(),
  color: text("color"),
});

export const deals = pgTable("deals", {
  id: uuid("id").primaryKey().defaultRandom(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  stageId: uuid("stage_id")
    .references(() => pipelineStages.id)
    .notNull(),
  companyName: text("company_name").notNull(),
  description: text("description"),
  source: text("source").$type<"agent_scraped" | "manual" | "broker_referral">(),
  sourceUrl: text("source_url"),
  askingPrice: numeric("asking_price"),
  revenue: numeric("revenue"),
  ebitda: numeric("ebitda"),
  currency: text("currency").default("JPY"),
  location: text("location"),
  industry: text("industry"),
  employeeCount: integer("employee_count"),
  fullTimeCount: integer("full_time_count"),
  contractorCount: integer("contractor_count"),
  status: text("status").notNull().default("active").$type<
    "active" | "passed" | "closed_won" | "closed_lost"
  >(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Circular FK with brokers.ts
  brokerFirmId: uuid("broker_firm_id").references((): any => brokerFirms.id),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Circular FK with brokers.ts
  brokerContactId: uuid("broker_contact_id").references((): any => brokerContacts.id),
  kanbanPosition: integer("kanban_position").notNull().default(0),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_deals_portco_status").on(table.portcoId, table.status),
  index("idx_deals_portco_stage").on(table.portcoId, table.stageId),
  index("idx_deals_assigned_to").on(table.assignedTo),
  index("idx_deals_broker_firm").on(table.brokerFirmId),
  index("idx_deals_broker_contact").on(table.brokerContactId),
]);

export const dealTransfers = pgTable("deal_transfers", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  fromPortcoId: uuid("from_portco_id")
    .references(() => portcos.id)
    .notNull(),
  toPortcoId: uuid("to_portco_id")
    .references(() => portcos.id)
    .notNull(),
  transferredBy: uuid("transferred_by")
    .references(() => users.id)
    .notNull(),
  reason: text("reason"),
  transferredAt: timestamp("transferred_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dealComments = pgTable("deal_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const dealFinancials = pgTable("deal_financials", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  period: text("period").notNull(),
  periodType: text("period_type").notNull().$type<
    "monthly" | "quarterly" | "annual" | "snapshot"
  >(),
  revenue: numeric("revenue"),
  ebitda: numeric("ebitda"),
  netIncome: numeric("net_income"),
  grossMarginPct: numeric("gross_margin_pct"),
  ebitdaMarginPct: numeric("ebitda_margin_pct"),
  cashFlow: numeric("cash_flow"),
  customerCount: integer("customer_count"),
  employeeCount: integer("employee_count"),
  fullTimeCount: integer("full_time_count"),
  contractorCount: integer("contractor_count"),
  arr: numeric("arr"),
  purchasePrice: numeric("purchase_price"),
  purchaseMultiple: numeric("purchase_multiple"),
  source: text("source").$type<"im_extracted" | "manual" | "agent_computed" | "integration">(),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
