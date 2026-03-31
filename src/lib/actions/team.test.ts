import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUser,
  mockGetCurrentUser,
  mockGetUserPortcoRole,
  mockRequirePortcoRole,
} = vi.hoisted(() => ({
  mockUser: {
    id: "user-001",
    clerkId: "clerk-001",
    email: "test@example.com",
    fullName: "Test User",
  },
  mockGetCurrentUser: vi.fn(),
  mockGetUserPortcoRole: vi.fn(),
  mockRequirePortcoRole: vi.fn(),
}));

// Use real hasMinRole since permission logic depends on correct role hierarchy
const ROLE_HIERARCHY: Record<string, number> = {
  owner: 4,
  admin: 3,
  analyst: 2,
  viewer: 1,
};
function realHasMinRole(userRole: string, requiredRole: string): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
  getUserPortcoRole: mockGetUserPortcoRole,
  hasMinRole: realHasMinRole,
  requirePortcoRole: mockRequirePortcoRole,
}));

// Queue-based Proxy mock: each `await` on the chain pops the next result
const dbResults: unknown[] = [];
const dbCallTracker = {
  update: vi.fn(),
  delete: vi.fn(),
  set: vi.fn(),
  select: vi.fn(),
};

vi.mock("@/lib/db", () => {
  const chain: any = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "then") {
          if (dbResults.length === 0) return undefined;
          const val = dbResults.shift();
          return (resolve: (v: unknown) => void) => {
            resolve(val);
            return { then: () => {} }; // prevent further chaining on resolved promise
          };
        }
        if (prop in dbCallTracker) {
          return (...args: unknown[]) => {
            (dbCallTracker as any)[prop](...args);
            return chain;
          };
        }
        return () => chain;
      },
    }
  );
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", fullName: "fullName" },
  portcoMemberships: {
    id: "id",
    portcoId: "portcoId",
    userId: "userId",
    role: "role",
    createdAt: "createdAt",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

describe("team actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockGetUserPortcoRole.mockResolvedValue("admin");
    mockRequirePortcoRole.mockResolvedValue({ user: mockUser, role: "viewer" });
  });

  const targetMembership = {
    id: "membership-002",
    userId: "user-002",
    portcoId: "portco-001",
    role: "analyst",
  };

  describe("getTeamMembers", () => {
    it("requires viewer role via requirePortcoRole", async () => {
      mockRequirePortcoRole.mockRejectedValue(new Error("Unauthorized"));

      const { getTeamMembers } = await import("./team");
      await expect(getTeamMembers("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns team members from DB join", async () => {
      const members = [
        { id: "user-001", fullName: "Alice", role: "admin" },
        { id: "user-002", fullName: "Bob", role: "viewer" },
      ];
      dbResults.push(members);

      const { getTeamMembers } = await import("./team");
      const result = await getTeamMembers("portco-001");

      expect(dbCallTracker.select).toHaveBeenCalled();
      expect(result).toEqual(members);
    });
  });

  describe("updateMemberRole", () => {
    it("throws Unauthorized when getCurrentUser returns null", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "admin")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when user is not a member of the portco", async () => {
      mockGetUserPortcoRole.mockResolvedValue(null);

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "admin")
      ).rejects.toThrow("Not a member of this portco");
    });

    it("throws when membership not found", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([]); // empty select result

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-999", "portco-001", "test-portco", "analyst")
      ).rejects.toThrow("Membership not found");
    });

    it("throws when membership belongs to different portco", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([{ ...targetMembership, portcoId: "other-portco" }]);

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "analyst")
      ).rejects.toThrow("Membership doesn't belong to this portco");
    });

    it("throws when trying to change own role", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([{ ...targetMembership, userId: mockUser.id }]);

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "analyst")
      ).rejects.toThrow("Cannot change your own role");
    });

    it("throws when assigning a role higher than own", async () => {
      mockGetUserPortcoRole.mockResolvedValue("analyst");
      dbResults.push([targetMembership]); // analyst target

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "admin")
      ).rejects.toThrow("Cannot assign a role higher than your own");
    });

    it("throws when admin tries to modify another admin", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([{ ...targetMembership, role: "admin" }]);

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "viewer")
      ).rejects.toThrow("Cannot modify a member with equal or higher role");
    });

    it("throws when analyst tries to change roles (not admin+)", async () => {
      mockGetUserPortcoRole.mockResolvedValue("analyst");
      dbResults.push([{ ...targetMembership, role: "viewer" }]); // lower-role target

      const { updateMemberRole } = await import("./team");
      await expect(
        updateMemberRole("membership-002", "portco-001", "test-portco", "viewer")
      ).rejects.toThrow("Only admins and owners can change roles");
    });

    it("allows owner to modify another owner", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([{ ...targetMembership, role: "owner" }]); // select
      dbResults.push(undefined); // update

      const { updateMemberRole } = await import("./team");
      await updateMemberRole("membership-002", "portco-001", "test-portco", "admin");

      expect(dbCallTracker.update).toHaveBeenCalled();
      expect(dbCallTracker.set).toHaveBeenCalled();
    });

    it("allows owner to assign any role", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([targetMembership]); // select (analyst target)
      dbResults.push(undefined); // update

      const { updateMemberRole } = await import("./team");
      await updateMemberRole("membership-002", "portco-001", "test-portco", "admin");

      expect(dbCallTracker.update).toHaveBeenCalled();
    });

    it("allows admin to set analyst/viewer roles", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([targetMembership]); // select (analyst target)
      dbResults.push(undefined); // update

      const { updateMemberRole } = await import("./team");
      await updateMemberRole("membership-002", "portco-001", "test-portco", "viewer");

      expect(dbCallTracker.update).toHaveBeenCalled();
    });
  });

  describe("removeMember", () => {
    it("throws Unauthorized when getCurrentUser returns null", async () => {
      mockGetCurrentUser.mockResolvedValue(null);

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Unauthorized");
    });

    it("throws when caller is analyst", async () => {
      mockGetUserPortcoRole.mockResolvedValue("analyst");

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Only admins and owners can remove members");
    });

    it("throws when caller is viewer", async () => {
      mockGetUserPortcoRole.mockResolvedValue("viewer");

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Only admins and owners can remove members");
    });

    it("throws when membership not found", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([]); // empty select

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-999", "portco-001", "test-portco")
      ).rejects.toThrow("Membership not found");
    });

    it("throws when membership belongs to different portco", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([{ ...targetMembership, portcoId: "other-portco" }]);

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Membership doesn't belong to this portco");
    });

    it("throws when trying to remove yourself", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([{ ...targetMembership, userId: mockUser.id }]);

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Cannot remove yourself");
    });

    it("throws when admin tries to remove another admin", async () => {
      mockGetUserPortcoRole.mockResolvedValue("admin");
      dbResults.push([{ ...targetMembership, role: "admin" }]);

      const { removeMember } = await import("./team");
      await expect(
        removeMember("membership-002", "portco-001", "test-portco")
      ).rejects.toThrow("Cannot remove a member with equal or higher role");
    });

    it("allows owner to remove an admin", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([{ ...targetMembership, role: "admin" }]); // select
      dbResults.push(undefined); // delete

      const { removeMember } = await import("./team");
      await removeMember("membership-002", "portco-001", "test-portco");

      expect(dbCallTracker.delete).toHaveBeenCalled();
    });

    it("allows owner to remove another owner", async () => {
      mockGetUserPortcoRole.mockResolvedValue("owner");
      dbResults.push([{ ...targetMembership, role: "owner" }]); // select
      dbResults.push(undefined); // delete

      const { removeMember } = await import("./team");
      await removeMember("membership-002", "portco-001", "test-portco");

      expect(dbCallTracker.delete).toHaveBeenCalled();
    });
  });
});
