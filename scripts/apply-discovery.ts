import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  const sqlContent = readFileSync(join(__dirname, "../scripts/create-discovery-tables.sql"), "utf8");
  const client = postgres(connectionString);
  const db = drizzle(client);
  
  // Split by semicolons and execute each statement
  const statements = sqlContent.split(";").map(s => s.trim()).filter(Boolean);
  for (const stmt of statements) {
    console.log("Executing:", stmt.slice(0, 60) + "...");
    await db.execute(sql.raw(stmt));
  }
  
  console.log("Done! All discovery tables created.");
  await client.end();
}

main().catch(console.error);
