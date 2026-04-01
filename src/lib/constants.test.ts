import { describe, it, expect } from "vitest";
import { stdDevBadgeColor, flagAgreementBadgeColor } from "./constants";

describe("stdDevBadgeColor", () => {
  it("returns green for low values", () => {
    expect(stdDevBadgeColor(0.1)).toContain("green");
    expect(stdDevBadgeColor(0.2)).toContain("green");
  });

  it("returns amber for medium values", () => {
    expect(stdDevBadgeColor(0.3)).toContain("amber");
    expect(stdDevBadgeColor(0.5)).toContain("amber");
  });

  it("returns red for high values", () => {
    expect(stdDevBadgeColor(0.6)).toContain("red");
    expect(stdDevBadgeColor(1.0)).toContain("red");
  });
});

describe("flagAgreementBadgeColor", () => {
  it("returns green for high agreement", () => {
    expect(flagAgreementBadgeColor(0.8)).toContain("green");
    expect(flagAgreementBadgeColor(0.7)).toContain("green");
  });

  it("returns amber for medium agreement", () => {
    expect(flagAgreementBadgeColor(0.5)).toContain("amber");
    expect(flagAgreementBadgeColor(0.4)).toContain("amber");
  });

  it("returns red for low agreement", () => {
    expect(flagAgreementBadgeColor(0.3)).toContain("red");
    expect(flagAgreementBadgeColor(0.0)).toContain("red");
  });
});
