#!/usr/bin/env node

/**
 * Weekly Security Review
 *
 * Checks for:
 * 1. Dependency vulnerabilities (pnpm audit)
 * 2. ESLint security rules (eslint-plugin-security)
 * 3. Missing auth guards in server actions
 * 4. Dangerous patterns (dangerouslySetInnerHTML, raw SQL, hardcoded secrets)
 */

import { readFileSync } from "node:fs";
import { runCommand, findFiles, today, writeReport, buildReport, countFindings, ROOT } from "./utils.mjs";

// --- 1. Dependency audit ---
function checkDependencies() {
  try {
    // Read ignored CVEs/GHSAs from package.json for prod-reachable-but-unexploitable deps
    const pkg = JSON.parse(readFileSync(`${ROOT}/package.json`, "utf-8"));
    const ignoredIds = pkg.pnpm?.auditConfig?.ignoreCves ?? [];
    const ignoreFlags = ignoredIds.map((id) => `--ignore ${id}`).join(" ");

    // --prod: only audit production dependencies (skip devDependency-only vulns)
    const output = runCommand(`pnpm audit --json --prod ${ignoreFlags} 2>/dev/null`, { ignoreError: true });

    let audit;
    try {
      audit = JSON.parse(output);
    } catch {
      // pnpm audit may output non-JSON; try parsing line-by-line
      const lines = output.split("\n").filter(Boolean);
      const advisories = [];
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.type === "auditAdvisory") advisories.push(obj.data?.advisory);
        } catch { /* skip */ }
      }
      if (advisories.length === 0) return { count: 0, body: "" };

      let body = `Found **${advisories.length}** dependency vulnerability/ies.\n\n`;
      body += "| Package | Severity | Title | URL |\n|---------|----------|-------|-----|\n";
      for (const adv of advisories.filter(Boolean)) {
        body += `| \`${adv.module_name}\` | ${adv.severity} | ${adv.title} | ${adv.url || "—"} |\n`;
      }
      body += "\n**Recommendation**: Run `pnpm audit fix` or manually update affected packages.\n";
      return { count: advisories.length, body };
    }

    // Standard pnpm audit JSON format
    const advisories = audit.advisories ? Object.values(audit.advisories) : [];
    const metadata = audit.metadata || {};
    const totalVulns = metadata.vulnerabilities
      ? Object.values(metadata.vulnerabilities).reduce((a, b) => a + b, 0)
      : advisories.length;

    if (totalVulns === 0 && advisories.length === 0) return { count: 0, body: "" };

    let body = `Found **${totalVulns || advisories.length}** dependency vulnerability/ies.\n\n`;

    if (metadata.vulnerabilities) {
      const v = metadata.vulnerabilities;
      body += `| Severity | Count |\n|----------|-------|\n`;
      for (const [sev, count] of Object.entries(v)) {
        if (count > 0) body += `| ${sev} | ${count} |\n`;
      }
      body += "\n";
    }

    if (advisories.length > 0) {
      body += "### Details\n\n";
      body += "| Package | Severity | Title |\n|---------|----------|-------|\n";
      for (const adv of advisories.slice(0, 30)) {
        body += `| \`${adv.module_name}\` | ${adv.severity} | ${adv.title} |\n`;
      }
      if (advisories.length > 30) {
        body += `\n_...and ${advisories.length - 30} more._\n`;
      }
    }

    body += "\n**Recommendation**: Run `pnpm audit fix` or manually update affected packages.\n";

    return { count: totalVulns || advisories.length, body };
  } catch {
    return { count: 0, body: "_Dependency audit could not be completed._\n" };
  }
}

// --- 2. ESLint security rules ---
function checkSecurityLint() {
  try {
    const output = runCommand(
      'npx eslint src/ --no-eslintrc --plugin security --rule \'{"security/detect-object-injection": "warn", "security/detect-non-literal-regexp": "warn", "security/detect-unsafe-regex": "warn", "security/detect-buffer-noassert": "warn", "security/detect-eval-with-expression": "warn", "security/detect-no-csrf-before-method-override": "warn", "security/detect-possible-timing-attacks": "warn", "security/detect-child-process": "warn"}\' --format json --ext .ts,.tsx 2>/dev/null',
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
      const secMessages = (result.messages || []).filter(
        (m) => m.ruleId && m.ruleId.startsWith("security/")
      );
      for (const msg of secMessages) {
        findings.push({
          file: result.filePath.replace(ROOT + "/", ""),
          line: msg.line,
          rule: msg.ruleId,
          message: msg.message,
          severity: msg.severity === 2 ? "error" : "warning",
        });
      }
    }

    if (findings.length === 0) return { count: 0, body: "" };

    let body = `Found **${findings.length}** security lint finding(s).\n\n`;
    body += "| File | Line | Rule | Severity |\n|------|------|------|----------|\n";
    for (const f of findings.slice(0, 30)) {
      body += `| \`${f.file}\` | ${f.line} | \`${f.rule}\` | ${f.severity} |\n`;
    }

    if (findings.length > 30) {
      body += `\n_...and ${findings.length - 30} more._\n`;
    }

    body += "\n**Recommendation**: Review each finding and fix or suppress with justification.\n";

    return { count: findings.length, body };
  } catch {
    return { count: 0, body: "_Security lint analysis failed._\n" };
  }
}

