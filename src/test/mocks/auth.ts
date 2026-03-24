import { vi } from "vitest";

export const mockUser = {
  id: "user-001",
  clerkId: "clerk-001",
  email: "test@example.com",
  fullName: "Test User",
  avatarUrl: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

export const mockPortco = {
  id: "portco-001",
  name: "Test PortCo",
  slug: "test-portco",
  gdriveFolderId: null,
  gdriveServiceAccountEnc: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

/**
 * Sets up auth mocks. Call in beforeEach.
 * Returns mock functions for customization.
 */
export function setupAuthMocks() {
  const getCurrentUser = vi.fn().mockResolvedValue(mockUser);
  const getPortcoBySlug = vi.fn().mockResolvedValue(mockPortco);
  const getUserPortcoRole = vi.fn().mockResolvedValue("admin");
  const getUserPortcos = vi.fn().mockResolvedValue([]);
  const hasMinRole = vi.fn().mockReturnValue(true);

  vi.doMock("@/lib/auth", () => ({
    getCurrentUser,
    getPortcoBySlug,
    getUserPortcoRole,
    getUserPortcos,
    hasMinRole,
  }));

  return { getCurrentUser, getPortcoBySlug, getUserPortcoRole, getUserPortcos, hasMinRole };
}
