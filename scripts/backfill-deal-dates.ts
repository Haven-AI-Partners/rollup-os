/**
 * One-time script to backfill deal.created_at from GDrive file modifiedTime.
 *
 * For each deal created from a GDrive IM file, looks up the GDrive file's
 * modifiedTime and sets deal.created_at to that date instead of when it
 * was processed in the app.
 *
 * Usage: pnpm tsx scripts/backfill-deal-dates.ts
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { deals } from "../src/lib/db/schema/deals";
import { files } from "../src/lib/db/schema/files";
import { portcos } from "../src/lib/db/schema/portcos";
import { listFiles } from "../src/lib/gdrive/client";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  // Get all portcos
  const allPortcos = await db.select({ id: portcos.id, name: portcos.name }).from(portcos);

  let updated = 0;
  let skipped = 0;

  for (const portco of allPortcos) {
    console.log(`\nProcessing portco: ${portco.name}`);

    // Get all completed IM files for this portco
    const imFiles = await db
      .select({
        dealId: files.dealId,
        gdriveFileId: files.gdriveFileId,
      })
      .from(files)
      .where(eq(files.portcoId, portco.id));

    if (imFiles.length === 0) {
      console.log("  No files found, skipping.");
      continue;
    }

    // List GDrive files to get modifiedTime
    const gdriveResult = await listFiles(portco.id, 200);
    if (!gdriveResult) {
      console.log("  GDrive not connected, skipping.");
      continue;
    }

    // Build a map of gdriveFileId -> modifiedTime
    const modifiedTimeMap = new Map<string, string>();
    for (const f of gdriveResult.files) {
      if (f.id && f.modifiedTime) {
        modifiedTimeMap.set(f.id, f.modifiedTime);
      }
    }

    const validUpdates = imFiles.filter((file) => {
      if (!file.gdriveFileId) { skipped++; return false; }
      if (!modifiedTimeMap.has(file.gdriveFileId)) {
        console.log(`  File ${file.gdriveFileId}: no modifiedTime in GDrive, skipping.`);
        skipped++;
        return false;
      }
      return true;
    });

    await Promise.all(
      validUpdates.map(async (file) => {
        const modifiedTime = modifiedTimeMap.get(file.gdriveFileId!)!;
        await db
          .update(deals)
          .set({ createdAt: new Date(modifiedTime) })
          .where(eq(deals.id, file.dealId!));
        console.log(`  Deal ${file.dealId!}: set createdAt to ${modifiedTime}`);
        updated++;
      })
    );
  }

  console.log(`\nDone. Updated: ${updated}, Skipped: ${skipped}`);
  await client.end();
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
