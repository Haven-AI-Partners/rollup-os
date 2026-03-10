import { db } from "@/lib/db";
import { promptVersions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { DEFAULT_TEMPLATE, AGENT_SLUG } from "@/lib/agents/im-processor/prompt";

async function main() {
  // Deactivate all existing versions
  await db
    .update(promptVersions)
    .set({ isActive: false })
    .where(
      and(
        eq(promptVersions.agentSlug, AGENT_SLUG),
        eq(promptVersions.isActive, true),
      )
    );

  // Insert v4 with the reverted v1-style template
  const [inserted] = await db
    .insert(promptVersions)
    .values({
      agentSlug: AGENT_SLUG,
      version: 4,
      template: DEFAULT_TEMPLATE,
      isActive: true,
      changeNote: "Reverted to v1-style simple scoring. Sub-scoring (v3) increased variance from ±0.113 to ±0.301 and dropped flag agreement from 18% to 3%.",
    })
    .returning({ id: promptVersions.id, version: promptVersions.version });

  console.log(`Saved prompt v${inserted.version} (id: ${inserted.id}) as active`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
