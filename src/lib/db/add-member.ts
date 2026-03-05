import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, portcos, portcoMemberships } from "./schema";
import { eq } from "drizzle-orm";

async function addMember() {
  const email = process.argv[2];
  const role = (process.argv[3] as "owner" | "admin" | "analyst" | "viewer") || "owner";

  if (!email) {
    console.error("Usage: tsx src/lib/db/add-member.ts <email> [role]");
    console.error("Roles: owner, admin, analyst, viewer (default: owner)");
    process.exit(1);
  }

  const client = postgres(process.env.DATABASE_URL!, { prepare: false });
  const db = drizzle(client);

  // Find user by email
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) {
    console.error(`User with email "${email}" not found. Sign in first to create the user.`);
    await client.end();
    process.exit(1);
  }

  // Get all portcos
  const allPortcos = await db.select().from(portcos);
  if (allPortcos.length === 0) {
    console.error("No PortCos found. Run pnpm db:seed first.");
    await client.end();
    process.exit(1);
  }

  // Add membership to all portcos
  for (const portco of allPortcos) {
    await db
      .insert(portcoMemberships)
      .values({
        userId: user.id,
        portcoId: portco.id,
        role,
      })
      .onConflictDoNothing();

    console.log(`Added ${user.fullName ?? user.email} as ${role} to ${portco.name}`);
  }

  console.log("Done!");
  await client.end();
  process.exit(0);
}

addMember().catch((err) => {
  console.error(err);
  process.exit(1);
});
