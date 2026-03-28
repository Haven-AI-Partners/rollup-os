import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { portcos } from "./portcos";

export const companyEmployees = pgTable("company_employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  name: text("name").notNull(),
  email: text("email"),
  department: text("department"),
  jobTitle: text("job_title"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_company_employees_deal").on(table.dealId),
  index("idx_company_employees_portco").on(table.portcoId),
]);
