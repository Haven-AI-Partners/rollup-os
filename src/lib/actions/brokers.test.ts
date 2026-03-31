import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockSelect, mockInsert, mockUpdate, mockDelete, mockFrom, mockWhere, mockValues, mockReturning, mockOrderBy, mockGroupBy, mockInnerJoin, mockSet, mockLimit } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockDelete: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockOrderBy: vi.fn(),
  mockGroupBy: vi.fn(),
  mockInnerJoin: vi.fn(),
  mockSet: vi.fn(),
  mockLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
  getPortcoBySlug: vi.fn().mockResolvedValue({ id: "portco-001", slug: "test-portco" }),
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    from: mockFrom,
    where: mockWhere,
    values: mockValues,
    returning: mockReturning,
    orderBy: mockOrderBy,
    groupBy: mockGroupBy,
    innerJoin: mockInnerJoin,
    set: mockSet,
    limit: mockLimit,
  });
  for (const fn of [mockSelect, mockInsert, mockUpdate, mockDelete, mockFrom, mockWhere, mockValues, mockReturning, mockOrderBy, mockGroupBy, mockInnerJoin, mockSet, mockLimit]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  brokerFirms: { id: "id", name: "name" },
  brokerContacts: { id: "id", brokerFirmId: "brokerFirmId", fullName: "fullName" },
  brokerInteractions: { id: "id", brokerContactId: "brokerContactId", occurredAt: "occurredAt" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  count: vi.fn((col) => ({ type: "count", col })),
  asc: vi.fn(),
  desc: vi.fn(),
  inArray: vi.fn((col, vals) => ({ type: "inArray", col, vals })),
}));

import { requireAuth, requirePortcoRole } from "@/lib/auth";

