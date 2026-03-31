import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateAuthUrl = vi.fn();
const mockGetToken = vi.fn();
const mockSetCredentials = vi.fn();
const mockGetAccessToken = vi.fn().mockResolvedValue({ token: "access-token" });

vi.mock("googleapis/build/src/apis/drive", () => ({
  drive: vi.fn(() => ({ files: {}, about: {} })),
  auth: {
    OAuth2: class MockOAuth2 {
      generateAuthUrl = mockGenerateAuthUrl;
      getToken = mockGetToken;
      setCredentials = mockSetCredentials;
      getAccessToken = mockGetAccessToken;
    },
  },
}));

const { mockSelect, mockFrom, mockWhere, mockLimit, mockUpdate, mockSet } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockLimit: vi.fn(),
  mockUpdate: vi.fn(),
  mockSet: vi.fn(),
}));

vi.mock("@/lib/db", () => {
  const chain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    update: mockUpdate,
    set: mockSet,
  };
  mockSelect.mockReturnValue(chain);
  mockFrom.mockReturnValue(chain);
  mockWhere.mockReturnValue(chain);
  mockLimit.mockResolvedValue([]);
  mockUpdate.mockReturnValue(chain);
  mockSet.mockReturnValue(chain);
  return { db: chain };
});

vi.mock("@/lib/db/schema", () => ({
  portcos: {
    id: "id",
    slug: "slug",
    gdriveServiceAccountEnc: "gdriveServiceAccountEnc",
    gdriveFolderId: "gdriveFolderId",
  },
}));

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((a, b) => ({ a, b })),
}));

const mockDecrypt = vi.fn();
vi.mock("./crypto", () => ({
  decrypt: (...args: unknown[]) => mockDecrypt(...args),
  encrypt: vi.fn(() => "encrypted-token"),
}));

vi.mock("./rate-limit", () => ({
  withRateLimit: vi.fn((fn: () => unknown) => fn()),
  isAuthError: vi.fn((error: unknown) => {
    if (!(error && typeof error === "object")) return false;
    const message = (error as { message?: string }).message?.toLowerCase() ?? "";
    return ["invalid_request", "invalid_grant", "invalid_client", "invalid_token"]
      .some((msg) => message.includes(msg));
  }),
}));

describe("gdrive client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost/callback";

    mockSelect.mockReturnValue({ from: mockFrom });
    mockFrom.mockReturnValue({ where: mockWhere });
    mockWhere.mockReturnValue({ limit: mockLimit, set: mockSet });
    mockUpdate.mockReturnValue({ set: mockSet });
    mockSet.mockReturnValue({ where: mockWhere });
  });

  describe("getAuthUrl", () => {
    it("returns a URL string", async () => {
      mockGenerateAuthUrl.mockReturnValue("https://accounts.google.com/o/oauth2/auth?test=1");

      const { getAuthUrl } = await import("./client");
      const url = getAuthUrl("acme");
      expect(typeof url).toBe("string");
      expect(url).toContain("accounts.google.com");
      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          state: "acme",
          access_type: "offline",
        })
      );
    });
  });

  describe("getDriveClient", () => {
    it("returns null when portco has no encrypted token", async () => {
      mockLimit.mockResolvedValue([{ gdriveTokenEnc: null, gdriveFolderId: null }]);

      const { getDriveClient } = await import("./client");
      const result = await getDriveClient("portco-001");
      expect(result).toBeNull();
    });

    it("returns drive client when token exists", async () => {
      mockLimit.mockResolvedValue([
        { gdriveTokenEnc: "enc-token-123", gdriveFolderId: "folder-abc" },
      ]);
      mockDecrypt.mockReturnValue("decrypted-refresh-token");

      const { getDriveClient } = await import("./client");
      const result = await getDriveClient("portco-001");
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("drive");
      expect(result).toHaveProperty("folderId", "folder-abc");
      expect(mockDecrypt).toHaveBeenCalledWith("enc-token-123");
      expect(mockSetCredentials).toHaveBeenCalledWith({
        refresh_token: "decrypted-refresh-token",
      });
    });

    it("works without GOOGLE_REDIRECT_URI (not needed for refresh)", async () => {
      delete process.env.GOOGLE_REDIRECT_URI;
      mockLimit.mockResolvedValue([
        { gdriveTokenEnc: "enc-token-123", gdriveFolderId: "folder-abc" },
      ]);
      mockDecrypt.mockReturnValue("decrypted-refresh-token");

      const { getDriveClient } = await import("./client");
      const result = await getDriveClient("portco-001");
      expect(result).not.toBeNull();
      expect(result).toHaveProperty("drive");
    });

    it("throws GDriveAuthError when token refresh fails", async () => {
      mockLimit.mockResolvedValue([
        { gdriveTokenEnc: "enc-token-123", gdriveFolderId: "folder-abc" },
      ]);
      mockDecrypt.mockReturnValue("decrypted-refresh-token");
      mockGetAccessToken.mockRejectedValueOnce(new Error("invalid_grant"));

      const { getDriveClient } = await import("./client");
      await expect(getDriveClient("portco-001")).rejects.toThrow(
        /OAuth token refresh failed for portco=portco-001/,
      );
    });

    it("throws when GOOGLE_CLIENT_ID is missing", async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      mockLimit.mockResolvedValue([
        { gdriveTokenEnc: "enc-token-123", gdriveFolderId: "folder-abc" },
      ]);
      mockDecrypt.mockReturnValue("decrypted-refresh-token");

      const { getDriveClient } = await import("./client");
      await expect(getDriveClient("portco-001")).rejects.toThrow(
        "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET",
      );
    });

    it("throws when GOOGLE_CLIENT_SECRET is missing", async () => {
      delete process.env.GOOGLE_CLIENT_SECRET;
      mockLimit.mockResolvedValue([
        { gdriveTokenEnc: "enc-token-123", gdriveFolderId: "folder-abc" },
      ]);
      mockDecrypt.mockReturnValue("decrypted-refresh-token");

      const { getDriveClient } = await import("./client");
      await expect(getDriveClient("portco-001")).rejects.toThrow(
        "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET",
      );
    });
  });
});
