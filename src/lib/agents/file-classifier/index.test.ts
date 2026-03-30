import { describe, it, expect, vi, beforeEach } from "vitest";

const mockClassifyByRules = vi.hoisted(() => vi.fn());
const mockClassifyWithVision = vi.hoisted(() => vi.fn());

vi.mock("./rules", () => ({
  classifyByRules: mockClassifyByRules,
}));

vi.mock("./vision", () => ({
  classifyWithVision: mockClassifyWithVision,
  VISION_MODEL_ID: "gemini-2.5-flash",
}));

// Import after mocks
const { classifyFile, RULE_CONFIDENCE_THRESHOLD } = await import("./index");

describe("classifyFile (hybrid)", () => {
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

  it("returns rule result when confidence >= threshold", async () => {
    mockClassifyByRules.mockReturnValue({
      fileType: "nda",
      confidence: 0.95,
      matchedRule: 'folder:"nda" + filename:"nda"',
    });

    const result = await classifyFile(baseInput);

    expect(result.fileType).toBe("nda");
    expect(result.confidence).toBe(0.95);
    expect(result.tier).toBe("rules");
    expect(result.suggestedCompanyName).toBeNull();
    expect(mockClassifyWithVision).not.toHaveBeenCalled();
  });

  it("escalates to vision when rule confidence < threshold", async () => {
    mockClassifyByRules.mockReturnValue({
      fileType: "dd_financial",
      confidence: 0.75,
      matchedRule: 'filename:"financial"',
    });
    mockClassifyWithVision.mockResolvedValue({
      fileType: "dd_financial",
      confidence: 0.92,
      suggestedCompanyName: "Acme Corp",
      reasoning: "Financial statements for Acme Corp",
    });

    const result = await classifyFile(baseInput);

    expect(result.fileType).toBe("dd_financial");
    expect(result.confidence).toBe(0.92);
    expect(result.tier).toBe("vision");
    expect(result.suggestedCompanyName).toBe("Acme Corp");
    expect(mockClassifyWithVision).toHaveBeenCalled();
  });

  it("escalates to vision when no rule matches", async () => {
    mockClassifyByRules.mockReturnValue(null);
    mockClassifyWithVision.mockResolvedValue({
      fileType: "im_pdf",
      confidence: 0.88,
      suggestedCompanyName: "Tokyo Inc",
      reasoning: "IM cover page detected",
    });

    const result = await classifyFile(baseInput);

    expect(result.fileType).toBe("im_pdf");
    expect(result.tier).toBe("vision");
    expect(result.suggestedCompanyName).toBe("Tokyo Inc");
  });

  it("falls back to low-confidence rule result when vision fails", async () => {
    mockClassifyByRules.mockReturnValue({
      fileType: "dd_legal",
      confidence: 0.75,
      matchedRule: 'filename:"legal"',
    });
    mockClassifyWithVision.mockRejectedValue(new Error("API error"));

    const result = await classifyFile(baseInput);

    expect(result.fileType).toBe("dd_legal");
    expect(result.confidence).toBe(0.75);
    expect(result.tier).toBe("rules");
    expect(result.reasoning).toContain("low confidence");
  });

  it("returns 'other' when no rules match and vision fails", async () => {
    mockClassifyByRules.mockReturnValue(null);
    mockClassifyWithVision.mockRejectedValue(new Error("API error"));

    const result = await classifyFile(baseInput);

    expect(result.fileType).toBe("other");
    expect(result.confidence).toBe(0);
    expect(result.tier).toBe("rules");
  });

  it("returns 'other' when no rules match and no portcoId for vision", async () => {
    mockClassifyByRules.mockReturnValue(null);

    const result = await classifyFile({
      fileName: "mystery.pdf",
      mimeType: "application/pdf",
      parentPath: "Root",
    });

    expect(result.fileType).toBe("other");
    expect(result.confidence).toBe(0);
    expect(mockClassifyWithVision).not.toHaveBeenCalled();
  });

  it("exports RULE_CONFIDENCE_THRESHOLD as 0.8", () => {
    expect(RULE_CONFIDENCE_THRESHOLD).toBe(0.8);
  });
});
