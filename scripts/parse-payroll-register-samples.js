#!/usr/bin/env node
/**
 * Parse all payroll register PDFs under samples/payroll-registers/
 * and optionally compare against manifest.json.
 *
 * Usage:
 *   npm run parse:payroll-samples
 *   npm run parse:payroll-samples -- path/to/file.pdf
 *   npm run parse:payroll-samples -- --manifest-stub "New Client.pdf"
 */

const fs = require("fs");
const path = require("path");

const SAMPLES_DIR = path.join(process.cwd(), "samples/payroll-registers");
const MANIFEST_PATH = path.join(SAMPLES_DIR, "manifest.json");
const REPO_ROOT_FIXTURES = [
  "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf",
  "PAYROLL SUMMARY_CHICHA HUT_16-31.pdf",
  "Payroll summary_CONVERGE_1-15.pdf",
  "Payroll summary_converge_16-31.pdf",
];

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { samples: {} };
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

function collectPdfPaths(args) {
  const explicit = args.filter((a) => !a.startsWith("--") && a.endsWith(".pdf"));
  if (explicit.length > 0) {
    return explicit.map((p) => path.resolve(p));
  }

  const found = new Set();

  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith(".pdf")) found.add(full);
    }
  }

  walk(SAMPLES_DIR);

  for (const name of REPO_ROOT_FIXTURES) {
    const rootPath = path.join(process.cwd(), name);
    if (fs.existsSync(rootPath)) found.add(rootPath);
  }

  return [...found].sort();
}

function manifestStubFromMetrics(fileName, metrics) {
  return {
    client: metrics.companyName ?? "Unknown",
    layout:
      metrics.sourceFormat === "gp_hris"
        ? "gp-hris-34"
        : metrics.employees[0]
          ? "external-28"
          : "external-21",
    periodStart: metrics.periodStart,
    periodEnd: metrics.periodEnd,
    employeeCount: metrics.employeeCount,
    hoursWorkedTotal: metrics.hoursWorkedTotal,
    regOTHoursTotal: metrics.regOTHoursTotal,
    grossAmountTotal: metrics.grossAmountTotal,
    netAmountTotal: metrics.netAmountTotal,
    silCutoffTotal: metrics.silCutoffTotal,
    totalOTAmount: metrics.totalOTAmount,
    payoutDate: metrics.payoutDate,
    companyName: metrics.companyName,
    spotCheckEmployee: metrics.employees[0]?.name?.split(",")[0] ?? "",
    notes: "Auto-generated — review and edit before committing manifest.json",
  };
}

function printSummary(filePath, metrics) {
  const rel = path.relative(process.cwd(), filePath);
  const sumGross = metrics.employees.reduce((s, e) => s + e.grossAmount, 0);
  console.log(`\n📄 ${rel}`);
  console.log(`   Company:     ${metrics.companyName ?? "—"}`);
  console.log(`   Period:      ${metrics.periodStart} → ${metrics.periodEnd}`);
  console.log(`   Payout:      ${metrics.payoutDate ?? "—"}`);
  console.log(`   Employees:   ${metrics.employeeCount} parsed`);
  console.log(`   Gross:       ₱${metrics.grossAmountTotal.toLocaleString()}`);
  console.log(`   Net:         ₱${metrics.netAmountTotal.toLocaleString()}`);
  console.log(`   Total OT:    ₱${(metrics.totalOTAmount ?? 0).toLocaleString()}`);
  console.log(`   SIL cutoff:  ₱${metrics.silCutoffTotal.toLocaleString()}`);
  console.log(`   Σ emp gross: ₱${sumGross.toLocaleString()} (${Math.abs(sumGross - metrics.grossAmountTotal) < 0.02 ? "matches" : "MISMATCH"})`);
  console.log(`   Format:      ${metrics.sourceFormat}`);
  if (metrics.employees[0]) {
    const e = metrics.employees[0];
    console.log(`   Sample row:  ${e.name} — gross ₱${e.grossAmount.toLocaleString()}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const manifestStubFlag = args.indexOf("--manifest-stub");
  const stubFileName =
    manifestStubFlag >= 0 ? args[manifestStubFlag + 1] : null;

  if (!fs.existsSync(SAMPLES_DIR)) {
    fs.mkdirSync(SAMPLES_DIR, { recursive: true });
  }

  const pdfPaths = collectPdfPaths(args);

  if (pdfPaths.length === 0) {
    console.log(`No PDFs found. Drop files in:\n  ${SAMPLES_DIR}\n`);
    process.exit(0);
  }

  const { parsePayrollRegisterPdf } = await import(
    "../lib/payroll-summary/parse-payroll-register-pdf.ts"
  );

  const manifest = loadManifest();
  let failures = 0;

  for (const pdfPath of pdfPaths) {
    const fileName = path.basename(pdfPath);
    try {
      const buffer = fs.readFileSync(pdfPath);
      const metrics = await parsePayrollRegisterPdf(buffer);
      printSummary(pdfPath, metrics);

      if (stubFileName && fileName === stubFileName) {
        console.log("\n--- manifest stub (copy into manifest.json) ---");
        console.log(
          JSON.stringify(
            { [fileName]: manifestStubFromMetrics(fileName, metrics) },
            null,
            2
          )
        );
      }

      const expected = manifest.samples?.[fileName];
      if (expected) {
        const checks = [
          ["periodStart", expected.periodStart, metrics.periodStart],
          ["periodEnd", expected.periodEnd, metrics.periodEnd],
          ["employeeCount", expected.employeeCount, metrics.employeeCount],
          ["companyName", expected.companyName, metrics.companyName],
        ];
        for (const [label, exp, act] of checks) {
          if (exp != null && exp !== act) {
            console.log(`   ⚠ manifest ${label}: expected ${exp}, got ${act}`);
            failures++;
          }
        }
        for (const key of [
          "hoursWorkedTotal",
          "regOTHoursTotal",
          "grossAmountTotal",
          "netAmountTotal",
          "silCutoffTotal",
          "totalOTAmount",
        ]) {
          if (expected[key] == null) continue;
          if (Math.abs(expected[key] - metrics[key]) > 0.01) {
            console.log(
              `   ⚠ manifest ${key}: expected ${expected[key]}, got ${metrics[key]}`
            );
            failures++;
          }
        }
        if (expected.spotCheckEmployee) {
          const found = metrics.employees.some((e) =>
            e.name.includes(expected.spotCheckEmployee)
          );
          if (!found) {
            console.log(
              `   ⚠ manifest spotCheckEmployee "${expected.spotCheckEmployee}" not found`
            );
            failures++;
          }
        }
        if (failures === 0) {
          console.log("   ✓ matches manifest.json");
        }
      } else {
        console.log("   ℹ no manifest entry — run with --manifest-stub to generate one");
      }
    } catch (err) {
      console.error(`\n❌ ${fileName}: ${err.message}`);
      failures++;
    }
  }

  console.log(`\n${pdfPaths.length} file(s) processed.${failures ? ` ${failures} issue(s).` : ""}`);
  if (failures) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
