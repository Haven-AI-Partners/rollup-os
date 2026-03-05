import "dotenv/config";
import postgres from "postgres";

async function main() {
  const client = postgres(process.env.DATABASE_URL!, { prepare: false });

  // Add column if it doesn't exist
  await client`
    ALTER TABLE portcos ADD COLUMN IF NOT EXISTS allowed_domains JSONB
  `;

  // Set allowed domains for Haven AI Partners
  await client`
    UPDATE portcos
    SET allowed_domains = ${JSON.stringify([
      { domain: "havenaipartners.com", defaultRole: "analyst" },
      { domain: "wayequity.co", defaultRole: "analyst" },
    ])}::jsonb
    WHERE slug = 'haven-ai-partners'
  `;

  const [row] = await client`
    SELECT name, allowed_domains FROM portcos WHERE slug = 'haven-ai-partners'
  `;
  console.log(`${row.name}: allowed_domains =`, row.allowed_domains);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
