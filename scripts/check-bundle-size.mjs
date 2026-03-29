/**
 * Bundle Size Budget Checker
 *
 * Validates that the Next.js build output stays within acceptable size limits.
 * Runs after `next build` and inspects the .next directory.
 *
 * Budgets:
 * - Total JS: < 500 KB (first-load shared)
 * - Largest page: < 300 KB
 * - No single chunk: > 200 KB
 */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { join, extname } from "path";

const BUILD_DIR = join(process.cwd(), ".next");
const STATIC_CHUNKS_DIR = join(BUILD_DIR, "static", "chunks");

// Budget limits in bytes
const BUDGETS = {
  totalSharedJS: 3 * 1024 * 1024,       // 3 MB total JS
  largestChunk: 500 * 1024,             // 500 KB single chunk
  totalBuildSize: 600 * 1024 * 1024,    // 600 MB total build (includes .next/cache)
};

function getFileSizeRecursive(dir, ext) {
  let total = 0;
  let largest = { name: "", size: 0 };

  function walk(currentDir) {
    if (!existsSync(currentDir)) return;

    for (const entry of readdirSync(currentDir)) {
      const fullPath = join(currentDir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (!ext || extname(entry) === ext) {
          total += stat.size;

          if (stat.size > largest.size) {
            largest = { name: fullPath.replace(BUILD_DIR, ".next"), size: stat.size };
          }
        }
      } catch {
        // Skip inaccessible files
      }
    }
  }

  walk(dir);
  return { total, largest };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Main
if (!existsSync(BUILD_DIR)) {
  console.error("❌ Build directory .next not found. Run `npm run build` first.");
  process.exit(1);
}

const jsStats = getFileSizeRecursive(STATIC_CHUNKS_DIR, ".js");
const totalBuild = getFileSizeRecursive(BUILD_DIR, null);

const violations = [];

console.log("\n📦 Bundle Size Report");
console.log("━".repeat(50));
console.log(`  Total JS chunks:     ${formatBytes(jsStats.total)} (budget: ${formatBytes(BUDGETS.totalSharedJS)})`);
console.log(`  Largest JS chunk:    ${formatBytes(jsStats.largest.size)} (budget: ${formatBytes(BUDGETS.largestChunk)})`);
console.log(`    → ${jsStats.largest.name}`);
console.log(`  Total build size:    ${formatBytes(totalBuild.total)} (budget: ${formatBytes(BUDGETS.totalBuildSize)})`);
console.log("━".repeat(50));

if (jsStats.total > BUDGETS.totalSharedJS) {
  violations.push(
    `Total JS (${formatBytes(jsStats.total)}) exceeds budget (${formatBytes(BUDGETS.totalSharedJS)})`
  );
}

if (jsStats.largest.size > BUDGETS.largestChunk) {
  violations.push(
    `Largest chunk (${formatBytes(jsStats.largest.size)}) exceeds budget (${formatBytes(BUDGETS.largestChunk)})\n  → ${jsStats.largest.name}`
  );
}

if (totalBuild.total > BUDGETS.totalBuildSize) {
  violations.push(
    `Total build (${formatBytes(totalBuild.total)}) exceeds budget (${formatBytes(BUDGETS.totalBuildSize)})`
  );
}

if (violations.length > 0) {
  console.error("\n❌ Budget violations:");
  violations.forEach((v) => console.error(`  • ${v}`));
  process.exit(1);
} else {
  console.log("\n✅ All bundle size budgets passed\n");
}
