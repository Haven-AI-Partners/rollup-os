import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getPortcoBySlug, getUserPortcoRole } from "@/lib/auth";
import { getTeamMembers } from "@/lib/actions/team";
import { SettingsPageLayout } from "@/components/settings/settings-page-layout";
import { TeamTable } from "@/components/settings/team-table";
import type { UserRole } from "@/lib/auth";

export default async function TeamPage({
  params,
}: {
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const [{ userId: clerkId }, portco] = await Promise.all([
    auth(),
    getPortcoBySlug(portcoSlug),
  ]);

  if (!clerkId || !portco) notFound();

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!dbUser) notFound();

  const [myRole, members] = await Promise.all([
    getUserPortcoRole(dbUser.id, portco.id),
    getTeamMembers(portco.id),
  ]);

  if (!myRole) notFound();

  return (
    <SettingsPageLayout portcoSlug={portcoSlug} portcoName={portco.name} maxWidth={false}>
      <div>
        <h2 className="text-lg font-semibold">Team Members</h2>
        <p className="text-sm text-muted-foreground">
          {members.length} member{members.length !== 1 ? "s" : ""} in{" "}
          {portco.name}
        </p>
      </div>

      <TeamTable
        members={members}
        currentUserId={dbUser.id}
        currentUserRole={myRole as UserRole}
        portcoId={portco.id}
        portcoSlug={portcoSlug}
      />
    </SettingsPageLayout>
  );
}
