import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statutoryThisCutoff } from "@/lib/ph-payroll/statutory-schedule";
import { buildRegisterLine } from "@/lib/payroll-register/compute";
import {
  buildCutoffCsvPack,
  monthlyRemittanceHeld,
  monthlyRemittanceHeldMessage,
  remittanceFilesThisCutoff,
} from "../cutoff-report-pack";

const organic = {
  cut1_start: 1,
  cut1_end: 15,
  cut2_start: 16,
  cut2_end: 30,
  pay_frequency: "semi-monthly" as const,
  statutory_schedule: "Monthly",
  wtax_schedule: "Semi-Monthly",
};

const hoursRow = {
  id: "h1",
  directory_employee_id: "d1",
  office_employee_id: "o1",
  employee_code: "202609-00001",
  last_name: "Razal",
  first_name: "Jericko",
  daily_rate_payroll: 800,
  actual_regular_hours: 80,
};

describe("remittanceFilesThisCutoff", () => {
  it("holds SSS / PhilHealth / Pag-IBIG on the first Organic kinsena", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-01");
    const files = remittanceFilesThisCutoff(flags);
    assert.equal(files.sss, false);
    assert.equal(files.philhealth, false);
    assert.equal(files.pagibig, false);
    assert.equal(files.wtax, true);
    assert.equal(files.bank, true);
    assert.equal(files.other_deductions, true);
    assert.equal(files.register_detail, true);
    assert.equal(monthlyRemittanceHeld(flags, "sss"), true);
    assert.match(monthlyRemittanceHeldMessage("sss"), /second kinsena/);
  });

  it("releases monthly remittance on the second window", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-16");
    const files = remittanceFilesThisCutoff(flags);
    assert.equal(files.sss, true);
    assert.equal(files.wtax, true);
  });
});

describe("buildCutoffCsvPack", () => {
  const byDir = new Map([
    [
      "d1",
      {
        tin: "123-456-789-000",
        sss_number: "34-1234567-8",
        philhealth_number: "12-345678901-2",
        pagibig_number: "1210-1234-5678",
        bank_name: "BDO",
        bank_account_no: "001234567890",
      },
    ],
  ]);

  it("puts TIN and taxable income on WTAX", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-01");
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      statutory: flags,
    });
    const pack = buildCutoffCsvPack(
      "wtax",
      [line],
      byDir,
      "2026-09-01",
      "2026-09-15"
    );
    assert.deepEqual(pack.headers.slice(0, 5), [
      "employee_code",
      "last_name",
      "first_name",
      "tin",
      "withholding_tax",
    ]);
    assert.equal(pack.rows[0][3], "123-456-789-000");
    assert.equal(pack.rows[0][5], line.deductions.taxable_income);
    assert.equal(line.deductions.sss, 0);
    assert.equal(line.deductions.taxable_income, line.gross_pay);
  });

  it("uses Directory ATM number and ATM pay type on the bank file", () => {
    const line = buildRegisterLine({
      hoursRow,
      payee: {
        id: "o1",
        monthly_rate: 20800,
        daily_rate: 800,
        bank_name: "Wrong",
        bank_account_no: "office-acct",
      },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
    });
    const pack = buildCutoffCsvPack(
      "bank",
      [line],
      byDir,
      "2026-09-01",
      "2026-09-15"
    );
    assert.equal(pack.filename.startsWith("atm-"), true);
    assert.equal(pack.rows[0][3], "ATM");
    assert.equal(pack.rows[0][4], "001234567890");
    assert.equal(pack.rows[0][5], "BDO");
  });

  it("explodes loan particulars for the other-deduction list", () => {
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [
        {
          id: "loan-1",
          loan_type: "pagibig",
          particular: "Pag-IBIG Loan",
          monthly_payment: 2000,
          cutoff_assignment: "both",
        },
        {
          id: "loan-2",
          loan_type: "other",
          particular: "Cash Advance",
          monthly_payment: 1000,
          cutoff_assignment: "both",
        },
      ],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      otherDeductions: 50,
    });
    const pack = buildCutoffCsvPack(
      "other_deductions",
      [line],
      byDir,
      "2026-09-01",
      "2026-09-15"
    );
    const particulars = pack.rows.map((row) => row[3]);
    assert.ok(particulars.includes("Pag-IBIG Loan"));
    assert.ok(particulars.includes("Cash Advance"));
    assert.ok(particulars.includes("Other Deduction"));
  });

  it("includes EE and ER on SSS when statutory applies", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-16");
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      statutory: flags,
    });
    assert.ok((line.deductions.sss ?? 0) > 0);
    assert.ok((line.deductions.sss_er ?? 0) > 0);
    const pack = buildCutoffCsvPack(
      "sss",
      [line],
      byDir,
      "2026-09-16",
      "2026-09-30"
    );
    assert.equal(pack.rows[0][3], "34-1234567-8");
    assert.equal(pack.rows[0][4], line.deductions.sss);
    assert.equal(pack.rows[0][5], line.deductions.sss_er);
  });

  it("includes COLA / SEA / CTPA and billing columns on register detail", () => {
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      supplementalPolicy: {
        include_cola: true,
        include_sea: false,
        include_ctpa: false,
      },
      supplementalRates: {
        employee_ecola: 50,
        position_sea: 10,
        employee_billing_daily_rate: 900,
      },
    });
    assert.equal(line.earnings.cola_per_day, 50);
    assert.equal(line.earnings.cola_payroll, 500);
    assert.equal(line.earnings.sea_payroll, 0);
    assert.equal(line.earnings.billing_gross_estimate, 9000);
    assert.equal(line.gross_pay, 8000);

    const pack = buildCutoffCsvPack(
      "register_detail",
      [line],
      byDir,
      "2026-09-01",
      "2026-09-15",
      {
        include_cola: true,
        include_sea: false,
        include_ctpa: false,
      }
    );
    assert.equal(pack.headers.includes("cola_payroll"), true);
    assert.equal(pack.rows[0][9], 500);
    assert.equal(pack.rows[0][14], 900);
    assert.equal(pack.rows[0][15], 9000);
  });
});
