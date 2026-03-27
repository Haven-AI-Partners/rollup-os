import {
  pgTable,
  uuid,
  text,
  timestamp,
  bigint,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { portcos } from "./portcos";

export const gdriveFileCache = pgTable(
  "gdrive_file_cache",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    gdriveFileId: text("gdrive_file_id").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }),
    modifiedTime: timestamp("modified_time", { withTimezone: true }),
    webViewLink: text("web_view_link"),
    parentPath: text("parent_path").notNull().default(""),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_gdrive_cache_portco_file").on(
      table.portcoId,
      table.gdriveFileId,
    ),
    index("idx_gdrive_cache_portco_mime").on(table.portcoId, table.mimeType),
    index("idx_gdrive_cache_portco_seen").on(table.portcoId, table.lastSeenAt),
  ],
);
