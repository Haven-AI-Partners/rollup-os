import { pgTable, uuid, text, timestamp, numeric, jsonb, unique } from "drizzle-orm/pg-core";
import { users } from "./users";

export const portcos = pgTable("portcos", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").unique().notNull(),
  logoUrl: text("logo_url"),
  description: text("description"),
  industry: text("industry"),
  focusAreas: jsonb("focus_areas").$type<string[]>(),
  targetGeography: jsonb("target_geography").$type<string[]>(),
  investmentThesis: text("investment_thesis"),
  targetRevenueMin: numeric("target_revenue_min"),
  targetRevenueMax: numeric("target_revenue_max"),
  targetEbitdaMin: numeric("target_ebitda_min"),
  targetEbitdaMax: numeric("target_ebitda_max"),
  targetDealSizeMin: numeric("target_deal_size_min"),
  targetDealSizeMax: numeric("target_deal_size_max"),
  acquisitionCriteria: jsonb("acquisition_criteria"),
  scoringRubric: jsonb("scoring_rubric"),
  gdriveFolderId: text("gdrive_folder_id"),
  gdriveServiceAccountEnc: text("gdrive_service_account_enc"),
  slackWebhookUrl: text("slack_webhook_url"),
  slackChannelId: text("slack_channel_id"),
  allowedDomains: jsonb("allowed_domains").$type<{ domain: string; defaultRole: "owner" | "admin" | "analyst" | "viewer" }[]>(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const portcoMemberships = pgTable(
  "portco_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    role: text("role").notNull().$type<"owner" | "admin" | "analyst" | "viewer">(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique().on(table.userId, table.portcoId)]
);
