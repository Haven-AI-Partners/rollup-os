import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portcos } from "./portcos";

export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body"),
  referenceType: text("reference_type"),
  referenceId: uuid("reference_id"),
  read: boolean("read").notNull().default(false),
  slackSent: boolean("slack_sent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_notifications_user").on(table.userId),
]);
