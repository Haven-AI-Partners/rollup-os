import { describe, it, expect } from "vitest";
import { classifyByRules } from "./rules";

function classify(fileName: string, parentPath: string, mimeType = "application/pdf") {
  return classifyByRules({ fileName, mimeType, parentPath });
}

describe("classifyByRules", () => {
  describe("folder + filename match (highest confidence)", () => {
    it("classifies IM in IM folder", () => {
      const result = classify("企業概要.pdf", "Root/CompanyA/IM");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("im_pdf");
      expect(result!.confidence).toBe(0.95);
    });

    it("classifies financial DD in financial folder", () => {
      const result = classify("financial_model.pdf", "Root/CompanyA/DD/Financial");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_financial");
      expect(result!.confidence).toBe(0.95);
    });

    it("classifies NDA in NDA folder", () => {
      const result = classify("NDA_signed.pdf", "Root/Deals/NDA");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("nda");
      expect(result!.confidence).toBe(0.95);
    });
  });

  describe("folder-only match", () => {
    it("classifies by folder path when filename is generic", () => {
      const result = classify("document.pdf", "Root/CompanyA/DD/Financial");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_financial");
      expect(result!.confidence).toBe(0.85);
    });

    it("classifies Japanese folder paths", () => {
      const result = classify("report.pdf", "Root/法務/contracts");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_legal");
      expect(result!.confidence).toBe(0.85);
    });

    it("classifies HR folder in Japanese", () => {
      const result = classify("file.pdf", "Root/人事/data");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_hr");
      expect(result!.confidence).toBe(0.85);
    });

    it("classifies tax folder", () => {
      const result = classify("analysis.pdf", "Root/DD/Tax");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_tax");
      expect(result!.confidence).toBe(0.85);
    });

    it("classifies IT folder in Japanese", () => {
      const result = classify("doc.pdf", "Root/システム/audit");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_it");
      expect(result!.confidence).toBe(0.85);
    });

    it("classifies operational folder", () => {
      const result = classify("doc.pdf", "Root/DD/Operational");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_operational");
      expect(result!.confidence).toBe(0.85);
    });
  });

  describe("filename-only match", () => {
    it("classifies by filename when folder is flat", () => {
      const result = classify("NDA_CompanyX.pdf", "Root/Files");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("nda");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies LOI from filename", () => {
      const result = classify("Letter of Intent - Acme.pdf", "Root");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("loi");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies Japanese IM filename", () => {
      const result = classify("案件概要_ABC株式会社.pdf", "Root");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("im_pdf");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies SPA from filename", () => {
      const result = classify("Share Purchase Agreement.pdf", "Root/Docs");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("purchase_agreement");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies Japanese SPA filename", () => {
      const result = classify("株式譲渡契約書.pdf", "Root");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("purchase_agreement");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies PMI plan from filename", () => {
      const result = classify("PMI Plan Q1.pdf", "Root/Docs");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("pmi_plan");
      expect(result!.confidence).toBe(0.75);
    });

    it("classifies integration report from filename", () => {
      const result = classify("integration progress report.pdf", "Root");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("pmi_report");
      expect(result!.confidence).toBe(0.75);
    });
  });

  describe("no match", () => {
    it("returns null for completely generic file", () => {
      const result = classify("document.pdf", "Root/Files");
      expect(result).toBeNull();
    });

    it("returns null for empty path and generic name", () => {
      const result = classify("scan001.pdf", "");
      expect(result).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("does not false-match short keywords in longer words", () => {
      // "it" should not match in "items" or "iteration"
      const result = classify("items_list.pdf", "Root/iteration");
      expect(result?.fileType).not.toBe("dd_it");
    });

    it("handles case-insensitive matching", () => {
      const result = classify("FINANCIAL_MODEL.PDF", "Root/DD/FINANCIAL");
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_financial");
    });

    it("prefers folder+filename over folder-only from different rules", () => {
      // File is in legal folder but filename says financial
      // folder+filename won't match a single rule, so best is folder-only legal
      const result = classify("financial_report.pdf", "Root/Legal");
      // This should match dd_legal from folder (0.85) or dd_financial from filename (0.75)
      // Folder-only has higher confidence
      expect(result).not.toBeNull();
      expect(result!.fileType).toBe("dd_legal");
      expect(result!.confidence).toBe(0.85);
    });
  });
});
