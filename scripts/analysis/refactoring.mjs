#!/usr/bin/env node

/**
 * Weekly Refactoring Analysis
 *
 * Checks for:
 * 1. Files exceeding 200-line limit
 * 2. Code duplication (via jscpd)
 * 3. Circular dependencies (via madge)
 * 4. High cyclomatic complexity (via ESLint)
 */

import { runCommand, findFiles, countLines, today, writeReport, buildReport, countFindings, ROOT } from "./utils.mjs";

const MAX_LINES = 200;
const COMPLEXITY_THRESHOLD = 10;

// --- 1. Files exceeding 200 lines ---
function checkFileSizes() {
  const tsFiles = [
    ...findFiles("*.ts"),
    ...findFiles("*.tsx"),
  ].filter((f) => !f.includes("node_modules") && !f.includes(".test."));

  const oversized = [];
  for (const file of tsFiles) {
    const lines = countLines(file);
    if (lines > MAX_LINES) {
      oversized.push({ file, lines });
    }
  }

  oversized.sort((a, b) => b.lines - a.lines);

  if (oversized.length === 0) return { count: 0, body: "" };

  let body = `Found **${oversized.length}** files exceeding the ${MAX_LINES}-line limit.\n\n`;
  body += "| File | Lines | Over By |\n|------|-------|---------|\n";
  for (const { file, lines } of oversized) {
    body += `| \`${file}\` | ${lines} | +${lines - MAX_LINES} |\n`;
  }
  body += "\n**Recommendation**: Split these files into focused modules with barrel exports (`index.ts`).\n";

  return { count: oversized.length, body };
}

// --- 2. Copy-paste detection ---
function checkDuplication() {
  try {
    runCommand(
      'npx jscpd src --reporters json --output /tmp/jscpd-report --min-lines 10 --min-tokens 50 --ignore "**/*.test.ts,**/*.test.tsx,**/ui/**" 2>/dev/null',
      { ignoreError: true }
    );

    let report;
    try {
      const reportJson = runCommand("cat /tmp/jscpd-report/jscpd-report.json", { ignoreError: true });
      report = JSON.parse(reportJson);
    } catch {
      return { count: 0, body: "" };
    }

    const duplicates = report.duplicates || [];
    if (duplicates.length === 0) return { count: 0, body: "" };

    let body = `Found **${duplicates.length}** code duplication(s).\n\n`;
    body += "| Source A | Source B | Lines | Tokens |\n|----------|----------|-------|--------|\n";

    for (const dup of duplicates.slice(0, 20)) {
      const fileA = dup.firstFile?.name || "unknown";
      const fileB = dup.secondFile?.name || "unknown";
      const startA = dup.firstFile?.startLoc?.line || "?";
      const startB = dup.secondFile?.startLoc?.line || "?";
      const lines = dup.lines || "?";
      const tokens = dup.tokens || "?";
      body += `| \`${fileA}:${startA}\` | \`${fileB}:${startB}\` | ${lines} | ${tokens} |\n`;
    }

    if (duplicates.length > 20) {
      body += `\n_...and ${duplicates.length - 20} more duplicates._\n`;
    }

    body += "\n**Recommendation**: Extract shared logic into reusable modules or components.\n";

    return { count: duplicates.length, body };
  } catch {
    return { count: 0, body: "_jscpd analysis failed._\n" };
  }
}

// --- 3. Circular dependencies ---
function checkCircularDeps() {
  try {
    const output = runCommand(
      'npx madge --circular --extensions ts,tsx src/ 2>/dev/null',
      { ignoreError: true }
    );

    if (!output || output.includes("No circular dependency found")) {
      return { count: 0, body: "" };
    }

    const lines = output.split("\n").filter((l) => l.trim());
    // madge outputs cycles as lines like "src/a.ts > src/b.ts > src/a.ts"
    const cycles = lines.filter((l) => l.includes(">") || l.includes("→"));

    if (cycles.length === 0) return { count: 0, body: "" };

    let body = `Found **${cycles.length}** circular dependency chain(s).\n\n`;
    for (const cycle of cycles) {
      body += `- \`${cycle.trim()}\`\n`;
    }

    body += "\n**Recommendation**: Break cycles by extracting shared types/interfaces into separate files.\n";

    return { count: cycles.length, body };
  } catch {
    return { count: 0, body: "_Circular dependency analysis failed._\n" };
  }
}

// --- 4. Cyclomatic complexity ---
function checkComplexity() {
  try {
    // Run ESLint with complexity rule
    const output = runCommand(
      `npx eslint src/ --no-eslintrc --rule '{"complexity": ["warn", ${COMPLEXITY_THRESHOLD}]}' --format json --ext .ts,.tsx 2>/dev/null`,
      { ignoreError: true }
    );

    let results;
    try {
      results = JSON.parse(output);
    } catch {
      return { count: 0, body: "" };
    }

    const findings = [];
    for (const result of results) {
      const complexityMessages = (result.messages || []).filter(
        (m) => m.ruleId === "complexity"
      );
      for (const msg of complexityMessages) {
        const match = msg.message.match(/complexity of (\d+)/);
        const complexity = match ? parseInt(match[1], 10) : 0;
        findings.push({
          file: result.filePath.replace(ROOT + "/", ""),
          line: msg.line,
          message: msg.message,
          complexity,
        });
      }
    }

    findings.sort((a, b) => b.complexity - a.complexity);

    if (findings.length === 0) return { count: 0, body: "" };

    let body = `Found **${findings.length}** function(s) with cyclomatic complexity above ${COMPLEXITY_THRESHOLD}.\n\n`;
    body += "| File | Line | Complexity | Details |\n|------|------|------------|---------|\n";
    for (const f of findings.slice(0, 20)) {
      body += `| \`${f.file}\` | ${f.line} | ${f.complexity} | ${f.message} |\n`;
    }

    if (findings.length > 20) {
      body += `\n_...and ${findings.length - 20} more._\n`;
    }

    body += "\n**Recommendation**: Refactor complex functions using early returns, strategy patterns, or helper functions.\n";

    return { count: findings.length, body };
  } catch {
    return { count: 0, body: "_Complexity analysis failed._\n" };
  }
}

// --- Main ---
const fileSizes = checkFileSizes();
const duplication = checkDuplication();
const circular = checkCircularDeps();
const complexity = checkComplexity();

const total = countFindings(fileSizes.count, duplication.count, circular.count, complexity.count);

const summary = [
  `- **Files over ${MAX_LINES} lines**: ${fileSizes.count}`,
  `- **Code duplicates**: ${duplication.count}`,
  `- **Circular dependencies**: ${circular.count}`,
  `- **Complex functions**: ${complexity.count}`,
  `- **Total findings**: ${total}`,
].join("\n");

const report = buildReport(
  `Weekly Refactoring Analysis — ${today()}`,
  summary,
  [
    { heading: `Files Exceeding ${MAX_LINES} Lines`, body: fileSizes.body },
    { heading: "Code Duplication", body: duplication.body },
    { heading: "Circular Dependencies", body: circular.body },
    { heading: "High Cyclomatic Complexity", body: complexity.body },
  ]
);

const reportPath = writeReport(`refactoring-${today()}.md`, report);
console.log(`Report written to: ${reportPath}`);
console.log(`Total findings: ${total}`);

// Output for GitHub Actions
if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `has_findings=${total > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${reportPath}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `total_findings=${total}\n`);
}

process.exit(0);
