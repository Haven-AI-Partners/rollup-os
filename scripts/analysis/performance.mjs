#!/usr/bin/env node

/**
 * Weekly Performance Review
 *
 * Checks for:
 * 1. Large files that may indicate bundling issues
 * 2. N+1 query patterns in server actions
 * 3. Missing next/image usage
 * 4. Client component analysis (heavy imports in "use client" files)
 * 5. Missing React.memo / useMemo / useCallback patterns
 * 6. Database index opportunities
 */

import { readFileSync } from "node:fs";
import { runCommand, findFiles, today, writeReport, buildReport, countFindings } from "./utils.mjs";

// --- 1. Bundle analysis (build stats) ---
function checkBundleSize() {
  try {
    // Try to get build output stats without running a full build (check .next if exists)
    const output = runCommand(
      "du -sh .next/static/chunks/*.js 2>/dev/null | sort -rh | head -20",
      { ignoreError: true }
    );

    if (!output) {
      return {
        count: 0,
        body: "_No build output found. Run `ANALYZE=true pnpm build` to generate bundle analysis._\n",
      };
    }

    const lines = output.split("\n").filter(Boolean);
    const largeChunks = lines.filter((line) => {
      const size = line.split("\t")[0];
      const num = parseFloat(size);
      // Flag chunks > 100K
      return (size.includes("M") || (size.includes("K") && num > 100));
    });

    if (largeChunks.length === 0) return { count: 0, body: "" };

    let body = `Found **${largeChunks.length}** large bundle chunk(s).\n\n`;
    body += "| Size | File |\n|------|------|\n";
    for (const line of largeChunks) {
      const [size, file] = line.split("\t");
      body += `| ${size.trim()} | \`${file?.trim()}\` |\n`;
    }
    body += "\n**Recommendation**: Use dynamic imports (`next/dynamic`) for heavy components. Check for unnecessary dependencies in client bundles.\n";

    return { count: largeChunks.length, body };
  } catch {
    return { count: 0, body: "" };
  }
}

