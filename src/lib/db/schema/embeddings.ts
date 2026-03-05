import { pgTable, uuid, text, timestamp, integer, jsonb, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { files } from "./files";
import { deals } from "./deals";
import { portcos } from "./portcos";

export const documentEmbeddings = pgTable(
  "document_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fileId: uuid("file_id")
      .references(() => files.id)
      .notNull(),
    dealId: uuid("deal_id")
      .references(() => deals.id)
      .notNull(),
    portcoId: uuid("portco_id")
      .references(() => portcos.id)
      .notNull(),
    chunkIndex: integer("chunk_index").notNull(),
    chunkText: text("chunk_text").notNull(),
    // vector column added via raw SQL migration since Drizzle doesn't natively support pgvector
    // embedding VECTOR(1536)
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_embeddings_portco").on(table.portcoId),
    index("idx_embeddings_deal").on(table.dealId),
    index("idx_embeddings_file").on(table.fileId),
  ]
);
