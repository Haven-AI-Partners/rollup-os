import { describe, it, expect, beforeAll } from "vitest";
import { createInterviewToken, validateInterviewSession } from "./interview-jwt";
import { NextRequest } from "next/server";

// Set a known secret for deterministic tests
beforeAll(() => {
  process.env.INTERVIEW_JWT_SECRET = "test-jwt-secret-for-unit-tests-1234";
});

function buildRequest(cookie?: string): NextRequest {
  const req = new NextRequest("https://example.com/api/test");
  if (cookie) {
    req.cookies.set("discovery_session", cookie);
  }
  return req;
}

describe("interview-jwt", () => {
  describe("createInterviewToken", () => {
    it("returns a non-empty string token", async () => {
      const token = await createInterviewToken("session-001");
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
    });

    it("creates a token that roundtrips through validateInterviewSession", async () => {
      const token = await createInterviewToken("session-roundtrip");
      const req = buildRequest(token);
      const sessionId = await validateInterviewSession(req);
      expect(sessionId).toBe("session-roundtrip");
    });
  });

  describe("validateInterviewSession", () => {
    it("returns sessionId when valid cookie is present", async () => {
      const token = await createInterviewToken("session-abc");
      const req = buildRequest(token);
      const result = await validateInterviewSession(req);
      expect(result).toBe("session-abc");
    });

    it("returns null when no discovery_session cookie exists", async () => {
      const req = buildRequest(); // no cookie
      const result = await validateInterviewSession(req);
      expect(result).toBeNull();
    });

    it("returns null when cookie contains an invalid token", async () => {
      const req = buildRequest("not-a-valid-jwt-token");
      const result = await validateInterviewSession(req);
      expect(result).toBeNull();
    });

    it("returns null when token is corrupted", async () => {
      const token = await createInterviewToken("session-001");
      // Corrupt the token by changing characters
      const corrupted = token.slice(0, -5) + "XXXXX";
      const req = buildRequest(corrupted);
      const result = await validateInterviewSession(req);
      expect(result).toBeNull();
    });
  });
});
