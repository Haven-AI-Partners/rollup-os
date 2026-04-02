import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──
const mockUpload = vi.hoisted(() => vi.fn());
const mockGetPublicUrl = vi.hoisted(() => vi.fn());

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        getPublicUrl: mockGetPublicUrl,
      })),
    },
  })),
}));

// Set required env vars before import
process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";

import { uploadTranslatedFile } from "./index";

describe("uploadTranslatedFile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads buffer and returns public URL", async () => {
    mockUpload.mockResolvedValue({ error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: "https://test.supabase.co/storage/v1/object/public/translated-files/p1/f1/test.xlsx" },
    });

    const result = await uploadTranslatedFile(
      "p1",
      "f1",
      Buffer.from("test"),
      "test.xlsx",
    );

    expect(mockUpload).toHaveBeenCalledWith(
      "p1/f1/test.xlsx",
      Buffer.from("test"),
      {
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: true,
      },
    );
    expect(result).toBe(
      "https://test.supabase.co/storage/v1/object/public/translated-files/p1/f1/test.xlsx",
    );
  });

  it("throws on upload error", async () => {
    mockUpload.mockResolvedValue({
      error: { message: "Bucket not found" },
    });

    await expect(
      uploadTranslatedFile("p1", "f1", Buffer.from("test"), "test.xlsx"),
    ).rejects.toThrow("Failed to upload translated file: Bucket not found");
  });

  it("throws when env vars are missing", async () => {
    const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Re-import to get fresh module with missing env vars
    vi.resetModules();
    const { uploadTranslatedFile: upload } = await import("./index");

    await expect(
      upload("p1", "f1", Buffer.from("test"), "test.xlsx"),
    ).rejects.toThrow("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
  });
});
