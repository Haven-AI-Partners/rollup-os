import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { portcos } from "./portcos";

export const gdriveScanFolders = pgTable(
  "gdrive_scan_folders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    gdriveFolderId: text("gdrive_folder_id").notNull(),
    parentPath: text("parent_path").notNull().default(""),
    depth: integer("depth").notNull().default(0),
    lastScannedAt: timestamp("last_scanned_at", { withTimezone: true }),
    scanGeneration: integer("scan_generation").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("idx_gdrive_scan_folders_portco_folder").on(
      table.portcoId,
      table.gdriveFolderId,
    ),
    index("idx_gdrive_scan_folders_portco_scanned").on(
      table.portcoId,
      table.lastScannedAt,
    ),
  ],
);
