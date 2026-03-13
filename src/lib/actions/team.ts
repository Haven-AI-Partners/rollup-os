"use server";

import { db } from "@/lib/db";
import { users, portcoMemberships, portcos } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCurrentUser, getUserPortcoRole, hasMinRole, type UserRole } from "@/lib/auth";

export async function getTeamMembers(portcoId: string) {
  return db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      avatarUrl: users.avatarUrl,
      lastLoginAt: users.lastLoginAt,
      createdAt: users.createdAt,
      role: portcoMemberships.role,
      membershipId: portcoMemberships.id,
      joinedAt: portcoMemberships.createdAt,
    })
    .from(portcoMemberships)
    .innerJoin(users, eq(portcoMemberships.userId, users.id))
    .where(eq(portcoMemberships.portcoId, portcoId))
    .orderBy(users.fullName);
}

export async function updateMemberRole(
  membershipId: string,
  portcoId: string,
  portcoSlug: string,
  newRole: UserRole,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const myRole = await getUserPortcoRole(currentUser.id, portcoId);
  if (!myRole) throw new Error("Not a member of this portco");

  // Get the target membership
  const [target] = await db
    .select()
    .from(portcoMemberships)
    .where(eq(portcoMemberships.id, membershipId))
    .limit(1);

  if (!target) throw new Error("Membership not found");
  if (target.portcoId !== portcoId) throw new Error("Membership doesn't belong to this portco");

  // Permission checks
  const myRoleTyped = myRole as UserRole;

  // Can't change your own role
  if (target.userId === currentUser.id) throw new Error("Cannot change your own role");

  // Can't assign a role higher than your own
  if (!hasMinRole(myRoleTyped, newRole)) throw new Error("Cannot assign a role higher than your own");

  // Can't modify someone with a role >= your own (except owners can modify other owners)
  const targetRole = target.role as UserRole;
  if (myRoleTyped !== "owner" && hasMinRole(targetRole, myRoleTyped)) {
    throw new Error("Cannot modify a member with equal or higher role");
  }

  // Owners can set any role. Admins can set analyst/viewer.
  if (!hasMinRole(myRoleTyped, "admin")) {
    throw new Error("Only admins and owners can change roles");
  }

  await db
    .update(portcoMemberships)
    .set({ role: newRole })
    .where(eq(portcoMemberships.id, membershipId));

  revalidatePath(`/${portcoSlug}/settings/team`);
}

export async function removeMember(
  membershipId: string,
  portcoId: string,
  portcoSlug: string,
) {
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Unauthorized");

  const myRole = await getUserPortcoRole(currentUser.id, portcoId);
  if (!myRole || !hasMinRole(myRole as UserRole, "admin")) {
    throw new Error("Only admins and owners can remove members");
  }

  const [target] = await db
    .select()
    .from(portcoMemberships)
    .where(eq(portcoMemberships.id, membershipId))
    .limit(1);

  if (!target) throw new Error("Membership not found");
  if (target.portcoId !== portcoId) throw new Error("Membership doesn't belong to this portco");
  if (target.userId === currentUser.id) throw new Error("Cannot remove yourself");

  const targetRole = target.role as UserRole;
  const myRoleTyped = myRole as UserRole;

  // Can't remove someone with a role >= your own (unless owner)
  if (myRoleTyped !== "owner" && hasMinRole(targetRole, myRoleTyped)) {
    throw new Error("Cannot remove a member with equal or higher role");
  }

  await db
    .delete(portcoMemberships)
    .where(eq(portcoMemberships.id, membershipId));

  revalidatePath(`/${portcoSlug}/settings/team`);
}
