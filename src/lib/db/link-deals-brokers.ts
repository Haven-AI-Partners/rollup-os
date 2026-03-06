import "dotenv/config";
import { db } from "./index";
import { deals, brokerFirms } from "./schema";
import { sql, eq, isNull } from "drizzle-orm";

async function main() {
  // Get all broker firm IDs
  const firms = await db.select({ id: brokerFirms.id, name: brokerFirms.name }).from(brokerFirms);
  console.log(`Found ${firms.length} broker firms`);

  // Get all deals without a broker assigned
  const unlinked = await db
    .select({ id: deals.id, companyName: deals.companyName })
    .from(deals)
    .where(isNull(deals.brokerFirmId));
  console.log(`Found ${unlinked.length} deals without broker linkage`);

  if (firms.length === 0 || unlinked.length === 0) {
    console.log("Nothing to link.");
    process.exit(0);
  }

  // Distribute deals across brokers (round-robin with some variation)
  for (let i = 0; i < unlinked.length; i++) {
    const firm = firms[i % firms.length];
    await db
      .update(deals)
      .set({ brokerFirmId: firm.id })
      .where(eq(deals.id, unlinked[i].id));
    console.log(`  Linked "${unlinked[i].companyName}" → ${firm.name}`);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
