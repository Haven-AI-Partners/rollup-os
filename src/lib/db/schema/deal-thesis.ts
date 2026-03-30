import { pgTable, uuid, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { portcos } from "./portcos";

export const dealThesisNodes = pgTable("deal_thesis_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Self-referential FK requires type assertion
  parentId: uuid("parent_id").references((): any => dealThesisNodes.id),
  label: text("label").notNull(),
  description: text("description"),
  status: text("status").notNull().default("unknown").$type<
    "unknown" | "partial" | "complete" | "risk"
  >(),
  value: text("value"),
  source: text("source").$type<
    "im_extracted" | "manual" | "agent_generated" | "interview" | "dd_extracted"
  >(),
  sourceDetail: text("source_detail"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  templateNodeId: text("template_node_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_thesis_deal").on(table.dealId),
  index("idx_thesis_deal_parent").on(table.dealId, table.parentId),
]);
