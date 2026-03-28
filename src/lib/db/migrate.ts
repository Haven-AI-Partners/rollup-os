import crypto from "node:crypto";
import fs from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = "./src/lib/db/migrations";

/**
 * Migrations 0000–0004 were originally applied via `db:push`, which doesn't
 * record entries in the drizzle journal table. This causes `migrate()` to
 * re-run them, failing with "relation already exists".
 *
 * This function detects that situation (tables exist but journal is empty)
 * and back-fills the journal so only new migrations run.
 */
async function backfillJournalIfNeeded(sql: postgres.Sql) {
  const journalPath = `${MIGRATIONS_FOLDER}/meta/_journal.json`;
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

  // Check if the drizzle journal table has any entries
  const rows = await sql`
    SELECT id FROM drizzle."__drizzle_migrations" LIMIT 1
  `.catch(() => []);

  if (rows.length > 0) {
    // Journal already has entries — nothing to backfill
    return;
  }

  // Check if the database was previously set up via db:push
  const tableCheck = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'users'
    LIMIT 1
  `;

  if (tableCheck.length === 0) {
    // Fresh database — no backfill needed, migrations will run normally
    return;
  }

  console.log(
    "Detected db:push database without migration journal entries. Back-filling..."
  );

  // Back-fill ALL existing migrations so `migrate()` treats them as already applied.
  // All tables were created via db:push, so every migration is already reflected in the DB.
  const entriesToBackfill = journal.entries;

  for (const entry of entriesToBackfill) {
    const filePath = `${MIGRATIONS_FOLDER}/${entry.tag}.sql`;
    const query = fs.readFileSync(filePath, "utf-8");
    const hash = crypto.createHash("sha256").update(query).digest("hex");

    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`  Recorded migration: ${entry.tag}`);
  }

  console.log("Back-fill complete.");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql);

  try {
    await backfillJournalIfNeeded(sql);

    console.log("Running migrations...");
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
    console.log("Migrations complete.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
