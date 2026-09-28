import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SSS_NET_FLOOR,
  netBeforeSss,
  shouldDeductSss,
} from "../sss-net-floor";
import { buildRegisterLine } from "@/lib/payroll-register/compute";
import type { CutoffHoursRow } from "@/lib/ph-payroll/premiums";

describe("shouldDeductSss", () => {
  it("requires NET before SSS strictly above ₱2,000", () => {
    assert.equal(SSS_NET_FLOOR, 2000);
    assert.equal(shouldDeductSss(2000.01), true);
    assert.equal(shouldDeductSss(2000), false);
    assert.equal(shouldDeductSss(1999.99), false);
    assert.equal(shouldDeductSss(0), false);
    assert.equal(shouldDeductSss(-100), false);
  });
});

describe("netBeforeSss", () => {
  it("is gross minus non-SSS deductions", () => {
    assert.equal(
      netBeforeSss({
        gross: 5000,
        philhealth: 300,
        pagibig: 100,
        withholding_tax: 50,
        loans: 200,
        other: 50,
      }),
      4300
    );
  });
});

function hoursRow(overrides: Partial<CutoffHoursRow> = {}): CutoffHoursRow {
  return {
    id: "h1",
    directory_employee_id: "d1",
    office_employee_id: "o1",
    employee_code: "E1",
    last_name: "Low",
    first_name: "Earner",
    daily_rate_payroll: 500,
    actual_regular_hours: 16,
    ...overrides,
  };
}

describe("buildRegisterLine SSS net floor", () => {
  it("skips SSS when net before SSS is at or below ₱2,000", () => {
    // 16h × (₱500/8) = ₱1,000 gross — below floor even before other deductions.
    const line = buildRegisterLine({
      hoursRow: hoursRow({ actual_regular_hours: 16 }),
      payee: { id: "o1", monthly_rate: 13000, daily_rate: 500 },
      loans: [],
      periodStart: new Date("2026-03-16T00:00:00Z"),
      statutory: { sss: true, philhealth: true, pagibig: true, wtax: true },
    });
    assert.ok(line.gross_pay <= 2000);
    assert.equal(line.deductions.sss, 0);
    assert.equal(line.deductions.sss_regular, 0);
    assert.equal(line.deductions.sss_wisp, 0);
    assert.equal(line.deductions.sss_er, 0);
    assert.equal(line.deductions.sss_ecc, 0);
  });

  it("keeps SSS when net before SSS is above ₱2,000", () => {
    // 80h × (₱500/8) = ₱5,000 gross.
    const line = buildRegisterLine({
      hoursRow: hoursRow({ actual_regular_hours: 80 }),
      payee: { id: "o1", monthly_rate: 13000, daily_rate: 500 },
      loans: [],
      periodStart: new Date("2026-03-16T00:00:00Z"),
      statutory: { sss: true, philhealth: true, pagibig: true, wtax: true },
    });
    assert.ok(line.gross_pay > 2000);
    assert.ok((line.deductions.sss ?? 0) > 0);
    assert.ok((line.deductions.sss_er ?? 0) > 0);
  });
});
