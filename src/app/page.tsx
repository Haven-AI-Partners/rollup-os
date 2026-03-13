import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  // Find or create the DB user (handles case where webhook hasn't fired yet)
  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!dbUser) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      redirect("/sign-in");
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) {
      redirect("/sign-in");
    }

    const fullName =
      [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;

    [dbUser] = await db
      .insert(users)
      .values({
        clerkId: clerkUser.id,
        email,
        fullName,
        avatarUrl: clerkUser.imageUrl,
      })
      .onConflictDoUpdate({
        target: users.clerkId,
        set: { email, fullName, avatarUrl: clerkUser.imageUrl, updatedAt: new Date() },
      })
      .returning();
  }

  const existingMemberships = await db
    .select({ slug: portcos.slug, role: portcoMemberships.role })
    .from(portcoMemberships)
    .innerJoin(portcos, eq(portcoMemberships.portcoId, portcos.id))
    .where(eq(portcoMemberships.userId, dbUser.id));

  let firstMembership: { slug: string } | undefined = existingMemberships[0];

  // Owners get access to all portcos — backfill any missing memberships
  const isOwner = existingMemberships.some((m) => m.role === "owner");
  if (isOwner) {
    const allPortcos = await db.select({ id: portcos.id, slug: portcos.slug }).from(portcos);
    const memberPortcoSlugs = new Set(existingMemberships.map((m) => m.slug));
    const missing = allPortcos.filter((p) => !memberPortcoSlugs.has(p.slug));

    if (missing.length > 0) {
      await db
        .insert(portcoMemberships)
        .values(missing.map((p) => ({ userId: dbUser.id, portcoId: p.id, role: "owner" as const })))
        .onConflictDoNothing();
    }
  }

  // Auto-join portcos by email domain if user has no memberships yet
  if (!firstMembership) {
    const emailDomain = dbUser.email.split("@")[1];
    const allPortcos = await db.select().from(portcos);

    if (emailDomain) {
      for (const portco of allPortcos) {
        const allowed = portco.allowedDomains as
          | { domain: string; defaultRole: string }[]
          | null;
        const match = allowed?.find((d) => d.domain === emailDomain);
        if (match) {
          // Check for per-email role overrides in settings.roleOverrides
          const overrides = (portco.settings as { roleOverrides?: Record<string, string> } | null)?.roleOverrides;
          const role = (overrides?.[dbUser.email] ?? match.defaultRole) as "owner" | "admin" | "analyst" | "viewer";

          await db
            .insert(portcoMemberships)
            .values({
              userId: dbUser.id,
              portcoId: portco.id,
              role,
            })
            .onConflictDoNothing();

          if (!firstMembership) {
            firstMembership = { slug: portco.slug };
          }
        }
      }
    }

    // Fallback: auto-assign to demo portco if no domain match
    if (!firstMembership) {
      const demoPortco = allPortcos.find((p) => p.slug === "demo");
      if (demoPortco) {
        await db
          .insert(portcoMemberships)
          .values({
            userId: dbUser.id,
            portcoId: demoPortco.id,
            role: "analyst",
          })
          .onConflictDoNothing();
        firstMembership = { slug: demoPortco.slug };
      }
    }
  }

  if (firstMembership) {
    redirect(`/${firstMembership.slug}/pipeline`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto max-w-md text-center">
        <div className="mb-6 text-5xl">🏢</div>
        <h1 className="text-2xl font-bold">Welcome to Rollup OS</h1>
        <p className="mt-3 text-muted-foreground">
          You&apos;re signed in as <span className="font-medium text-foreground">{dbUser.email}</span>, but you don&apos;t have access to any portfolio companies yet.
        </p>
        <div className="mt-6 rounded-lg border bg-muted/50 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">How to get access</p>
          <ul className="space-y-1 text-left list-disc pl-4">
            <li>Ask your team admin to add you to a PortCo</li>
            <li>Sign in with an email domain that matches an existing PortCo</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
