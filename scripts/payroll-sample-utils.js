const fs = require("fs");
const path = require("path");

const SAMPLES_ROOT = path.join(process.cwd(), "samples");
const PAYROLL_REGISTERS_DIR = path.join(SAMPLES_ROOT, "payroll-registers");

const PAYROLL_SUMMARY_NAME =
  /^(?:payroll\s*summary|payrollsummary)(?:\s|_)/i;

function isPayrollSummaryFileName(fileName) {
  const base = fileName.replace(/\.[^.]+$/, "").trim();
  if (!PAYROLL_SUMMARY_NAME.test(base)) return false;
  if (/^atm\s/i.test(base) || /^cash\s/i.test(base)) return false;
  if (/payslip/i.test(base) || /report/i.test(base)) return false;
  return true;
}

/** Relative path from samples/ — unique key for manifest entries. */
function sampleManifestKey(absPath) {
  return path.relative(SAMPLES_ROOT, absPath).split(path.sep).join("/");
}

function collectPayrollSummaryPdfs(options = {}) {
  const { includeAll = false, extraPaths = [] } = options;
  const found = new Map();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.toLowerCase().endsWith(".pdf")) {
        if (includeAll || isPayrollSummaryFileName(entry.name)) {
          const key = sampleManifestKey(full);
          found.set(key, full);
        }
      }
    }
  }

  walk(SAMPLES_ROOT);

  for (const p of extraPaths) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved) && resolved.toLowerCase().endsWith(".pdf")) {
      const key = sampleManifestKey(resolved);
      found.set(key, resolved);
    }
  }

  return [...found.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, absPath]) => ({ key, absPath }));
}

module.exports = {
  SAMPLES_ROOT,
  PAYROLL_REGISTERS_DIR,
  isPayrollSummaryFileName,
  sampleManifestKey,
  collectPayrollSummaryPdfs,
};
