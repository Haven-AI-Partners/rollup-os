import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

import fs from "fs";
import path from "path";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  // Try .env.local
  const envLocal = fs.readFileSync(path.join(__dirname, "../.env.local"), "utf8");
  const match = envLocal.match(/^DATABASE_URL=(.+)$/m);
  if (match) process.env.DATABASE_URL = match[1];
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log("Adding last_login_at column to users table...");
  await db.execute(sql`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ
  `);
  console.log("Done!");

  await client.end();
}

main().catch(console.error);
