import "dotenv/config";
import postgres from "postgres";

async function createTable() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  console.log("Creating deal_red_flags table...");
  await client`
    CREATE TABLE IF NOT EXISTS deal_red_flags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      deal_id UUID NOT NULL REFERENCES deals(id),
      portco_id UUID NOT NULL REFERENCES portcos(id),
      flag_id TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      notes TEXT,
      resolved BOOLEAN NOT NULL DEFAULT false,
      resolved_at TIMESTAMPTZ,
      flagged_by UUID REFERENCES users(id),
      resolved_by UUID REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;
  console.log("Done!");

  await client.end();
  process.exit(0);
}

createTable().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
