#!/usr/bin/env node
/**
 * Verify payroll summary PDF parser against the Chicha Hut sample file.
 *
 * Usage:
 *   npm run verify:payroll-summary-parser
 *   node scripts/verify-payroll-summary-parser.js [path-to.pdf]
 */

const fs = require("fs");
const path = require("path");

const SAMPLE_PDFS = process.argv[2]
  ? [process.argv[2]]
  : [
      path.join(process.cwd(), "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf"),
      path.join(process.cwd(), "PAYROLL SUMMARY_CHICHA HUT_16-31.pdf"),
      path.join(process.cwd(), "Payroll summary_CONVERGE_1-15.pdf"),
      path.join(process.cwd(), "Payroll summary_converge_16-31.pdf"),
    ];

const EXPECTED_BY_FILE = {
  "PAYROLL SUMMARY_CHICHA HUT_1-15.pdf": {
    periodStart: "2026-05-01",
    periodEnd: "2026-05-15",
    employeeCount: 4,
    hoursWorkedTotal: 392.55,
    regOTHoursTotal: 11,
    grossAmountTotal: 37278.38,
    netAmountTotal: 33448.06,
    silCutoffTotal: 552.81,
    totalOTAmount: 2680.2,
    payoutDate: "2026-05-20",
    companyName: "CHICHA HUT FOOD CORP.",
    spotCheckEmployee: "BOLOCON",
  },
  "PAYROLL SUMMARY_CHICHA HUT_16-31.pdf": {
    periodStart: "2026-05-16",
    periodEnd: "2026-05-31",
    employeeCount: 4,
    hoursWorkedTotal: 428.06,
    regOTHoursTotal: 1,
    grossAmountTotal: 37656.51,
    netAmountTotal: 35459.69,
    silCutoffTotal: 601.57,
    totalOTAmount: 1667.31,
    payoutDate: "2026-06-05",
    companyName: "CHICHA HUT FOOD CORP.",
    spotCheckEmployee: "BOLOCON",
  },
  "Payroll summary_CONVERGE_1-15.pdf": {
    periodStart: "2026-05-01",
    periodEnd: "2026-05-15",
    employeeCount: 167,
    hoursWorkedTotal: 15678.83,
    regOTHoursTotal: 5888.5,
    grossAmountTotal: 2486064.9,
    netAmountTotal: 2272899,
    silCutoffTotal: 22208.13,
    totalOTAmount: 1095841.08,
    payoutDate: "2026-05-20",
    companyName: "CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC",
    spotCheckEmployee: "AVANCEÑA",
  },
  "Payroll summary_converge_16-31.pdf": {
    periodStart: "2026-05-16",
    periodEnd: "2026-05-31",
    employeeCount: 167,
    hoursWorkedTotal: 15977.62,
    regOTHoursTotal: 5620.5,
    grossAmountTotal: 2574294.5,
    netAmountTotal: 2350763.6,
    silCutoffTotal: 22666.3,
    totalOTAmount: 1155403.01,
    payoutDate: "2026-06-05",
    companyName: "CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC",
    spotCheckEmployee: "AVANCEÑA",
  },
};

function assertClose(actual, expected, label, tolerance = 0.01) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(
      `${label}: expected ${expected}, got ${actual} (tolerance ${tolerance})`
    );
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function verifyPdf(samplePdf) {
  if (!fs.existsSync(samplePdf)) {
    console.error(`❌ Sample PDF not found: ${samplePdf}`);
    process.exit(1);
  }

  const fileName = path.basename(samplePdf);
  const EXPECTED = EXPECTED_BY_FILE[fileName];
  if (!EXPECTED) {
    throw new Error(`No expected values for ${fileName}`);
  }

  const { parsePayrollRegisterPdf } = await import(
    "../lib/payroll-summary/parse-payroll-register-pdf.ts"
  );

  const buffer = fs.readFileSync(samplePdf);
  const metrics = await parsePayrollRegisterPdf(buffer);

  assertEqual(metrics.periodStart, EXPECTED.periodStart, "periodStart");
  assertEqual(metrics.periodEnd, EXPECTED.periodEnd, "periodEnd");
  assertEqual(metrics.employeeCount, EXPECTED.employeeCount, "employeeCount");
  assertEqual(metrics.companyName, EXPECTED.companyName, "companyName");
  assertEqual(metrics.payoutDate, EXPECTED.payoutDate, "payoutDate");
  assertEqual(metrics.sourceFormat, "external_register", "sourceFormat");

  assertClose(metrics.hoursWorkedTotal, EXPECTED.hoursWorkedTotal, "hoursWorkedTotal");
  assertClose(metrics.regOTHoursTotal, EXPECTED.regOTHoursTotal, "regOTHoursTotal");
  assertClose(metrics.grossAmountTotal, EXPECTED.grossAmountTotal, "grossAmountTotal");
  assertClose(metrics.netAmountTotal, EXPECTED.netAmountTotal, "netAmountTotal");
  assertClose(metrics.silCutoffTotal, EXPECTED.silCutoffTotal, "silCutoffTotal");
  assertClose(metrics.totalOTAmount, EXPECTED.totalOTAmount, "totalOTAmount");

  if (metrics.employees.length !== EXPECTED.employeeCount) {
    throw new Error(
      `employees.length: expected ${EXPECTED.employeeCount}, got ${metrics.employees.length}`
    );
  }

  const spotCheck = metrics.employees.find((e) =>
    e.name.includes(EXPECTED.spotCheckEmployee)
  );
  if (!spotCheck) {
    throw new Error(
      `Expected employee ${EXPECTED.spotCheckEmployee} not found`
    );
  }

  console.log(`✅ ${fileName}`);
}

async function main() {
  for (const samplePdf of SAMPLE_PDFS) {
    await verifyPdf(samplePdf);
  }
  console.log("✅ Payroll summary parser verification passed for all samples");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err.message);
  process.exit(1);
});
