import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ContentExtractionResult } from "./schema";

const mockRenderPdfPagesToImages = vi.hoisted(() =>
  vi.fn().mockResolvedValue([
    { base64: "img-page-1", mimeType: "image/png" },
    { base64: "img-page-2", mimeType: "image/png" },
    { base64: "img-page-3", mimeType: "image/png" },
  ]),
);

vi.mock("ai", () => ({
  generateObject: vi.fn().mockResolvedValue({
    object: {
      pages: [
        { pageNumber: 1, content: "# Title", hasDiagram: false },
        { pageNumber: 2, content: "[Chart: Bar chart — Revenue]", hasDiagram: true },
      ],
      metadata: { totalPages: 2, documentLanguage: "en", documentTitle: "Test" },
    },
  }),
}));

vi.mock("@ai-sdk/google", () => ({
  google: vi.fn().mockReturnValue("mock-model"),
}));

vi.mock("./prompt", () => ({
  buildContentExtractionPrompt: vi.fn().mockResolvedValue("system prompt"),
}));

vi.mock("@/lib/agents/shared/pdf-renderer", () => ({
  renderPdfPagesToImages: mockRenderPdfPagesToImages,
}));

describe("extractDiagramDescription", () => {
  let extractDiagramDescription: (content: string) => string;

  beforeEach(async () => {
    const mod = await import("./index");
    extractDiagramDescription = mod.extractDiagramDescription;
  });

  it("extracts Chart description", () => {
    expect(extractDiagramDescription("[Chart: Bar chart — Revenue by FY]")).toBe(
      "Bar chart — Revenue by FY",
    );
  });

  it("extracts Image description", () => {
    expect(extractDiagramDescription("[Image: organizational structure]")).toBe(
      "organizational structure",
    );
  });

  it("detects mermaid code blocks", () => {
    const content = "```mermaid\ngraph TD\n  A-->B\n```";
    expect(extractDiagramDescription(content)).toBe("Structural diagram");
  });

  it("returns default for content with no markers", () => {
    expect(extractDiagramDescription("Just some regular text")).toBe("Visual content");
  });

  it("prefers Chart over Image when both present", () => {
    const content = "[Chart: Revenue chart]\n[Image: some logo]";
    expect(extractDiagramDescription(content)).toBe("Revenue chart");
  });

  it("trims whitespace in descriptions", () => {
    expect(extractDiagramDescription("[Chart:   spaced description  ]")).toBe(
      "spaced description",
    );
  });
});

describe("renderDiagramPages", () => {
  let renderDiagramPages: (
    buf: Buffer,
    ext: ContentExtractionResult,
  ) => Promise<import("./schema").DiagramImage[]>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import("./index");
    renderDiagramPages = mod.renderDiagramPages;
  });

  it("returns empty array when no pages have diagrams", async () => {
    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "text only", hasDiagram: false },
      ],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
    };

    const result = await renderDiagramPages(Buffer.from("fake"), extraction);
    expect(result).toEqual([]);
    expect(mockRenderPdfPagesToImages).not.toHaveBeenCalled();
  });

  it("renders only diagram-flagged pages", async () => {
    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "text only", hasDiagram: false },
        { pageNumber: 2, content: "[Chart: Revenue chart]", hasDiagram: true },
        { pageNumber: 3, content: "more text", hasDiagram: false },
      ],
      metadata: { totalPages: 3, documentLanguage: "en", documentTitle: null },
    };

    const result = await renderDiagramPages(Buffer.from("fake"), extraction);

    expect(mockRenderPdfPagesToImages).toHaveBeenCalledWith(
      Buffer.from("fake"),
      2, // maxPage = page 2
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      pageNumber: 2,
      base64: "img-page-2",
      mimeType: "image/png",
      description: "Revenue chart",
    });
  });

  it("handles multiple diagram pages", async () => {
    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "[Image: org chart]", hasDiagram: true },
        { pageNumber: 2, content: "text", hasDiagram: false },
        { pageNumber: 3, content: "```mermaid\ngraph TD\n```", hasDiagram: true },
      ],
      metadata: { totalPages: 3, documentLanguage: "en", documentTitle: null },
    };

    const result = await renderDiagramPages(Buffer.from("fake"), extraction);

    expect(mockRenderPdfPagesToImages).toHaveBeenCalledWith(
      Buffer.from("fake"),
      3, // maxPage = page 3
    );
    expect(result).toHaveLength(2);
    expect(result[0].pageNumber).toBe(1);
    expect(result[0].description).toBe("org chart");
    expect(result[1].pageNumber).toBe(3);
    expect(result[1].description).toBe("Structural diagram");
  });

  it("returns empty array when rendering fails", async () => {
    mockRenderPdfPagesToImages.mockRejectedValueOnce(new Error("render failed"));

    const extraction: ContentExtractionResult = {
      pages: [{ pageNumber: 1, content: "[Chart: test]", hasDiagram: true }],
      metadata: { totalPages: 1, documentLanguage: "en", documentTitle: null },
    };

    const result = await renderDiagramPages(Buffer.from("fake"), extraction);
    expect(result).toEqual([]);
  });

  it("skips pages where rendered image is missing", async () => {
    // Only 1 image returned but diagram is on page 2
    mockRenderPdfPagesToImages.mockResolvedValueOnce([
      { base64: "img-page-1", mimeType: "image/png" },
    ]);

    const extraction: ContentExtractionResult = {
      pages: [
        { pageNumber: 1, content: "text", hasDiagram: false },
        { pageNumber: 2, content: "[Chart: test]", hasDiagram: true },
      ],
      metadata: { totalPages: 2, documentLanguage: "en", documentTitle: null },
    };

    const result = await renderDiagramPages(Buffer.from("fake"), extraction);
    expect(result).toEqual([]);
  });
});

describe("extractContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls generateObject and renders diagram pages", async () => {
    const { extractContent } = await import("./index");
    const result = await extractContent(Buffer.from("fake-pdf"));

    expect(result.pages).toHaveLength(2);
    expect(result.metadata.documentLanguage).toBe("en");
    expect(result.diagramImages).toHaveLength(1);
    expect(result.diagramImages[0].pageNumber).toBe(2);
    expect(result.diagramImages[0].description).toBe("Bar chart — Revenue");
  });

  it("throws on extraction failure", async () => {
    const { generateObject } = await import("ai");
    vi.mocked(generateObject).mockRejectedValueOnce(new Error("API error"));

    const { extractContent } = await import("./index");
    await expect(extractContent(Buffer.from("fake"))).rejects.toThrow(
      "Content extraction failed: API error",
    );
  });
});
