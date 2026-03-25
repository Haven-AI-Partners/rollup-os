import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../..");
const ANALYSIS_DIR = resolve(ROOT, "docs/analysis");

/**
 * Run a shell command and return stdout. Returns empty string on failure.
 */
export function runCommand(cmd, { cwd = ROOT, ignoreError = false } = {}) {
  try {
    return execSync(cmd, { cwd, encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (err) {
    if (ignoreError) return err.stdout?.trim() ?? "";
    throw err;
  }
}

/**
 * Find files matching a glob pattern relative to the project root.
 */
export function findFiles(pattern) {
  const output = runCommand(`find src -type f -name '${pattern}'`, { ignoreError: true });
  return output ? output.split("\n").filter(Boolean) : [];
}

/**
 * Count the number of lines in a file.
 */
export function countLines(filePath) {
  const content = readFileSync(resolve(ROOT, filePath), "utf-8");
  return content.split("\n").length;
}

/**
 * Get today's date as YYYY-MM-DD.
 */
export function today() {
  return new Date().toISOString().split("T")[0];
}

/**
 * Write a markdown report to docs/analysis/.
 * @returns {string} The path to the written report.
 */
export function writeReport(filename, content) {
  mkdirSync(ANALYSIS_DIR, { recursive: true });
  const filePath = resolve(ANALYSIS_DIR, filename);
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/**
 * Build a markdown report from sections.
 * @param {string} title - Report title
 * @param {string} summary - Summary paragraph
 * @param {Array<{heading: string, body: string}>} sections - Report sections
 * @returns {string} Markdown content
 */
export function buildReport(title, summary, sections) {
  const activeSections = sections.filter((s) => s.body.trim());
  let md = `# ${title}\n\n`;
  md += `**Generated**: ${today()}\n\n`;
  md += `## Summary\n\n${summary}\n\n`;

  for (const section of activeSections) {
    md += `## ${section.heading}\n\n${section.body}\n\n`;
  }

  if (activeSections.length === 0) {
    md += "_No actionable findings._\n";
  }

  return md;
}

/**
 * Count total findings across sections.
 */
export function countFindings(...counts) {
  return counts.reduce((a, b) => a + b, 0);
}

export { ROOT, ANALYSIS_DIR };
