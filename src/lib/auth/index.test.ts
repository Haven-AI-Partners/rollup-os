import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockClerkUser, mockDbUser, mockPortco, mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin, mockCurrentUser } = vi.hoisted(() => ({
  mockClerkUser: { id: "clerk-001" },
  mockDbUser: {
    id: "user-001",
    clerkId: "clerk-001",
    email: "test@example.com",
    fullName: "Test User",
    avatarUrl: null,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  mockPortco: {
    id: "portco-001",
    name: "Test PortCo",
    slug: "test-portco",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  },
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockCurrentUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  currentUser: mockCurrentUser,
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    innerJoin: mockInnerJoin,
  });
  for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  users: { id: "id", clerkId: "clerkId" },
  portcos: { id: "id", slug: "slug" },
  portcoMemberships: { userId: "userId", portcoId: "portcoId", role: "role" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ type: "eq", a, b })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
}));

import {
  getCurrentUser,
  getUserPortcos,
  getUserPortcoRole,
  getPortcoBySlug,
  hasMinRole,
  requireAuth,
  requirePortcoRole,
  type UserRole,
} from "./index";

describe("auth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUser.mockResolvedValue(mockClerkUser);
    for (const fn of [mockSelect, mockFrom, mockWhere, mockLimit, mockInnerJoin]) {
      fn.mockReturnValue({
        select: mockSelect,
        from: mockFrom,
        where: mockWhere,
        limit: mockLimit,
        innerJoin: mockInnerJoin,
      });
    }
  });

  describe("hasMinRole", () => {
    const roles: UserRole[] = ["viewer", "analyst", "admin", "owner"];

    it("owner has all roles", () => {
      for (const required of roles) {
        expect(hasMinRole("owner", required)).toBe(true);
      }
    });

    it("admin has admin, analyst, viewer but not owner", () => {
      expect(hasMinRole("admin", "viewer")).toBe(true);
      expect(hasMinRole("admin", "analyst")).toBe(true);
      expect(hasMinRole("admin", "admin")).toBe(true);
      expect(hasMinRole("admin", "owner")).toBe(false);
    });

    it("analyst has analyst, viewer but not admin or owner", () => {
      expect(hasMinRole("analyst", "viewer")).toBe(true);
      expect(hasMinRole("analyst", "analyst")).toBe(true);
      expect(hasMinRole("analyst", "admin")).toBe(false);
    });

    it("viewer only has viewer", () => {
      expect(hasMinRole("viewer", "viewer")).toBe(true);
      expect(hasMinRole("viewer", "analyst")).toBe(false);
      expect(hasMinRole("viewer", "admin")).toBe(false);
      expect(hasMinRole("viewer", "owner")).toBe(false);
    });
  });

  describe("getCurrentUser", () => {
    it("returns user when clerk user and DB user exist", async () => {
      mockLimit.mockResolvedValueOnce([mockDbUser]);
      const result = await getCurrentUser();
      expect(result).toEqual(mockDbUser);
    });

    it("returns null when no clerk user", async () => {
      mockCurrentUser.mockResolvedValue(null);
      const result = await getCurrentUser();
      expect(result).toBeNull();
    });

    it("returns null when no DB user found", async () => {
      mockLimit.mockResolvedValueOnce([]);
      const result = await getCurrentUser();
      expect(result).toBeNull();
    });
  });

  describe("getUserPortcos", () => {
    it("returns portco memberships for a user", async () => {
      const memberships = [{ membership: { role: "admin" }, portco: mockPortco }];
      mockWhere.mockResolvedValueOnce(memberships);

      const result = await getUserPortcos("user-001");
      expect(result).toEqual(memberships);
    });
  });

  describe("getUserPortcoRole", () => {
    it("returns role when membership exists", async () => {
      mockLimit.mockResolvedValueOnce([{ role: "admin" }]);
      const result = await getUserPortcoRole("user-001", "portco-001");
      expect(result).toBe("admin");
    });

    it("returns null when no membership", async () => {
      mockLimit.mockResolvedValueOnce([]);
      const result = await getUserPortcoRole("user-001", "portco-999");
      expect(result).toBeNull();
    });
  });

  describe("getPortcoBySlug", () => {
    it("returns portco when found", async () => {
      mockLimit.mockResolvedValueOnce([mockPortco]);
      const result = await getPortcoBySlug("test-portco");
      expect(result).toEqual(mockPortco);
    });

    it("returns null when not found", async () => {
      mockLimit.mockResolvedValueOnce([]);
      const result = await getPortcoBySlug("unknown");
      expect(result).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("returns user when authenticated", async () => {
      mockLimit.mockResolvedValueOnce([mockDbUser]);
      const result = await requireAuth();
      expect(result).toEqual(mockDbUser);
    });

    it("throws Unauthorized when no user", async () => {
      mockCurrentUser.mockResolvedValue(null);
      await expect(requireAuth()).rejects.toThrow("Unauthorized");
    });
  });

  describe("requirePortcoRole", () => {
    it("returns user and role when authorized", async () => {
      mockLimit.mockResolvedValueOnce([mockDbUser]); // requireAuth -> getCurrentUser
      mockLimit.mockResolvedValueOnce([{ role: "admin" }]); // getUserPortcoRole

      const result = await requirePortcoRole("portco-001", "analyst");
      expect(result).toEqual({ user: mockDbUser, role: "admin" });
    });

    it("throws when user is not a member", async () => {
      mockLimit.mockResolvedValueOnce([mockDbUser]);
      mockLimit.mockResolvedValueOnce([]); // no membership

      await expect(requirePortcoRole("portco-001", "analyst")).rejects.toThrow(
        "Not a member of this PortCo"
      );
    });

    it("throws when role is insufficient", async () => {
      mockLimit.mockResolvedValueOnce([mockDbUser]);
      mockLimit.mockResolvedValueOnce([{ role: "viewer" }]);

      await expect(requirePortcoRole("portco-001", "admin")).rejects.toThrow(
        "Insufficient permissions"
      );
    });
  });
});