describe("broker actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue(mockUser);
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
  });

  describe("getBrokerFirms", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getBrokerFirms } = await import("./brokers");
      await expect(getBrokerFirms()).rejects.toThrow("Unauthorized");
    });

    it("returns enriched firms with contact and interaction counts", async () => {
      const firms = [{ id: "firm-1", name: "Firm A" }];
      mockOrderBy.mockResolvedValueOnce(firms);
      mockGroupBy.mockResolvedValueOnce([{ brokerFirmId: "firm-1", count: 3 }]);
      mockGroupBy.mockResolvedValueOnce([{ brokerFirmId: "firm-1", count: 5 }]);

      const { getBrokerFirms } = await import("./brokers");
      const result = await getBrokerFirms();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "firm-1", contactCount: 3, interactionCount: 5 });
    });

    it("returns empty array when no firms exist", async () => {
      mockOrderBy.mockResolvedValueOnce([]);

      const { getBrokerFirms } = await import("./brokers");
      const result = await getBrokerFirms();

      expect(result).toEqual([]);
    });
  });

  describe("createBrokerFirm", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { createBrokerFirm } = await import("./brokers");
      await expect(
        createBrokerFirm("test-portco", { name: "Test Broker" })
      ).rejects.toThrow("Unauthorized");
    });

    it("creates a firm and returns it", async () => {
      const mockFirm = { id: "firm-001", name: "Test Broker" };
      mockReturning.mockResolvedValueOnce([mockFirm]);

      const { createBrokerFirm } = await import("./brokers");
      const result = await createBrokerFirm("test-portco", { name: "Test Broker" });

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(mockFirm);
    });
  });

  describe("updateBrokerFirm", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateBrokerFirm } = await import("./brokers");
      await expect(
        updateBrokerFirm("firm-001", "test-portco", { name: "Updated" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteBrokerFirm", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { deleteBrokerFirm } = await import("./brokers");
      await expect(
        deleteBrokerFirm("firm-001", "test-portco")
      ).rejects.toThrow("Unauthorized");
    });

    it("deletes interactions, contacts, then firm in order", async () => {
      // Mock finding contacts
      mockWhere.mockResolvedValueOnce([{ id: "contact-1" }, { id: "contact-2" }]);
      // Mock delete operations
      mockWhere.mockResolvedValueOnce(undefined); // delete interactions
      mockWhere.mockResolvedValueOnce(undefined); // delete contacts
      mockWhere.mockResolvedValueOnce(undefined); // delete firm

      const { deleteBrokerFirm } = await import("./brokers");
      await deleteBrokerFirm("firm-001", "test-portco");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "admin");
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("createBrokerContact", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { createBrokerContact } = await import("./brokers");
      await expect(
        createBrokerContact("firm-001", "test-portco", { fullName: "John" })
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("deleteBrokerContact", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { deleteBrokerContact } = await import("./brokers");
      await expect(
        deleteBrokerContact("contact-001", "test-portco", "firm-001")
      ).rejects.toThrow("Unauthorized");
    });
  });

  describe("getBrokerFirm", () => {
    it("returns firm when found", async () => {
      const firm = { id: "firm-001", name: "Test Firm" };
      mockLimit.mockResolvedValueOnce([firm]);

      const { getBrokerFirm } = await import("./brokers");
      const result = await getBrokerFirm("firm-001");
      expect(result).toEqual(firm);
    });

    it("returns null when firm not found", async () => {
      mockLimit.mockResolvedValueOnce([]);

      const { getBrokerFirm } = await import("./brokers");
      const result = await getBrokerFirm("firm-999");
      expect(result).toBeNull();
    });
  });

  describe("getContactsForFirm", () => {
    it("returns contacts for a firm", async () => {
      const contacts = [{ id: "c1", fullName: "John" }];
      mockOrderBy.mockResolvedValueOnce(contacts);

      const { getContactsForFirm } = await import("./brokers");
      const result = await getContactsForFirm("firm-001");
      expect(result).toEqual(contacts);
    });
  });

  describe("updateBrokerFirm", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { updateBrokerFirm } = await import("./brokers");
      await expect(
        updateBrokerFirm("firm-001", "test-portco", { name: "Updated" })
      ).rejects.toThrow("Unauthorized");
    });

    it("updates a firm successfully", async () => {
      const updated = { id: "firm-001", name: "Updated Firm" };
      mockReturning.mockResolvedValueOnce([updated]);

      const { updateBrokerFirm } = await import("./brokers");
      const result = await updateBrokerFirm("firm-001", "test-portco", { name: "Updated Firm" });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe("createBrokerContact", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { createBrokerContact } = await import("./brokers");
      await expect(
        createBrokerContact("firm-001", "test-portco", { fullName: "John" })
      ).rejects.toThrow("Unauthorized");
    });

    it("creates a contact successfully", async () => {
      const contact = { id: "c1", fullName: "John Doe" };
      mockReturning.mockResolvedValueOnce([contact]);

      const { createBrokerContact } = await import("./brokers");
      const result = await createBrokerContact("firm-001", "test-portco", { fullName: "John Doe" });

      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(contact);
    });
  });

  describe("updateBrokerContact", () => {
    it("updates a contact successfully", async () => {
      const updated = { id: "c1", fullName: "Jane Doe" };
      mockReturning.mockResolvedValueOnce([updated]);

      const { updateBrokerContact } = await import("./brokers");
      const result = await updateBrokerContact("c1", "test-portco", "firm-001", { fullName: "Jane Doe" });

      expect(mockUpdate).toHaveBeenCalled();
      expect(result).toEqual(updated);
    });
  });

  describe("deleteBrokerContact", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { deleteBrokerContact } = await import("./brokers");
      await expect(
        deleteBrokerContact("contact-001", "test-portco", "firm-001")
      ).rejects.toThrow("Unauthorized");
    });

    it("deletes interactions then contact", async () => {
      const { deleteBrokerContact } = await import("./brokers");
      await deleteBrokerContact("contact-001", "test-portco", "firm-001");

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "admin");
      expect(mockDelete).toHaveBeenCalled();
    });
  });

  describe("getInteractionsForFirm", () => {
    it("returns interactions for a firm", async () => {
      const interactions = [{ id: "i1", type: "call", contactName: "John" }];
      mockOrderBy.mockResolvedValueOnce(interactions);

      const { getInteractionsForFirm } = await import("./brokers");
      const result = await getInteractionsForFirm("firm-001");
      expect(result).toEqual(interactions);
    });
  });

  describe("createInteraction", () => {
    it("throws when user is not authorized", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { createInteraction } = await import("./brokers");
      await expect(
        createInteraction("portco-001", "test-portco", "firm-001", {
          brokerContactId: "a0000000-0000-1000-a000-000000000001",
          type: "email_sent",
          occurredAt: "2024-01-01",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("creates an interaction with correct data", async () => {
      const mockInteraction = { id: "interaction-001", type: "email_sent" };
      mockReturning.mockResolvedValueOnce([mockInteraction]);

      const { createInteraction } = await import("./brokers");
      const result = await createInteraction("portco-001", "test-portco", "firm-001", {
        brokerContactId: "a0000000-0000-1000-a000-000000000001",
        type: "call",
        occurredAt: "2024-06-15T10:00",
      });

      expect(requirePortcoRole).toHaveBeenCalledWith("portco-001", "analyst");
      expect(mockInsert).toHaveBeenCalled();
      expect(result).toEqual(mockInteraction);
    });
  });
});
