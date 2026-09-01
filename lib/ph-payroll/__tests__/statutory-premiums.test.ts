import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getCutoffStatutoryDeductions,
  emptyCutoffStatutory,
} from "../statutory-cutoff";
import { PREMIUM_RATES, PAYROLL_MULTIPLIERS, computeEarningsFromHours } from "../premiums";

describe("getCutoffStatutoryDeductions", () => {
  it("returns zeros when monthly salary is 0", () => {
    assert.deepEqual(getCutoffStatutoryDeductions(0), emptyCutoffStatutory());
  });

  it("caps Pag-IBIG EE/ER at ₱100 per cutoff when fund salary is at MFS (₱20k/mo)", () => {
    const d = getCutoffStatutoryDeductions(20000);
    assert.equal(d.pagibig, 100);
    assert.equal(d.pagibig_er, 100);
  });

  it("uses low-salary tier for Pag-IBIG when fund salary ≤ ₱1,500", () => {
    const d = getCutoffStatutoryDeductions(1200);
    assert.equal(d.pagibig, 6);
    assert.equal(d.pagibig_er, 12);
  });

  it("EE total excludes employer shares", () => {
    const d = getCutoffStatutoryDeductions(20000);
    assert.equal(d.total, d.sss + d.philhealth + d.pagibig);
    assert.ok(d.sss_er > 0);
    assert.ok(d.philhealth_er > 0);
    assert.ok(d.pagibig_er > 0);
  });

  it("splits SSS WISP for MSC above 20k", () => {
    const d = getCutoffStatutoryDeductions(35000);
    assert.ok(d.sss_wisp > 0);
    assert.equal(d.sss, d.sss_regular + d.sss_wisp);
  });
});

describe("PREMIUM_RATES", () => {
  it("matches weekly adapter for OT, rest day, ND, LH", () => {
    assert.equal(PAYROLL_MULTIPLIERS.REGULAR_OT, PREMIUM_RATES.overtime);
    assert.equal(PAYROLL_MULTIPLIERS.REST_DAY, PREMIUM_RATES.rest_day);
    assert.equal(PAYROLL_MULTIPLIERS.NIGHT_DIFF, PREMIUM_RATES.night_diff);
    assert.equal(PAYROLL_MULTIPLIERS.REGULAR_HOLIDAY, PREMIUM_RATES.legal_holiday);
    assert.equal(
      PAYROLL_MULTIPLIERS.SUNDAY_REGULAR_HOLIDAY,
      PREMIUM_RATES.legal_holiday_ot
    );
  });

  it("computes rest-day earnings at 1.3", () => {
    const { earnings, gross } = computeEarningsFromHours(
      {
        id: "h1",
        directory_employee_id: null,
        office_employee_id: null,
        employee_code: null,
        last_name: null,
        first_name: null,
        daily_rate_payroll: 800,
        actual_regular_hours: 0,
        rest_day_hours: 8,
      },
      800
    );
    assert.equal(earnings.rest_day, 1040);
    assert.equal(gross, 1040);
  });
});
