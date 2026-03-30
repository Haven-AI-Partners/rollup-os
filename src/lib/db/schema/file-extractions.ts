import { pgTable, uuid, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { files } from "./files";

export const fileExtractions = pgTable("file_extractions", {
  id: uuid("id").primaryKey().defaultRandom(),
  fileId: uuid("file_id")
    .references(() => files.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  contentExtraction: jsonb("content_extraction").notNull(),
  translation: jsonb("translation"),
  extractionModel: text("extraction_model"),
  translationModel: text("translation_model"),
  pipelineVersion: text("pipeline_version").default("v2"),
  extractedAt: timestamp("extracted_at", { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
