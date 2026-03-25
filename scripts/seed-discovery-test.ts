/**
 * Creates a test discovery session for manual testing.
 * Usage: npx tsx scripts/seed-discovery-test.ts
 *
 * Outputs the interview URL and password.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import "dotenv/config";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");

  const client = postgres(connectionString);
  const db = drizzle(client);

  // Find a deal with closed_won status (or any deal for testing)

  const [deal] = await db.execute(sql`
    SELECT d.id as deal_id, d.company_name, d.portco_id
    FROM deals d
    WHERE d.status = 'closed_won'
    LIMIT 1
  `) as any[];

  if (!deal) {
    // Fall back to any deal
  
    const [anyDeal] = await db.execute(sql`
      SELECT d.id as deal_id, d.company_name, d.portco_id
      FROM deals d
      LIMIT 1
    `) as any[];

    if (!anyDeal) {
      console.error("No deals found. Run seed-demo.ts first.");
      await client.end();
      return;
    }
    Object.assign(deal, anyDeal);
  }

  console.log(`Using deal: ${deal.company_name} (${deal.deal_id})`);

  // Create a test employee

  const [employee] = await db.execute(sql`
    INSERT INTO company_employees (deal_id, portco_id, name, email, department, job_title)
    VALUES (${deal.deal_id}, ${deal.portco_id}, '田中 花子', 'hanako@example.com', '経理部', '経理主任')
    RETURNING id
  `) as any[];

  console.log(`Created employee: 田中 花子 (${employee.id})`);

  // Create a campaign

  const [campaign] = await db.execute(sql`
    INSERT INTO discovery_campaigns (deal_id, portco_id, name, description, campaign_type, status)
    VALUES (
      ${deal.deal_id},
      ${deal.portco_id},
      'テスト: 業務フロー発見',
      '業務プロセスの洗い出しと自動化機会の特定',
      'workflow_discovery',
      'active'
    )
    RETURNING id
  `) as any[];

  console.log(`Created campaign: ${campaign.id}`);

  // Create a session with password
  const password = Math.random().toString(36).slice(2, 8).toUpperCase();
  const passwordHash = await bcrypt.hash(password, 10);


  const [session] = await db.execute(sql`
    INSERT INTO discovery_sessions (campaign_id, employee_id, password_hash, status)
    VALUES (${campaign.id}, ${employee.id}, ${passwordHash}, 'pending')
    RETURNING id
  `) as any[];

  console.log("\n========================================");
  console.log("  Test Interview Session Created!");
  console.log("========================================");
  console.log(`  URL:      http://localhost:3000/interview/${session.id}`);
  console.log(`  Password: ${password}`);
  console.log(`  Employee: 田中 花子 (経理主任)`);
  console.log(`  Company:  ${deal.company_name}`);
  console.log("========================================\n");

  await client.end();
}

main().catch(console.error);
