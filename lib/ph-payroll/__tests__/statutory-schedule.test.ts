import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { statutoryThisCutoff } from "../statutory-schedule";
import { buildRegisterLine } from "@/lib/payroll-register/compute";

const organic = {
  cut1_start: 1,
  cut1_end: 15,
  cut2_start: 16,
  cut2_end: 30,
  pay_frequency: "semi-monthly" as const,
  statutory_schedule: "Monthly",
  wtax_schedule: "Semi-Monthly",
};

describe("statutoryThisCutoff", () => {
  it("skips SSS / PhilHealth / Pag-IBIG on Organic first kinsena", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-01");
    assert.equal(flags.window, "first");
    assert.equal(flags.sss, false);
    assert.equal(flags.philhealth, false);
    assert.equal(flags.pagibig, false);
    assert.equal(flags.wtax, true);
  });

  it("applies full monthly SSS / PhilHealth / Pag-IBIG on the second window", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-16");
    assert.equal(flags.window, "second");
    assert.equal(flags.sss, true);
    assert.equal(flags.amountMode, "full");
    assert.equal(flags.pagibigAmountMode, "full");
    assert.equal(flags.wtax, true);
  });

  it("Semi-Monthly Deployed: full Pag-IBIG on first kinsena only (MAIN)", () => {
    const semi = {
      cut1_start: 1,
      cut1_end: 15,
      cut2_start: 16,
      cut2_end: 30,
      pay_frequency: "semi-monthly" as const,
      statutory_schedule: "Semi-Monthly",
      wtax_schedule: "Semi-Monthly",
    };
    const first = statutoryThisCutoff(semi, "2026-09-01");
    assert.equal(first.pagibig, true);
    assert.equal(first.pagibigAmountMode, "full");
    assert.equal(first.philhealthFixedEe, 250);
    assert.equal(first.sss, true);
    assert.equal(first.sssBasis, "period_gross");
    assert.equal(first.amountMode, "half");
    const second = statutoryThisCutoff(semi, "2026-09-16");
    assert.equal(second.pagibig, false);
    assert.equal(second.philhealthFixedEe, null);
    assert.equal(second.sss, true);
    // Second kinsena still rate-based half until MTD prior SSS is wired.
    assert.equal(second.sssBasis, "monthly_rate");
    assert.equal(second.amountMode, "half");
  });
});

describe("buildRegisterLine with Client statutory policy", () => {
  const hoursRow = {
    id: "h1",
    directory_employee_id: "d1",
    office_employee_id: "o1",
    employee_code: "202609-00001",
    last_name: "Test",
    first_name: "Hire",
    daily_rate_payroll: 800,
    actual_regular_hours: 80,
  };

  it("zeros SSS on the first Organic kinsena", () => {
    const flags = statutoryThisCutoff(organic, "2026-09-01");
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      statutory: flags,
    });
    assert.equal(line.deductions.sss, 0);
    assert.equal(line.deductions.philhealth, 0);
    assert.equal(line.deductions.pagibig, 0);
    assert.equal(line.deductions.taxable_income, line.gross_pay);
    assert.ok((line.deductions.withholding_tax ?? 0) >= 0);
    assert.ok(line.gross_pay > 0);
  });

  it("Semi-Monthly first kinsena: SSS from period gross (MAIN Nabati), not half of daily×26", () => {
    const semi = {
      cut1_start: 1,
      cut1_end: 15,
      cut2_start: 16,
      cut2_end: 30,
      pay_frequency: "semi-monthly" as const,
      statutory_schedule: "Semi-Monthly",
      wtax_schedule: "Semi-Monthly",
    };
    const flags = statutoryThisCutoff(semi, "2026-09-01");
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", monthly_rate: 20800, daily_rate: 800 },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      statutory: flags,
    });
    // 80h × ₱100/h = ₱8,000 period gross → MSC 8,000 → EE ₱400 (full table).
    // Old half-of-rate path: daily×26 = 20,800 → half of ₱1,050 = ₱525.
    assert.equal(line.gross_pay, 8000);
    assert.equal(line.deductions.sss, 400);
    assert.equal(line.deductions.philhealth, 250);
    assert.equal(line.deductions.pagibig, 200);
  });
});
