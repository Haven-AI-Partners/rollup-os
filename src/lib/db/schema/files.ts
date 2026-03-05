import { pgTable, uuid, text, timestamp, bigint, jsonb } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portcos } from "./portcos";
import { deals } from "./deals";

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id")
    .references(() => deals.id)
    .notNull(),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<
    | "im_pdf"
    | "report"
    | "attachment"
    | "nda"
    | "dd_financial"
    | "dd_legal"
    | "dd_operational"
    | "dd_tax"
    | "dd_hr"
    | "dd_it"
    | "loi"
    | "purchase_agreement"
    | "pmi_plan"
    | "pmi_report"
    | "other"
  >(),
  mimeType: text("mime_type"),
  gdriveFileId: text("gdrive_file_id"),
  gdriveFolderId: text("gdrive_folder_id"),
  gdriveUrl: text("gdrive_url"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  processingStatus: text("processing_status")
    .notNull()
    .default("pending")
    .$type<"pending" | "processing" | "completed" | "failed">(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
