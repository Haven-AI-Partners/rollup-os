import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockUser,
  mockPortco,
  mockRequirePortcoRole,
  mockGetPortcoBySlug,
  mockCreateThesisTree,
  mockSelect,
  mockInsert,
  mockUpdate,
  mockFrom,
  mockWhere,
  mockSet,
  mockValues,
  mockReturning,
  mockLimit,
  mockExecute,
} = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockPortco: { id: "portco-001", name: "Test PortCo", slug: "test-portco" },
  mockRequirePortcoRole: vi.fn(),
  mockGetPortcoBySlug: vi.fn(),
  mockCreateThesisTree: vi.fn(),
  mockSelect: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockSet: vi.fn(),
  mockValues: vi.fn(),
  mockReturning: vi.fn(),
  mockLimit: vi.fn(),
  mockExecute: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePortcoRole: mockRequirePortcoRole,
  getPortcoBySlug: mockGetPortcoBySlug,
}));

vi.mock("@/lib/thesis/create-tree", () => ({
  createThesisTreeForDeal: mockCreateThesisTree,
}));

vi.mock("@/lib/db", () => {
  const chain = () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    from: mockFrom,
    where: mockWhere,
    set: mockSet,
    values: mockValues,
    returning: mockReturning,
    limit: mockLimit,
    execute: mockExecute,
  });
  for (const fn of [
    mockSelect, mockInsert, mockUpdate, mockFrom,
    mockWhere, mockSet, mockValues, mockReturning, mockLimit,
  ]) {
    fn.mockReturnValue(chain());
  }
  return { db: chain() };
});

vi.mock("@/lib/db/schema", () => ({
  dealThesisNodes: { id: "id", templateNodeId: "templateNodeId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
  sql: vi.fn(),
}));

describe("thesis actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequirePortcoRole.mockResolvedValue({ user: mockUser, role: "analyst" });
    mockGetPortcoBySlug.mockResolvedValue(mockPortco);
  });

  describe("generateThesisTree", () => {
    it("requires analyst role", async () => {
      mockRequirePortcoRole.mockRejectedValue(new Error("Insufficient permissions"));

      const { generateThesisTree } = await import("./thesis");
      await expect(
        generateThesisTree("deal-001", "portco-001", "test-portco")
      ).rejects.toThrow("Insufficient permissions");
    });

    it("throws when thesis tree already exists (count === 0)", async () => {
      mockCreateThesisTree.mockResolvedValue(0);

      const { generateThesisTree } = await import("./thesis");
      await expect(
        generateThesisTree("deal-001", "portco-001", "test-portco")
      ).rejects.toThrow("Thesis tree already exists for this deal");
    });

    it("returns count on success", async () => {
      mockCreateThesisTree.mockResolvedValue(12);

      const { generateThesisTree } = await import("./thesis");
      const result = await generateThesisTree("deal-001", "portco-001", "test-portco");

      expect(result).toEqual({ count: 12 });
      expect(mockCreateThesisTree).toHaveBeenCalledWith("deal-001", "portco-001");
    });
  });

  describe("updateThesisNode", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { updateThesisNode } = await import("./thesis");
      await expect(
        updateThesisNode("node-001", "bad-slug", "deal-001", { status: "complete" })
      ).rejects.toThrow("PortCo not found");
    });

    it("requires analyst role", async () => {
      mockRequirePortcoRole.mockRejectedValue(new Error("Insufficient permissions"));

      const { updateThesisNode } = await import("./thesis");
      await expect(
        updateThesisNode("node-001", "test-portco", "deal-001", { status: "complete" })
      ).rejects.toThrow("Insufficient permissions");
    });

    it("calls db.update with merged data and updatedAt", async () => {
      mockWhere.mockResolvedValueOnce(undefined);

      const { updateThesisNode } = await import("./thesis");
      await updateThesisNode("node-001", "test-portco", "deal-001", {
        status: "complete",
        value: "100M",
      });

      expect(mockUpdate).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
      const setArg = mockSet.mock.calls[0][0];
      expect(setArg.status).toBe("complete");
      expect(setArg.value).toBe("100M");
      expect(setArg.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("addThesisNode", () => {
    it("requires analyst role", async () => {
      mockRequirePortcoRole.mockRejectedValue(new Error("Insufficient permissions"));

      const { addThesisNode } = await import("./thesis");
      await expect(
        addThesisNode("deal-001", "portco-001", "test-portco", {
          parentId: "parent-001",
          label: "Custom Node",
        })
      ).rejects.toThrow("Insufficient permissions");
    });

    it("inserts node with correct defaults and returns it", async () => {
      const insertedNode = { id: "node-new-001" };
      mockReturning.mockResolvedValueOnce([insertedNode]);

      const { addThesisNode } = await import("./thesis");
      const result = await addThesisNode("deal-001", "portco-001", "test-portco", {
        parentId: "parent-001",
        label: "Custom Node",
        description: "A custom thesis node",
      });

      expect(mockInsert).toHaveBeenCalled();
      expect(mockValues).toHaveBeenCalledWith({
        dealId: "deal-001",
        portcoId: "portco-001",
        parentId: "parent-001",
        label: "Custom Node",
        description: "A custom thesis node",
        sortOrder: 0,
        source: "manual",
      });
      expect(result).toEqual(insertedNode);
    });

    it("uses default sortOrder 0 and null description when not provided", async () => {
      mockReturning.mockResolvedValueOnce([{ id: "node-002" }]);

      const { addThesisNode } = await import("./thesis");
      await addThesisNode("deal-001", "portco-001", "test-portco", {
        parentId: "parent-001",
        label: "Minimal Node",
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          sortOrder: 0,
          description: null,
          source: "manual",
        })
      );
    });
  });

  describe("removeThesisNode", () => {
    it("throws when portco not found", async () => {
      mockGetPortcoBySlug.mockResolvedValue(null);

      const { removeThesisNode } = await import("./thesis");
      await expect(
        removeThesisNode("node-001", "bad-slug", "deal-001")
      ).rejects.toThrow("PortCo not found");
    });

    it("requires admin role", async () => {
      mockRequirePortcoRole.mockRejectedValue(new Error("Insufficient permissions"));

      const { removeThesisNode } = await import("./thesis");
      await expect(
        removeThesisNode("node-001", "test-portco", "deal-001")
      ).rejects.toThrow("Insufficient permissions");
    });

    it("throws when trying to delete a template node", async () => {
      mockLimit.mockResolvedValueOnce([{ templateNodeId: "template-001" }]);

      const { removeThesisNode } = await import("./thesis");
      await expect(
        removeThesisNode("node-001", "test-portco", "deal-001")
      ).rejects.toThrow("Cannot delete base template nodes");
    });

    it("executes recursive SQL delete for non-template nodes", async () => {
      mockLimit.mockResolvedValueOnce([{ templateNodeId: null }]);
      mockExecute.mockResolvedValueOnce(undefined);

      const { removeThesisNode } = await import("./thesis");
      await removeThesisNode("node-001", "test-portco", "deal-001");

      expect(mockExecute).toHaveBeenCalled();
    });
  });
});
