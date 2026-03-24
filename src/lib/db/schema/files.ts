import { pgTable, uuid, text, timestamp, bigint, jsonb, index } from "drizzle-orm/pg-core";
import { users } from "./users";
import { portcos } from "./portcos";
import { deals } from "./deals";

export type FileType =
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
  | "other";

export const files = pgTable("files", {
  id: uuid("id").primaryKey().defaultRandom(),
  dealId: uuid("deal_id").references(() => deals.id),
  portcoId: uuid("portco_id")
    .references(() => portcos.id)
    .notNull(),
  uploadedBy: uuid("uploaded_by").references(() => users.id),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").$type<FileType>(),
  mimeType: text("mime_type"),
  gdriveFileId: text("gdrive_file_id"),
  gdriveFolderId: text("gdrive_folder_id"),
  gdriveParentPath: text("gdrive_parent_path"),
  gdriveUrl: text("gdrive_url"),
  sizeBytes: bigint("size_bytes", { mode: "number" }),
  classifiedBy: text("classified_by").$type<"auto" | "manual">(),
  classificationConfidence: text("classification_confidence"),
  processingStatus: text("processing_status")
    .notNull()
    .default("pending")
    .$type<"pending" | "processing" | "completed" | "failed">(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
},
(table) => [
  index("idx_files_gdrive").on(table.gdriveFileId),
  index("idx_files_portco_status").on(table.portcoId, table.processingStatus),
]);
