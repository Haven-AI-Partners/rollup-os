import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { portcos, pipelineStages } from "./schema";

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log("Seeding database...");

  // Create a sample PortCo
  const [samplePortco] = await db
    .insert(portcos)
    .values({
      name: "Haven AI Partners",
      slug: "haven-ai-partners",
      description: "Japan-focused M&A rollup targeting SMB services businesses",
      industry: "Business Services",
      focusAreas: ["IT Services", "HR Services", "Facility Management"],
      targetGeography: ["Japan", "Southeast Asia"],
      investmentThesis:
        "Acquire profitable SMB services businesses in Japan with strong recurring revenue, consolidate operations, and expand regionally.",
      targetRevenueMin: "100000000",
      targetRevenueMax: "1000000000",
      targetEbitdaMin: "20000000",
      targetEbitdaMax: "200000000",
      targetDealSizeMin: "50000000",
      targetDealSizeMax: "500000000",
    })
    .onConflictDoNothing()
    .returning();

  if (samplePortco) {
    console.log(`Created PortCo: ${samplePortco.name}`);

    // Seed default pipeline stages
    const defaultStages = [
      { name: "Sourced", phase: "sourcing" as const, position: 0, color: "#94a3b8" },
      { name: "IM Review", phase: "evaluation" as const, position: 1, color: "#60a5fa" },
      { name: "Initial Call", phase: "evaluation" as const, position: 2, color: "#818cf8" },
      { name: "LOI", phase: "evaluation" as const, position: 3, color: "#a78bfa" },
      { name: "Due Diligence", phase: "diligence" as const, position: 4, color: "#f59e0b" },
      { name: "Closing", phase: "closing" as const, position: 5, color: "#10b981" },
      { name: "Closed Won", phase: "closing" as const, position: 6, color: "#22c55e" },
      { name: "Passed", phase: "closing" as const, position: 7, color: "#ef4444" },
    ];

    await db.insert(pipelineStages).values(
      defaultStages.map((stage) => ({
        ...stage,
        portcoId: samplePortco.id,
      }))
    );

    console.log(`Created ${defaultStages.length} pipeline stages`);
  } else {
    console.log("PortCo already exists, skipping...");
  }

  console.log("Seed complete!");
  await client.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
