import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockUser, mockListFiles } = vi.hoisted(() => ({
  mockUser: { id: "user-001", clerkId: "clerk-001", email: "test@example.com", fullName: "Test User" },
  mockListFiles: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue(mockUser),
}));

vi.mock("@/lib/gdrive/client", () => ({
  listFiles: mockListFiles,
}));

import { requireAuth } from "@/lib/auth";

describe("gdrive actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAuth as any).mockResolvedValue(mockUser);
  });

  describe("getGdriveFiles", () => {
    it("requires authentication", async () => {
      (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

      const { getGdriveFiles } = await import("./gdrive");
      await expect(getGdriveFiles("portco-001")).rejects.toThrow("Unauthorized");
    });

    it("returns null when listFiles returns null", async () => {
      mockListFiles.mockResolvedValue(null);

      const { getGdriveFiles } = await import("./gdrive");
      const result = await getGdriveFiles("portco-001");

      expect(result).toBeNull();
    });

    it("maps file fields correctly", async () => {
      mockListFiles.mockResolvedValue({
        files: [
          {
            id: "gdrive-001",
            name: "IM_TestCorp.pdf",
            mimeType: "application/pdf",
            size: "1024",
            modifiedTime: "2024-01-15T10:00:00Z",
            webViewLink: "https://drive.google.com/file/d/gdrive-001",
            iconLink: "https://drive.google.com/icon.png",
          },
        ],
        nextPageToken: "token-2",
      });

      const { getGdriveFiles } = await import("./gdrive");
      const result = await getGdriveFiles("portco-001");

      expect(result).toEqual({
        files: [
          {
            id: "gdrive-001",
            name: "IM_TestCorp.pdf",
            mimeType: "application/pdf",
            size: "1024",
            modifiedTime: "2024-01-15T10:00:00Z",
            webViewLink: "https://drive.google.com/file/d/gdrive-001",
            iconLink: "https://drive.google.com/icon.png",
          },
        ],
        nextPageToken: "token-2",
      });
    });

    it("handles missing optional fields with defaults", async () => {
      mockListFiles.mockResolvedValue({
        files: [{ id: undefined, name: undefined, mimeType: undefined }],
        nextPageToken: undefined,
      });

      const { getGdriveFiles } = await import("./gdrive");
      const result = await getGdriveFiles("portco-001");

      expect(result!.files[0]).toEqual({
        id: "",
        name: "Untitled",
        mimeType: "",
        size: null,
        modifiedTime: null,
        webViewLink: null,
        iconLink: null,
      });
      expect(result!.nextPageToken).toBeNull();
    });

    it("passes pageToken to listFiles", async () => {
      mockListFiles.mockResolvedValue({ files: [], nextPageToken: null });

      const { getGdriveFiles } = await import("./gdrive");
      await getGdriveFiles("portco-001", "page-token-123");

      expect(mockListFiles).toHaveBeenCalledWith("portco-001", 50, "page-token-123");
    });
  });
});
