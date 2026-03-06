import "dotenv/config";
import { db } from "./index";
import { users } from "./schema";
import { eq, like } from "drizzle-orm";

async function main() {
  const matches = await db
    .select({ id: users.id, fullName: users.fullName, email: users.email })
    .from(users)
    .where(like(users.fullName, "%Baron-Perin%"));

  console.log("Found:", matches);

  for (const user of matches) {
    const fixed = user.fullName?.replace("Baron-Perin", "Balon-Perin");
    await db.update(users).set({ fullName: fixed }).where(eq(users.id, user.id));
    console.log(`  Updated: "${user.fullName}" → "${fixed}"`);
  }

  console.log("Done!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
