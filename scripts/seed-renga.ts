/**
 * Seed Renga Partners portco with pipeline stages.
 *
 * Usage: pnpm tsx scripts/seed-renga.ts
 */
import "dotenv/config";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { portcos, pipelineStages } from "../src/lib/db/schema";

config({ path: ".env.local" });

async function seed() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  console.log("Seeding Renga Partners...");

  const [portco] = await db
    .insert(portcos)
    .values({
      name: "Renga Partners",
      slug: "renga-partners",
      description:
        "Japan-focused M&A platform specializing in domestic IT company acquisitions. Named after 煉瓦 (brick) — building strong, sustainable organizational foundations — and 連歌 (linked verse) — the thoughtful succession of cultivated businesses. Stewardship over transaction: we preserve founder-built cultures and serve as a long-term home for acquired businesses.",
      industry: "IT Services",
      focusAreas: ["IT Services", "SaaS", "Software Development", "Managed Services"],
      targetGeography: ["Japan"],
      investmentThesis:
        "Japan's domestic IT sector faces a generational succession crisis. We acquire profitable, founder-led IT companies and provide a permanent home — preserving cultures and teams while building shared operational infrastructure. We avoid short-term exits, instead building brick-by-brick with M&A as the beginning of growth, not the end.",
      targetRevenueMin: "100000000",
      targetRevenueMax: "1000000000",
      targetEbitdaMin: "20000000",
      targetEbitdaMax: "200000000",
      targetDealSizeMin: "50000000",
      targetDealSizeMax: "500000000",
      acquisitionCriteria: {
        philosophy: "Participatory management — respect portfolio company autonomy, collaborate with management, employees, and customers rather than imposing top-down transformation",
        holdPeriod: "Permanent / long-term",
        keyFactors: [
          "Profitable domestic IT company",
          "Strong founder-built culture worth preserving",
          "Succession opportunity (founder retirement/transition)",
          "Recurring or sticky revenue base",
          "Integration potential with existing portfolio",
        ],
      },
      scoringRubric: {
        dimensions: [
          { id: "financial_stability", weight: 0.20 },
          { id: "client_concentration", weight: 0.20 },
          { id: "technology", weight: 0.15 },
          { id: "debt_leverage", weight: 0.12 },
          { id: "business_model", weight: 0.12 },
          { id: "ai_readiness", weight: 0.10 },
          { id: "org_complexity", weight: 0.06 },
          { id: "integration_risk", weight: 0.05 },
        ],
        recommendationBands: [
          { min: 4.0, max: 5.0, label: "Strong Candidate" },
          { min: 3.5, max: 3.99, label: "Good Candidate" },
          { min: 3.0, max: 3.49, label: "Acceptable" },
          { min: 2.5, max: 2.99, label: "Marginal" },
          { min: 0, max: 2.49, label: "High Risk - Pass" },
        ],
      },
      allowedDomains: [
        { domain: "rengapartners.com", defaultRole: "admin" },
      ],
      settings: {
        websiteUrl: "https://www.rengapartners.com",
        location: "Shibuya, Tokyo (Daikanyama Art Village)",
        capital: "¥90.5M",
        groupEmployees: 40,
        founder: "Daisuke Namba",
      },
    })
    .onConflictDoNothing()
    .returning();

  if (!portco) {
    console.log("Renga Partners already exists, skipping.");
    await client.end();
    return;
  }

  console.log(`Created PortCo: ${portco.name} (slug: ${portco.slug})`);

  const stageData = [
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
    stageData.map((s) => ({ ...s, portcoId: portco.id }))
  );

  console.log(`Created ${stageData.length} pipeline stages`);
  console.log("\nDone! Slug: /renga-partners/pipeline");
  await client.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
