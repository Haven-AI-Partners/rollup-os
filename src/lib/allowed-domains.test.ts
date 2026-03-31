import { describe, it, expect } from "vitest";
import { ALLOWED_DOMAINS, isAllowedEmail } from "./allowed-domains";

describe("ALLOWED_DOMAINS", () => {
  it("contains exactly 3 domains", () => {
    expect(ALLOWED_DOMAINS).toHaveLength(3);
    expect(ALLOWED_DOMAINS).toContain("wayequity.co");
    expect(ALLOWED_DOMAINS).toContain("rengapartners.com");
    expect(ALLOWED_DOMAINS).toContain("havenaipartners.com");
  });
});

describe("isAllowedEmail", () => {
  it("returns true for wayequity.co", () => {
    expect(isAllowedEmail("user@wayequity.co")).toBe(true);
  });

  it("returns true for rengapartners.com", () => {
    expect(isAllowedEmail("user@rengapartners.com")).toBe(true);
  });

  it("returns true for havenaipartners.com", () => {
    expect(isAllowedEmail("user@havenaipartners.com")).toBe(true);
  });

  it("returns false for gmail.com", () => {
    expect(isAllowedEmail("user@gmail.com")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isAllowedEmail("")).toBe(false);
  });

  it("returns false for string without @", () => {
    expect(isAllowedEmail("noemail")).toBe(false);
  });

  it("is case-insensitive for domain", () => {
    expect(isAllowedEmail("user@WAYEQUITY.CO")).toBe(true);
    expect(isAllowedEmail("user@WayEquity.Co")).toBe(true);
  });
});
