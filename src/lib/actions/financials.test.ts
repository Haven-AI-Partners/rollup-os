import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
}));

vi.mock("@/lib/auth", () => ({
  requirePortcoRole: vi.fn().mockResolvedValue({ user: mockUser, role: "analyst" }),
}));

const dbResults: unknown[] = [];
const dbCallTracker = {
  insert: vi.fn(),
  values: vi.fn(),
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
            return { then: () => {} };
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
  dealFinancials: { dealId: "dealId" },
  dealActivityLog: { dealId: "dealId" },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

import { requirePortcoRole } from "@/lib/auth";

describe("financials actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbResults.length = 0;
    (requirePortcoRole as any).mockResolvedValue({ user: mockUser, role: "analyst" });
  });

  describe("addFinancialEntry", () => {
    it("throws when user is not authenticated", async () => {
      (requirePortcoRole as any).mockRejectedValue(new Error("Unauthorized"));

      const { addFinancialEntry } = await import("./financials");
      await expect(
        addFinancialEntry("deal-001", "portco-001", "test-portco", {
          period: "2024-Q1",
          periodType: "quarterly",
          revenue: "100000000",
        })
      ).rejects.toThrow("Unauthorized");
    });

    it("rejects invalid periodType", async () => {
      const { addFinancialEntry } = await import("./financials");
      await expect(
        addFinancialEntry("deal-001", "portco-001", "test-portco", {
          period: "2024-Q1",
          periodType: "invalid" as any,
        })
      ).rejects.toThrow();
    });

    it("rejects missing period", async () => {
      const { addFinancialEntry } = await import("./financials");
      await expect(
        addFinancialEntry("deal-001", "portco-001", "test-portco", {
          period: "",
          periodType: "quarterly",
        })
      ).rejects.toThrow();
    });

    it("inserts entry with source manual and logs activity", async () => {
      const entry = { id: "entry-001", period: "2024-Q1", periodType: "quarterly" };
      dbResults.push([entry]); // insert returning
      dbResults.push(undefined); // activity log insert

      const { addFinancialEntry } = await import("./financials");
      const result = await addFinancialEntry("deal-001", "portco-001", "test-portco", {
        period: "2024-Q1",
        periodType: "quarterly",
        revenue: "50000000",
      });

      expect(dbCallTracker.insert).toHaveBeenCalled();
      expect(dbCallTracker.values).toHaveBeenCalled();
      // Check that source is "manual" in the first values call
      const firstValuesCall = dbCallTracker.values.mock.calls[0][0];
      expect(firstValuesCall.source).toBe("manual");
      expect(result).toEqual(entry);
    });

    it("returns the created entry", async () => {
      const entry = { id: "entry-002", period: "2024-01", periodType: "monthly" };
      dbResults.push([entry]);
      dbResults.push(undefined);

      const { addFinancialEntry } = await import("./financials");
      const result = await addFinancialEntry("deal-001", "portco-001", "test-portco", {
        period: "2024-01",
        periodType: "monthly",
      });

      expect(result).toEqual(entry);
    });
  });
});
