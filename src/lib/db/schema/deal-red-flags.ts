import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { deals } from "./deals";
import { portcos } from "./portcos";

export const dealRedFlags = pgTable("deal_red_flags", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  flagId: text("flag_id").notNull(),
  severity: text("severity").notNull().$type<
    "critical" | "serious" | "moderate" | "info_gap"
  >(),
  category: text("category").notNull(),
  notes: text("notes"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  flaggedBy: uuid("flagged_by").references(() => users.id),
  resolvedBy: uuid("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_red_flags_deal").on(table.dealId),
  index("idx_red_flags_deal_resolved").on(table.dealId, table.resolved, table.severity),
]);