// --- 2. N+1 query patterns ---
function checkN1Queries() {
  const actionFiles = findFiles("*.ts").filter(
    (f) => f.startsWith("src/lib/actions/") && !f.includes(".test.") && !f.endsWith("schemas.ts") && !f.endsWith("index.ts")
  );

  const findings = [];

  // Patterns that suggest N+1: a query inside a for/map/forEach/for...of
  const loopPatterns = [
    /for\s*\(.*\)\s*\{/,
    /\.forEach\s*\(/,
    /\.map\s*\(/,
    /for\s+await\s*\(/,
  ];
  const queryPatterns = [/db\.select/, /db\.query/, /db\.insert/, /db\.update/, /db\.delete/];

  for (const file of actionFiles) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    let inLoop = 0;
    let loopStartLine = 0;
    let braceCount = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check if we enter a loop
      if (loopPatterns.some((p) => p.test(line))) {
        if (inLoop === 0) loopStartLine = i + 1;
        inLoop++;
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
      } else if (inLoop > 0) {
        braceCount += (line.match(/\{/g) || []).length;
        braceCount -= (line.match(/\}/g) || []).length;
        if (braceCount <= 0) {
          inLoop = 0;
          braceCount = 0;
        }
      }

      // Check if there's a query inside a loop
      if (inLoop > 0 && queryPatterns.some((p) => p.test(line))) {
        findings.push({
          file,
          line: i + 1,
          loopStart: loopStartLine,
          query: line.trim().substring(0, 80),
        });
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  let body = `Found **${findings.length}** potential N+1 query pattern(s).\n\n`;
  body += "| File | Query Line | Loop Start | Query |\n|------|-----------|------------|-------|\n";
  for (const f of findings) {
    body += `| \`${f.file}\` | ${f.line} | ${f.loopStart} | \`${f.query}\` |\n`;
  }
  body += "\n**Recommendation**: Use batch queries with `IN` clauses or joins instead of querying inside loops.\n";

  return { count: findings.length, body };
}

// --- 3. Missing next/image ---
function checkImageUsage() {
  const tsxFiles = findFiles("*.tsx").filter(
    (f) => !f.includes("node_modules") && !f.includes(".test.")
  );

  const findings = [];

  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf-8");
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      // Look for <img tags (should use next/image instead)
      if (/<img\s/i.test(lines[i])) {
        findings.push({ file, line: i + 1, code: lines[i].trim().substring(0, 80) });
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  let body = `Found **${findings.length}** \`<img>\` tag(s) that should use \`next/image\`.\n\n`;
  body += "| File | Line | Code |\n|------|------|------|\n";
  for (const f of findings) {
    body += `| \`${f.file}\` | ${f.line} | \`${f.code}\` |\n`;
  }
  body += "\n**Recommendation**: Replace `<img>` with `next/image` `<Image>` component for automatic optimization.\n";

  return { count: findings.length, body };
}

// --- 4. Heavy client components ---
function checkClientComponents() {
  const tsxFiles = findFiles("*.tsx").filter(
    (f) => !f.includes("node_modules") && !f.includes(".test.")
  );

  const heavyImports = [
    "recharts",
    "googleapis",
    "ai",
    "@ai-sdk",
    "drizzle-orm",
    "postgres",
    "pdf-parse",
    "pdfjs-dist",
  ];

  const findings = [];

  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf-8");

    // Check if it's a client component
    if (!content.startsWith('"use client"') && !content.startsWith("'use client'")) {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.includes("import")) continue;

      for (const pkg of heavyImports) {
        if (line.includes(`from "${pkg}`) || line.includes(`from '${pkg}`)) {
          findings.push({
            file,
            line: i + 1,
            import: pkg,
          });
        }
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  let body = `Found **${findings.length}** heavy import(s) in client components.\n\n`;
  body += "| File | Line | Import |\n|------|------|--------|\n";
  for (const f of findings) {
    body += `| \`${f.file}\` | ${f.line} | \`${f.import}\` |\n`;
  }
  body += "\n**Recommendation**: Move heavy imports to server components or use dynamic imports with `next/dynamic`.\n";

  return { count: findings.length, body };
}

// --- 5. Missing React performance optimizations ---
function checkReactPerformance() {
  const tsxFiles = findFiles("*.tsx").filter(
    (f) =>
      !f.includes("node_modules") &&
      !f.includes(".test.") &&
      !f.includes("src/components/ui/") // Skip shadcn components
  );

  const findings = [];

  for (const file of tsxFiles) {
    const content = readFileSync(file, "utf-8");

    // Check for inline object/array props in JSX (causes re-renders)
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      // style={{...}} inline objects in JSX (common perf issue)
      if (/style=\{\{/.test(line) && !line.includes("//")) {
        findings.push({
          file,
          line: i + 1,
          issue: "Inline style object",
          description: "Creates new object reference on every render",
        });
      }
    }

    // Check for functions defined inside render that could be memoized
    // This is a simplified check - look for callback props defined inline
    if (content.includes('"use client"') || content.includes("'use client'")) {
      const callbackRegex = /on\w+=\{\s*\(\s*\)\s*=>/g;
      let match;
      while ((match = callbackRegex.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        findings.push({
          file,
          line: lineNum,
          issue: "Inline callback prop",
          description: "Consider useCallback for stable reference",
        });
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  // Limit to most important findings
  let body = `Found **${findings.length}** potential React performance issue(s).\n\n`;
  body += "| File | Line | Issue | Description |\n|------|------|-------|-------------|\n";
  for (const f of findings.slice(0, 30)) {
    body += `| \`${f.file}\` | ${f.line} | ${f.issue} | ${f.description} |\n`;
  }

  if (findings.length > 30) {
    body += `\n_...and ${findings.length - 30} more._\n`;
  }

  body += "\n**Recommendation**: Extract inline objects/callbacks outside the component or wrap with `useMemo`/`useCallback`.\n";

  return { count: findings.length, body };
}

// --- 6. Database index opportunities ---
function checkDatabaseIndexes() {
  const schemaFiles = findFiles("*.ts").filter(
    (f) => f.startsWith("src/lib/db/schema/") && !f.endsWith("index.ts") && !f.includes(".test.")
  );

  const findings = [];

  for (const file of schemaFiles) {
    const content = readFileSync(file, "utf-8");

    // Check for FK columns that might need indexes
    const fkRegex = /(\w+):\s*uuid\([^)]*\).*\.references\(/g;
    let match;
    while ((match = fkRegex.exec(content)) !== null) {
      const columnName = match[1];
      // Check if there's an index defined for this column
      const hasIndex = content.includes(`"${columnName}"`) &&
        (content.includes("index(") || content.includes("pgIndex") || content.includes("uniqueIndex"));

      if (!hasIndex) {
        const lineNum = content.substring(0, match.index).split("\n").length;
        findings.push({
          file,
          line: lineNum,
          column: columnName,
        });
      }
    }
  }

  if (findings.length === 0) return { count: 0, body: "" };

  let body = `Found **${findings.length}** foreign key column(s) potentially missing indexes.\n\n`;
  body += "| Schema File | Line | Column |\n|-------------|------|--------|\n";
  for (const f of findings) {
    body += `| \`${f.file}\` | ${f.line} | \`${f.column}\` |\n`;
  }
  body += "\n**Recommendation**: Add database indexes on foreign key columns that are used in WHERE clauses or JOINs.\n";

  return { count: findings.length, body };
}

// --- Main ---
const bundle = checkBundleSize();
const n1 = checkN1Queries();
const images = checkImageUsage();
const clientImports = checkClientComponents();
const reactPerf = checkReactPerformance();
const indexes = checkDatabaseIndexes();

const total = countFindings(
  bundle.count, n1.count, images.count,
  clientImports.count, reactPerf.count, indexes.count
);

const summary = [
  `- **Large bundle chunks**: ${bundle.count}`,
  `- **N+1 query patterns**: ${n1.count}`,
  `- **Missing next/image**: ${images.count}`,
  `- **Heavy client imports**: ${clientImports.count}`,
  `- **React perf issues**: ${reactPerf.count}`,
  `- **Missing DB indexes**: ${indexes.count}`,
  `- **Total findings**: ${total}`,
].join("\n");

const report = buildReport(
  `Weekly Performance Review — ${today()}`,
  summary,
  [
    { heading: "Bundle Size Analysis", body: bundle.body },
    { heading: "N+1 Query Patterns", body: n1.body },
    { heading: "Missing next/image Usage", body: images.body },
    { heading: "Heavy Client Component Imports", body: clientImports.body },
    { heading: "React Performance Issues", body: reactPerf.body },
    { heading: "Database Index Opportunities", body: indexes.body },
  ]
);

const reportPath = writeReport(`performance-${today()}.md`, report);
console.log(`Report written to: ${reportPath}`);
console.log(`Total findings: ${total}`);

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_OUTPUT, `has_findings=${total > 0}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `report_path=${reportPath}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `total_findings=${total}\n`);
}

process.exit(0);
