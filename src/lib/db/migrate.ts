import crypto from "node:crypto";
import fs from "node:fs";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const MIGRATIONS_FOLDER = "./src/lib/db/migrations";

/**
 * Tables were originally created via `db:push`, which doesn't record entries
 * in drizzle's migration journal. This causes `migrate()` to re-run those
 * migrations, failing with "relation already exists".
 *
 * This function checks each migration individually and backfills any that
 * are missing from the journal but whose timestamp indicates they should
 * already be applied.
 */
async function backfillJournalIfNeeded(sql: postgres.Sql) {
  const journalPath = `${MIGRATIONS_FOLDER}/meta/_journal.json`;
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf-8"));

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

  // Get all recorded migration timestamps from the journal table
  const recorded = await sql`
    SELECT created_at FROM drizzle."__drizzle_migrations"
  `.catch(() => []);

  const recordedTimestamps = new Set(
    recorded.map((r) => String((r as Record<string, unknown>).created_at))
  );

  let backfilled = 0;

  for (const entry of journal.entries) {
    if (recordedTimestamps.has(String(entry.when))) {
      continue;
    }

    const filePath = `${MIGRATIONS_FOLDER}/${entry.tag}.sql`;
    const query = fs.readFileSync(filePath, "utf-8");
    const hash = crypto.createHash("sha256").update(query).digest("hex");

    await sql`
      INSERT INTO drizzle."__drizzle_migrations" (hash, created_at)
      VALUES (${hash}, ${entry.when})
    `;
    console.log(`Backfilled migration: ${entry.tag}`);
    backfilled++;
  }

  if (backfilled > 0) {
    console.log(`Backfilled ${backfilled} migration(s).`);
  }
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
