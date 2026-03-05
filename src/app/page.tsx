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

  const [firstMembership] = await db
    .select({ slug: portcos.slug })
    .from(portcoMemberships)
    .innerJoin(portcos, eq(portcoMemberships.portcoId, portcos.id))
    .where(eq(portcoMemberships.userId, dbUser.id))
    .limit(1);

  if (firstMembership) {
    redirect(`/${firstMembership.slug}/dashboard`);
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Welcome to Rollup OS</h1>
        <p className="mt-2 text-muted-foreground">
          You don&apos;t have access to any PortCos yet. Contact your administrator.
        </p>
      </div>
    </div>
  );
}
