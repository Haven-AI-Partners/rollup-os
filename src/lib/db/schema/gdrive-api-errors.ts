import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { portcos } from "./portcos";

export const gdriveApiErrors = pgTable(
  "gdrive_api_errors",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    httpStatus: integer("http_status").notNull(),
    context: text("context").notNull(),
    attempt: integer("attempt").notNull(),
    exhausted: boolean("exhausted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_gdrive_api_errors_portco_created").on(
      table.portcoId,
      table.createdAt,
    ),
  ],
);
