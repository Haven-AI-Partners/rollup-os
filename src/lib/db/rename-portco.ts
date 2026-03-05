import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { portcos } from "./schema";
import { eq } from "drizzle-orm";

async function rename() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  const [updated] = await db
    .update(portcos)
    .set({ name: "Haven AI Partners", slug: "haven-ai-partners", updatedAt: new Date() })
    .where(eq(portcos.slug, "haven-capital"))
    .returning();

  if (updated) {
    console.log(`Renamed to: ${updated.name} (/${updated.slug})`);
  } else {
    console.log("PortCo with slug 'haven-capital' not found — may already be renamed.");
  }

  await client.end();
  process.exit(0);
}

rename().catch((err) => {
  console.error(err);
  process.exit(1);
});
