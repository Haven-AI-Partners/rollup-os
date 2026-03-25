import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

// Load .env.local (same as drizzle.config.ts)
config({ path: ".env.local" });

const indexes = [
  "CREATE INDEX IF NOT EXISTS idx_red_flags_deal ON deal_red_flags (deal_id)",
  "CREATE INDEX IF NOT EXISTS idx_red_flags_deal_resolved ON deal_red_flags (deal_id, resolved, severity)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_deal ON deal_tasks (deal_id)",
  "CREATE INDEX IF NOT EXISTS idx_tasks_deal_status ON deal_tasks (deal_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_activity_deal ON deal_activity_log (deal_id)",
  "CREATE INDEX IF NOT EXISTS idx_activity_deal_ts ON deal_activity_log (deal_id, created_at)",
  "CREATE INDEX IF NOT EXISTS idx_files_gdrive ON files (gdrive_file_id)",
  "CREATE INDEX IF NOT EXISTS idx_files_portco_status ON files (portco_id, processing_status)",
  "CREATE INDEX IF NOT EXISTS idx_deals_portco_status ON deals (portco_id, status)",
  "CREATE INDEX IF NOT EXISTS idx_deals_portco_stage ON deals (portco_id, stage_id)",
];

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  for (const idx of indexes) {
    await db.execute(sql.raw(idx));
    const name = idx.split("IF NOT EXISTS ")[1]?.split(" ON")[0];
    console.log(`Created: ${name}`);
  }

  console.log("\nAll indexes applied.");
  await client.end();
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
