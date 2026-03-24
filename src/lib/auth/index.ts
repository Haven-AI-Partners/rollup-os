import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function getCurrentUser() {
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.clerkId, clerkUser.id))
    .limit(1);

  return dbUser ?? null;
}

export async function getUserPortcos(userId: string) {
  const result = await db
    .select({
      membership: portcoMemberships,
      portco: portcos,
    })
    .from(portcoMemberships)
    .innerJoin(portcos, eq(portcoMemberships.portcoId, portcos.id))
    .where(eq(portcoMemberships.userId, userId));

  return result;
}

export async function getUserPortcoRole(userId: string, portcoId: string) {
  const [membership] = await db
    .select()
    .from(portcoMemberships)
    .where(
      and(
        eq(portcoMemberships.userId, userId),
        eq(portcoMemberships.portcoId, portcoId)
      )
    )
    .limit(1);

  return membership?.role ?? null;
}

export async function getPortcoBySlug(slug: string) {
  const [portco] = await db
    .select()
    .from(portcos)
    .where(eq(portcos.slug, slug))
    .limit(1);

  return portco ?? null;
}

export type UserRole = "owner" | "admin" | "analyst" | "viewer";

const ROLE_HIERARCHY: Record<UserRole, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};

export function hasMinRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}
