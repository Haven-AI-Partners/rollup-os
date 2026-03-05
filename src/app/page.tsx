import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    redirect("/sign-in");
  }

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!dbUser) {
    redirect("/sign-in");
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
