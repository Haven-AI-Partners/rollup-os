import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGenerateObject = vi.hoisted(() => vi.fn());
const mockGoogle = vi.hoisted(() => vi.fn(() => "mock-model"));
const mockDownloadFile = vi.hoisted(() => vi.fn());
const mockRenderPdfPages = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  generateObject: mockGenerateObject,
}));

vi.mock("@ai-sdk/google", () => ({
  google: mockGoogle,
}));

vi.mock("@/lib/gdrive/client", () => ({
  downloadFile: mockDownloadFile,
}));

vi.mock("@/lib/agents/shared/pdf-renderer", () => ({
  renderPdfPagesToImages: mockRenderPdfPages,
}));

// Import after mocks
const { classifyWithVision } = await import("./vision");

describe("classifyWithVision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseInput = {
    fileName: "document.pdf",
    mimeType: "application/pdf",
    parentPath: "Root/Files",
    portcoId: "portco-001",
    gdriveFileId: "gdrive-001",
  };

  it("sends page images to the LLM when PDF download succeeds", async () => {
    const mockBuffer = Buffer.from("fake-pdf");
    mockDownloadFile.mockResolvedValue(mockBuffer);
    mockRenderPdfPages.mockResolvedValue([
      { base64: "base64page1", mimeType: "image/png" },
      { base64: "base64page2", mimeType: "image/png" },
    ]);
    mockGenerateObject.mockResolvedValue({
      object: {
        fileType: "im_pdf",
        confidence: 0.92,
        suggestedCompanyName: "Acme Corp",
        reasoning: "Cover page shows IM for Acme Corp",
      },
    });

    const result = await classifyWithVision(baseInput);

    expect(result.fileType).toBe("im_pdf");
    expect(result.confidence).toBe(0.92);
    expect(result.suggestedCompanyName).toBe("Acme Corp");
    expect(mockDownloadFile).toHaveBeenCalledWith("portco-001", "gdrive-001");
    expect(mockRenderPdfPages).toHaveBeenCalledWith(mockBuffer, 3);

    // Verify images were included in the message
    const callArgs = mockGenerateObject.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent).toHaveLength(3); // 1 text + 2 images
    expect(userContent[1].type).toBe("image");
    expect(userContent[2].type).toBe("image");
  });

  it("falls back to metadata-only when download returns null", async () => {
    mockDownloadFile.mockResolvedValue(null);
    mockGenerateObject.mockResolvedValue({
      object: {
        fileType: "other",
        confidence: 0.5,
        suggestedCompanyName: null,
        reasoning: "Metadata only — insufficient signals",
      },
    });

    const result = await classifyWithVision(baseInput);

    expect(result.fileType).toBe("other");
    expect(mockRenderPdfPages).not.toHaveBeenCalled();

    // Verify no images in message
    const callArgs = mockGenerateObject.mock.calls[0][0];
    const userContent = callArgs.messages[0].content;
    expect(userContent).toHaveLength(1); // text only
  });

  it("falls back to metadata-only when download throws", async () => {
    mockDownloadFile.mockRejectedValue(new Error("Network error"));
    mockGenerateObject.mockResolvedValue({
      object: {
        fileType: "report",
        confidence: 0.6,
        suggestedCompanyName: null,
        reasoning: "Classified from metadata",
      },
    });

    const result = await classifyWithVision(baseInput);

    expect(result.fileType).toBe("report");
  });

  it("falls back to metadata-only when PDF render throws", async () => {
    mockDownloadFile.mockResolvedValue(Buffer.from("bad-pdf"));
    mockRenderPdfPages.mockRejectedValue(new Error("Invalid PDF"));
    mockGenerateObject.mockResolvedValue({
      object: {
        fileType: "attachment",
        confidence: 0.4,
        suggestedCompanyName: null,
        reasoning: "Could not read document",
      },
    });

    const result = await classifyWithVision(baseInput);

    expect(result.fileType).toBe("attachment");
  });
});
