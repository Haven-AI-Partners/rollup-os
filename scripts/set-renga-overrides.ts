import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, sql } from "drizzle-orm";
import { portcos } from "../src/lib/db/schema";

config({ path: ".env.local" });

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const [portco] = await db.select().from(portcos).where(eq(portcos.slug, "renga-partners")).limit(1);
  if (!portco) {
    console.error("Renga Partners not found");
    process.exit(1);
  }

  const settings = (portco.settings as Record<string, unknown>) || {};
  settings.roleOverrides = { "dais@rengapartners.com": "admin" };

  await db
    .update(portcos)
    .set({ settings })
    .where(eq(portcos.id, portco.id));

  console.log("Set roleOverrides:", JSON.stringify(settings.roleOverrides));
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
