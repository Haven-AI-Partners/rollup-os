import { pgTable, uuid, text, timestamp, integer, date, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portcos } from "./portcos";
import { deals } from "./deals";

export const dealTasks = pgTable("deal_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category").notNull().$type<
    | "sourcing"
    | "evaluation"
    | "dd_financial"
    | "dd_legal"
    | "dd_operational"
    | "dd_tax"
    | "dd_hr"
    | "dd_it"
    | "closing"
    | "pmi_integration"
    | "pmi_reporting"
    | "other"
  >(),
  status: text("status").notNull().default("todo").$type<
    "todo" | "in_progress" | "blocked" | "completed"
  >(),
  priority: text("priority").notNull().default("medium").$type<
    "low" | "medium" | "high" | "critical"
  >(),
  assignedTo: uuid("assigned_to").references(() => users.id),
  dueDate: date("due_date"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Self-referential FK requires type assertion
  parentTaskId: uuid("parent_task_id").references((): any => dealTasks.id),
  position: integer("position").notNull().default(0),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_tasks_deal").on(table.dealId),
  index("idx_tasks_deal_status").on(table.dealId, table.status),
  index("idx_tasks_assigned_to").on(table.assignedTo),
  index("idx_tasks_parent").on(table.parentTaskId),
]);

export const dealActivityLog = pgTable("deal_activity_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id, { onDelete: "cascade" })
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  action: text("action").notNull(),
  description: text("description"),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  changes: jsonb("changes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_activity_deal").on(table.dealId),
  index("idx_activity_deal_ts").on(table.dealId, table.createdAt),
  index("idx_activity_user").on(table.userId),
]);
