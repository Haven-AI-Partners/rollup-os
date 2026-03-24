import { pgTable, uuid, text, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { deals } from "./deals";
import { users } from "./users";

export const orgChartVersions = pgTable("org_chart_versions", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id)
    .notNull(),
  version: integer("version").notNull(),
  label: text("label"),
  isActive: boolean("is_active").notNull().default(false),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const orgChartNodes = pgTable("org_chart_nodes", {
  id: uuid("id").primaryKey().defaultRandom(),
  versionId: uuid("version_id")
    .references(() => orgChartVersions.id, { onDelete: "cascade" })
    .notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Self-referential FK requires type assertion
  parentId: uuid("parent_id").references((): any => orgChartNodes.id),
  name: text("name").notNull(),
  title: text("title"),
  department: text("department"),
  role: text("role").$type<"executive" | "management" | "staff" | "board" | "advisor" | "contractor">(),
  position: integer("position").notNull().default(0),
});
