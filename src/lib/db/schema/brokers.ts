import { pgTable, uuid, text, timestamp, numeric, integer, jsonb, unique } from "drizzle-orm/pg-core";
import { portcos } from "./portcos";
import { deals } from "./deals";

export const brokerFirms = pgTable("broker_firms", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  website: text("website"),
  listingUrl: text("listing_url"),
  scrapeConfig: jsonb("scrape_config"),
  region: text("region"),
  specialty: text("specialty"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brokerContacts = pgTable("broker_contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  brokerFirmId: uuid("broker_firm_id")
    .references(() => brokerFirms.id)
    .notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brokerInteractions = pgTable("broker_interactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  brokerContactId: uuid("broker_contact_id")
    .references(() => brokerContacts.id)
    .notNull(),
  dealId: uuid("deal_id").references(() => deals.id),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  type: text("type").notNull().$type<
    "email_sent" | "email_received" | "im_requested" | "call" | "meeting" | "form_submitted"
  >(),
  direction: text("direction").$type<"inbound" | "outbound">(),
  subject: text("subject"),
  body: text("body"),
  metadata: jsonb("metadata"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const brokerMetrics = pgTable(
  "broker_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    brokerFirmId: uuid("broker_firm_id")
      .references(() => brokerFirms.id)
      .notNull(),
    brokerContactId: uuid("broker_contact_id").references(() => brokerContacts.id),
    period: text("period").notNull(),
    avgResponseTimeH: numeric("avg_response_time_h"),
    dealsSent: integer("deals_sent"),
    dealsProgressed: integer("deals_progressed"),
    dealQualityScore: numeric("deal_quality_score"),
    imRequestToRecv: numeric("im_request_to_recv"),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull(),
  },
  (table) => [unique().on(table.brokerFirmId, table.brokerContactId, table.period)]
);
