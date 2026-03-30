import type { FileType } from "@/lib/db/schema/files";

export interface RuleClassificationResult {
  fileType: FileType;
  confidence: number;
  matchedRule: string;
}

/**
 * Confidence levels for different match scenarios.
 * Folder + filename match is strongest; filename-only is weakest.
 */
const CONFIDENCE_FOLDER_AND_FILENAME = 0.95;
const CONFIDENCE_FOLDER_ONLY = 0.85;
const CONFIDENCE_FILENAME_ONLY = 0.75;

interface KeywordRule {
  fileType: FileType;
  /** Keywords to match against folder path segments (case-insensitive) */
  folderKeywords: string[];
  /** Keywords to match against filename (case-insensitive) */
  filenameKeywords: string[];
}

/**
 * Keyword rules derived from the classification prompt.
 * Each rule maps keywords (EN + JP) to a file type.
 */
const KEYWORD_RULES: KeywordRule[] = [
  {
    fileType: "im_pdf",
    folderKeywords: ["im", "information memorandum"],
    filenameKeywords: [
      "im", "information memorandum", "企業概要", "案件概要",
      "company profile", "investment summary",
    ],
  },
  {
    fileType: "dd_financial",
    folderKeywords: [
      "financial", "finance", "財務", "決算", "会計",
    ],
    filenameKeywords: [
      "financial", "financials", "p&l", "balance sheet",
      "cash flow", "tax return", "financial model",
      "財務", "決算", "会計", "bs", "pl",
    ],
  },
  {
    fileType: "dd_legal",
    folderKeywords: ["legal", "法務", "契約", "コンプライアンス"],
    filenameKeywords: [
      "legal", "litigation", "contract review", "ip registration",
      "regulatory", "compliance", "法務", "契約", "訴訟", "コンプライアンス",
    ],
  },
  {
    fileType: "dd_operational",
    folderKeywords: [
      "operational", "operations", "事業", "オペレーション", "業務",
    ],
    filenameKeywords: [
      "operational", "facility", "supply chain", "process",
      "environmental", "事業", "オペレーション", "業務",
    ],
  },
  {
    fileType: "dd_tax",
    folderKeywords: ["tax", "税務", "税金"],
    filenameKeywords: [
      "tax", "transfer pricing", "税務", "税金",
    ],
  },
  {
    fileType: "dd_hr",
    folderKeywords: ["hr", "human resources", "people", "人事", "組織", "労務"],
    filenameKeywords: [
      "hr", "headcount", "compensation", "org chart",
      "turnover", "labor", "succession",
      "人事", "組織", "給与", "労務",
    ],
  },
  {
    fileType: "dd_it",
    folderKeywords: ["it", "technology", "tech", "システム", "技術", "セキュリティ"],
    filenameKeywords: [
      "it", "tech stack", "security audit", "soc2", "iso",
      "cloud", "code quality", "data governance",
      "システム", "技術", "セキュリティ",
    ],
  },
  {
    fileType: "nda",
    folderKeywords: ["nda", "confidentiality", "秘密保持"],
    filenameKeywords: [
      "nda", "non-disclosure", "confidentiality agreement", "秘密保持",
    ],
  },
  {
    fileType: "loi",
    folderKeywords: ["loi", "意向表明"],
    filenameKeywords: [
      "loi", "letter of intent", "indication of interest", "意向表明",
    ],
  },
  {
    fileType: "purchase_agreement",
    folderKeywords: ["spa", "purchase agreement", "株式譲渡", "事業譲渡"],
    filenameKeywords: [
      "spa", "share purchase agreement", "asset purchase agreement",
      "definitive agreement", "株式譲渡", "事業譲渡",
    ],
  },
  {
    fileType: "pmi_plan",
    folderKeywords: ["pmi", "統合計画", "integration"],
    filenameKeywords: [
      "pmi plan", "integration plan", "統合計画",
    ],
  },
  {
    fileType: "pmi_report",
    folderKeywords: ["pmi", "統合"],
    filenameKeywords: [
      "pmi report", "integration report", "integration progress", "統合報告",
    ],
  },
];

/**
 * Check if any keyword matches within a text (case-insensitive).
 * Uses word boundary awareness for short keywords to avoid false positives.
 */
function matchesKeywords(text: string, keywords: string[]): string | null {
  const lower = text.toLowerCase();
  for (const keyword of keywords) {
    if (keyword.length <= 3) {
      // For short keywords (e.g. "im", "hr", "it"), require word boundaries
      const regex = new RegExp(`(?:^|[\\s_/\\-\\.\\(])${escapeRegex(keyword)}(?:$|[\\s_/\\-\\.\\)])`, "i");
      if (regex.test(lower)) return keyword;
    } else {
      if (lower.includes(keyword.toLowerCase())) return keyword;
    }
  }
  return null;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Classify a file using rule-based keyword matching on metadata.
 * Returns null if no rule matches with sufficient confidence.
 */
export function classifyByRules(input: {
  fileName: string;
  mimeType: string;
  parentPath: string;
}): RuleClassificationResult | null {
  const { fileName, parentPath } = input;

  let bestMatch: RuleClassificationResult | null = null;

  for (const rule of KEYWORD_RULES) {
    const folderMatch = matchesKeywords(parentPath, rule.folderKeywords);
    const filenameMatch = matchesKeywords(fileName, rule.filenameKeywords);

    if (folderMatch && filenameMatch) {
      const result: RuleClassificationResult = {
        fileType: rule.fileType,
        confidence: CONFIDENCE_FOLDER_AND_FILENAME,
        matchedRule: `folder:"${folderMatch}" + filename:"${filenameMatch}"`,
      };
      // Folder+filename is highest confidence, return immediately
      return result;
    }

    if (folderMatch && (!bestMatch || CONFIDENCE_FOLDER_ONLY > bestMatch.confidence)) {
      bestMatch = {
        fileType: rule.fileType,
        confidence: CONFIDENCE_FOLDER_ONLY,
        matchedRule: `folder:"${folderMatch}"`,
      };
    }

    if (filenameMatch && (!bestMatch || CONFIDENCE_FILENAME_ONLY > bestMatch.confidence)) {
      bestMatch = {
        fileType: rule.fileType,
        confidence: CONFIDENCE_FILENAME_ONLY,
        matchedRule: `filename:"${filenameMatch}"`,
      };
    }
  }

  return bestMatch;
}