// --- 3. Missing auth guards ---
function checkAuthGuards() {
  const actionFiles = findFiles("*.ts").filter(
    (f) => f.startsWith("src/lib/actions/") && !f.includes(".test.") && !f.endsWith("schemas.ts") && !f.endsWith("index.ts")
  );

  const findings = [];
  // Match direct auth calls and common wrappers (e.g. requireAdmin)
  const authPatterns = [
    /requireAuth\(/,
    /requirePortcoRole\(/,
    /requireAdmin\(/,
    /getCurrentUser\(\)[\s\S]*?if\s*\(\s*!/, // getCurrentUser() followed by null guard
  ];

  for (const file of actionFiles) {
    const content = readFileSync(file, "utf-8");

    // Find exported async functions (server actions)
    const funcRegex = /export\s+async\s+function\s+(\w+)/g;
    let match;
    while ((match = funcRegex.exec(content)) !== null) {
      const funcName = match[1];
      const funcStart = match.index;

      // Find the function body (look for the next export or end of file)
      const nextExport = content.indexOf("export ", funcStart + 1);
      const funcBody = content.substring(funcStart, nextExport > -1 ? nextExport : undefined);

      const hasAuth = authPatterns.some((p) => p.test(funcBody));
      if (!hasAuth) {
        const lineNum = content.substring(0, funcStart).split("\n").length;
        findings.push({ file, funcName, line: lineNum });
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  let body = `Found **${findings.length}** server action(s) potentially missing auth guards.\n\n`;
  body += "| File | Function | Line |\n|------|----------|------|\n";
  for (const f of findings) {
    body += `| \`${f.file}\` | \`${f.funcName}\` | ${f.line} |\n`;
  }

  body += "\n**Recommendation**: Add `requireAuth()` for read actions or `requirePortcoRole()` for write actions.\n";

  return { count: findings.length, body };
}

// --- 4. Dangerous patterns ---

// Files/directories to exclude from dangerous pattern checks (known safe)
const PATTERN_IGNORE_PATHS = [
  "src/components/ui/", // shadcn/ui components — not hand-written
];

function checkDangerousPatterns() {
  const patterns = [
    {
      name: "dangerouslySetInnerHTML",
      regex: /dangerouslySetInnerHTML/,
      severity: "high",
      description: "XSS risk: raw HTML injection",
    },
    {
      name: "Hardcoded secret",
      regex: /(api[_-]?key|secret|password|token)\s*[:=]\s*["'][^"']{8,}["']/i,
      severity: "critical",
      description: "Potential hardcoded credential",
    },
    {
      name: "eval() usage",
      regex: /\beval\s*\(/,
      severity: "critical",
      description: "Code injection risk",
    },
    {
      name: "Raw SQL via string concatenation",
      // Only flag string concatenation with SQL keywords, NOT Drizzle's
      // sql`` template tag which uses parameterized placeholders
      regex: /(?:query|execute|raw)\s*\(\s*['"`].*(?:SELECT|INSERT|UPDATE|DELETE|DROP)/i,
      severity: "high",
      description: "SQL injection risk via string concatenation",
    },
    {
      name: "innerHTML assignment",
      regex: /\.innerHTML\s*=/,
      severity: "high",
      description: "XSS risk: direct innerHTML assignment",
    },
    {
      name: "Unvalidated redirect",
      // Only flag redirects using raw request params (searchParams, query, params)
      regex: /redirect\(.*(?:searchParams|query|params)\./,
      severity: "medium",
      description: "Open redirect risk if URL comes from user input",
    },
  ];

  const allFiles = [...findFiles("*.ts"), ...findFiles("*.tsx")].filter(
    (f) =>
      !f.includes("node_modules") &&
      !f.includes(".test.") &&
      !PATTERN_IGNORE_PATHS.some((ignore) => f.startsWith(ignore))
  );

  const findings = [];

  for (const file of allFiles) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (const pattern of patterns) {
      for (let i = 0; i < lines.length; i++) {
        if (pattern.regex.test(lines[i])) {
          findings.push({
            file,
            line: i + 1,
            pattern: pattern.name,
            severity: pattern.severity,
            description: pattern.description,
          });
        }
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  // Sort by severity
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  findings.sort((a, b) => (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99));

  let body = `Found **${findings.length}** potentially dangerous pattern(s).\n\n`;
  body += "| File | Line | Pattern | Severity | Description |\n|------|------|---------|----------|-------------|\n";
  for (const f of findings.slice(0, 30)) {
    body += `| \`${f.file}\` | ${f.line} | ${f.pattern} | ${f.severity} | ${f.description} |\n`;
  }

  if (findings.length > 30) {
    body += `\n_...and ${findings.length - 30} more._\n`;
  }

  body += "\n**Recommendation**: Review each finding and ensure proper input sanitization or use safe alternatives.\n";

  return { count: findings.length, body };
}

// --- Main ---
const deps = checkDependencies();
const secLint = checkSecurityLint();
const authGuards = checkAuthGuards();
const dangerous = checkDangerousPatterns();

const total = countFindings(deps.count, secLint.count, authGuards.count, dangerous.count);

const summary = [
  `- **Dependency vulnerabilities**: ${deps.count}`,
  `- **Security lint findings**: ${secLint.count}`,
  `- **Missing auth guards**: ${authGuards.count}`,
  `- **Dangerous patterns**: ${dangerous.count}`,
  `- **Total findings**: ${total}`,
].join("\n");

const report = buildReport(
  `Weekly Security Review — ${today()}`,
  summary,
  [
    { heading: "Dependency Vulnerabilities", body: deps.body },
    { heading: "Security Lint Findings", body: secLint.body },
    { heading: "Missing Auth Guards", body: authGuards.body },
    { heading: "Dangerous Patterns", body: dangerous.body },
  ]
);

const reportPath = writeReport(`security-${today()}.md`, report);
console.log(`Report written to: ${reportPath}`);
console.log(`Total findings: ${total}`);

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `has_findings=${total > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${reportPath}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `total_findings=${total}\n`);
}

process.exit(0);
