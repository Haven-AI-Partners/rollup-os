import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn().mockResolvedValue(mockUser),
}));

vi.mock("@/lib/db", () => {
  const chainFn = vi.fn();
  const chain: any = new Proxy({}, {
    get() {
      chainFn.mockReturnValue(chain);
      return chainFn;
    },
  });
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  brokerFirms: { id: "id", name: "name" },
  brokerContacts: { id: "id", brokerFirmId: "brokerFirmId", fullName: "fullName" },
  brokerInteractions: { id: "id", brokerContactId: "brokerContactId", occurredAt: "occurredAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
  count: vi.fn(),
  asc: vi.fn(),
  desc: vi.fn(),
}));

import { getCurrentUser } from "@/lib/auth";

describe("broker actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getCurrentUser as any).mockResolvedValue(mockUser);
  });

  describe("createBrokerFirm", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { createBrokerFirm } = await import("./brokers");
      await expect(
        createBrokerFirm("test-portco", { name: "Test Broker" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("updateBrokerFirm", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { updateBrokerFirm } = await import("./brokers");
      await expect(
        updateBrokerFirm("firm-001", "test-portco", { name: "Updated" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteBrokerFirm", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { deleteBrokerFirm } = await import("./brokers");
      await expect(
        deleteBrokerFirm("firm-001", "test-portco")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("createBrokerContact", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { createBrokerContact } = await import("./brokers");
      await expect(
        createBrokerContact("firm-001", "test-portco", { fullName: "John" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteBrokerContact", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { deleteBrokerContact } = await import("./brokers");
      await expect(
        deleteBrokerContact("contact-001", "test-portco", "firm-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("createInteraction", () => {
    it("throws when user is not authenticated", async () => {
      (getCurrentUser as any).mockResolvedValue(null);

      const { createInteraction } = await import("./brokers");
      await expect(
        createInteraction("portco-001", "test-portco", "firm-001", {
          brokerContactId: "contact-001",
          type: "email_sent",
          occurredAt: "2024-01-01",
        })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
