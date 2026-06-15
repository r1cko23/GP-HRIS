#!/usr/bin/env node
/**
 * Parse all Payroll Summary PDFs under samples/ and write manifest.generated.json.
 *
 * Usage: npm run train:payroll-samples
 */

const fs = require("fs");
const path = require("path");
const {
  PAYROLL_REGISTERS_DIR,
  SAMPLES_ROOT,
  collectPayrollSummaryPdfs,
} = require("./payroll-sample-utils");

function manifestStub(sampleKey, metrics) {
  const parts = sampleKey.split("/");
  const clientFolder = parts[0] ?? "Unknown";
  return {
    client: clientFolder,
    layout:
      metrics.sourceFormat === "gp_hris"
        ? "gp-hris-34"
        : metrics.employees[0]
          ? `external-auto`
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
    sourcePath: sampleKey,
  };
}

async function main() {
  const { parsePayrollRegisterPdf } = await import(
    "../lib/payroll-summary/parse-payroll-register-pdf.ts"
  );

  const pdfs = collectPayrollSummaryPdfs();
  const samples = {};
  let ok = 0;
  let fail = 0;

  for (const { key, absPath } of pdfs) {
    try {
      const metrics = await parsePayrollRegisterPdf(fs.readFileSync(absPath));
      samples[key] = manifestStub(key, metrics);
      ok++;
    } catch (err) {
      samples[key] = {
        error: err.message,
        sourcePath: key,
      };
      fail++;
    }
  }

  const output = {
    $schema: "./manifest.schema.json",
    description:
      "Auto-generated from Payroll Summary PDFs under samples/ (path-keyed)",
    generatedAt: new Date().toISOString(),
    parsedOk: ok,
    parseFailed: fail,
    samples,
  };

  const outPath = path.join(PAYROLL_REGISTERS_DIR, "manifest.generated.json");
  fs.mkdirSync(PAYROLL_REGISTERS_DIR, { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(
    `Trained on ${pdfs.length} Payroll Summary PDF(s) under ${SAMPLES_ROOT}`
  );
  console.log(`  ✓ parsed: ${ok}`);
  console.log(`  ✗ failed: ${fail}`);
  console.log(`  → ${outPath}`);

  if (fail > 0) {
    console.log("\nFailures:");
    for (const [key, value] of Object.entries(samples)) {
      if (value.error) console.log(`  - ${key}: ${value.error}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
