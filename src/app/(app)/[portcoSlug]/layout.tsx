import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { isAllowedEmail } from "@/lib/allowed-domains";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function PortcoLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ portcoSlug: string }>;
}) {
  const { portcoSlug } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Get DB user
  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!dbUser) {
    redirect("/sign-in");
  }

  if (!isAllowedEmail(dbUser.email)) {
    redirect("/access-denied");
  }

  // Get portco, membership, and switcher data in parallel
  const [portcoResult, userPortcosWithMembership] = await Promise.all([
    db.select().from(portcos).where(eq(portcos.slug, portcoSlug)).limit(1),
    db
      .select({
        id: portcos.id,
        name: portcos.name,
        slug: portcos.slug,
        industry: portcos.industry,
        role: portcoMemberships.role,
      })
      .from(portcoMemberships)
      .innerJoin(portcos, eq(portcoMemberships.portcoId, portcos.id))
      .where(eq(portcoMemberships.userId, dbUser.id)),
  ]);

  const currentPortco = portcoResult[0];
  if (!currentPortco) {
    notFound();
  }

  // Owners get access to all portcos — backfill missing memberships
  const isOwner = userPortcosWithMembership.some((m) => m.role === "owner");
  let userPortcos = userPortcosWithMembership;

  if (isOwner) {
    const memberIds = new Set(userPortcosWithMembership.map((p) => p.id));
    if (!memberIds.has(currentPortco.id)) {
      // Backfill membership for this portco
      await db
        .insert(portcoMemberships)
        .values({ userId: dbUser.id, portcoId: currentPortco.id, role: "owner" })
        .onConflictDoNothing();
      userPortcos = [
        ...userPortcosWithMembership,
        { id: currentPortco.id, name: currentPortco.name, slug: currentPortco.slug, industry: currentPortco.industry, role: "owner" as const },
      ];
    }
  }

  // Check membership from already-fetched data (no extra query)
  const membership = userPortcos.find(
    (p) => p.id === currentPortco.id
  );

  if (!membership) {
    notFound();
  }

  return (
    <SidebarProvider>
      <AppSidebar
        portcoSlug={portcoSlug}
        portcos={userPortcos}
        currentPortco={{
          id: currentPortco.id,
          name: currentPortco.name,
          slug: currentPortco.slug,
          industry: currentPortco.industry,
        }}
        userRole={membership.role}
      />
      <SidebarInset className="min-w-0 overflow-hidden">
        <AppHeader portcoName={currentPortco.name} />
        <div className="flex-1 overflow-auto p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
