import "dotenv/config";
import postgres from "postgres";

async function resetDemo() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  console.log("Clearing demo data...");
  await client`DELETE FROM deal_red_flags`;
  await client`DELETE FROM deal_activity_log`;
  await client`DELETE FROM deal_comments`;
  await client`DELETE FROM deal_tasks`;
  await client`DELETE FROM deal_financials`;
  await client`DELETE FROM company_profiles`;
  await client`DELETE FROM files`;
  await client`DELETE FROM deals`;
  console.log("Done! Run db:seed-demo to re-seed.");

  await client.end();
  process.exit(0);
}

resetDemo().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
