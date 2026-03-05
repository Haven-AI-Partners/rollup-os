import { redirect, notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  // Get portco, membership, and switcher data in parallel
  const [portcoResult, userPortcos] = await Promise.all([
    db.select().from(portcos).where(eq(portcos.slug, portcoSlug)).limit(1),
    db
      .select({
        id: portcos.id,
        name: portcos.name,
        slug: portcos.slug,
        industry: portcos.industry,
      })
      .from(portcoMemberships)
      .innerJoin(portcos, eq(portcoMemberships.portcoId, portcos.id))
      .where(eq(portcoMemberships.userId, dbUser.id)),
  ]);

  const currentPortco = portcoResult[0];
  if (!currentPortco) {
    notFound();
  }

  // Check membership / RBAC
  const [membership] = await db
    .select()
    .from(portcoMemberships)
    .where(
      and(
        eq(portcoMemberships.userId, dbUser.id),
        eq(portcoMemberships.portcoId, currentPortco.id)
      )
    )
    .limit(1);

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
      <SidebarInset>
        <AppHeader portcoName={currentPortco.name} />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
