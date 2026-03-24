import { describe, it, expect } from "vitest";
import { hasMinRole, type UserRole } from "./index";

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
    expect(hasMinRole("analyst", "owner")).toBe(false);
  });

  it("viewer only has viewer", () => {
    expect(hasMinRole("viewer", "viewer")).toBe(true);
    expect(hasMinRole("viewer", "analyst")).toBe(false);
    expect(hasMinRole("viewer", "admin")).toBe(false);
    expect(hasMinRole("viewer", "owner")).toBe(false);
  });

  it("same role always passes", () => {
    for (const role of roles) {
      expect(hasMinRole(role, role)).toBe(true);
    }
  });

  it("covers all 16 combinations correctly", () => {
    const expected: Record<string, boolean> = {
      "owner-owner": true,
      "owner-admin": true,
      "owner-analyst": true,
      "owner-viewer": true,
      "admin-owner": false,
      "admin-admin": true,
      "admin-analyst": true,
      "admin-viewer": true,
      "analyst-owner": false,
      "analyst-admin": false,
      "analyst-analyst": true,
      "analyst-viewer": true,
      "viewer-owner": false,
      "viewer-admin": false,
      "viewer-analyst": false,
      "viewer-viewer": true,
    };

    for (const [key, value] of Object.entries(expected)) {
      const [user, required] = key.split("-") as [UserRole, UserRole];
      expect(hasMinRole(user, required)).toBe(value);
    }
  });
});
