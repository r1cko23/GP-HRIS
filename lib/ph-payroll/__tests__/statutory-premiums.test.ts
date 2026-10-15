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

  it("charges full monthly Pag-IBIG when amountMode is full (MAIN first kinsena)", () => {
    const d = getCutoffStatutoryDeductions(20000, "full");
    assert.equal(d.pagibig, 200);
    assert.equal(d.pagibig_er, 200);
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

  it("does not deduct absences/tardiness again when RH is already net of them", () => {
    // GP-Client (and MAIN) bake late/absence into actual_regular_hours.
    // Re-deducting those hours from gross double-counts (Nabati −₱695/−₱1,800 clusters).
    const { earnings, gross } = computeEarningsFromHours(
      {
        id: "h1",
        directory_employee_id: null,
        office_employee_id: null,
        employee_code: null,
        last_name: null,
        first_name: null,
        daily_rate_payroll: 695,
        actual_regular_hours: 96,
        absences_hours: 8,
        tardiness_hours: 0.5,
        allowance: 1001.52,
      },
      695
    );
    assert.equal(earnings.basic, 8340);
    assert.equal(earnings.allowance, 1001.52);
    assert.equal(earnings.tardiness_undertime_absence, 0);
    assert.equal(gross, 9341.52);
  });

  it("GP-Client NDOT is only the 0.125 top-up when OT already includes those hours (Abas)", () => {
    // SMXCC Abas: RH 56 + OT 23 (includes 5 NDOT) + ND 8 @ 695 → ₱7,486.46
    const { earnings, gross } = computeEarningsFromHours(
      {
        id: "abas",
        directory_employee_id: null,
        office_employee_id: null,
        employee_code: "202606-00234",
        last_name: "Abas",
        first_name: "Ibrahim Tabang",
        daily_rate_payroll: 695,
        source_of_data: "GP-CLIENT",
        actual_regular_hours: 56,
        overtime_hours: 23,
        night_diff_hours: 8,
        regular_night_ot_hours: 5,
      },
      695
    );
    assert.equal(earnings.basic, 4865);
    assert.equal(earnings.overtime, 2497.66);
    assert.equal(earnings.night_diff, 69.5);
    assert.equal(earnings.regular_night_ot, 54.3);
    assert.equal(gross, 7486.46);
  });

  it("pays NWPC combo buckets that used to be dropped (hourly 100)", () => {
    // Differentials assume parent day/OT buckets are paid separately.
    const { earnings, gross } = computeEarningsFromHours(
      {
        id: "combo",
        directory_employee_id: null,
        office_employee_id: null,
        employee_code: null,
        last_name: null,
        first_name: null,
        daily_rate_payroll: 800,
        source_of_data: "GREENHRISMAIN",
        actual_regular_hours: 0,
        rest_day_hours: 8,
        rest_day_nd_hours: 2,
        rest_day_ot_hours: 2,
        rest_day_ot_nd_hours: 1,
        special_holiday_hours: 8,
        special_holiday_nd_hours: 2,
        special_holiday_ot_hours: 2,
        special_holiday_ot_nd_hours: 1,
        legal_holiday_hours: 8,
        legal_holiday_nd_hours: 2,
        legal_holiday_ot_hours: 2,
        legal_holiday_ot_nd_hours: 1,
        lh_rest_day_hours: 8,
        lh_rest_day_ot_hours: 2,
        sh_rest_day_hours: 8,
        sh_rest_day_ot_hours: 2,
      },
      800
    );
    assert.equal(earnings.rest_day, 1040);
    assert.equal(earnings.rest_day_nd, 26); // 2 × 100 × 0.13
    assert.equal(earnings.rest_day_ot, 338); // 2 × 100 × 1.69
    assert.equal(earnings.rest_day_ot_nd, 16.9); // 1 × 100 × 0.169
    assert.equal(earnings.special_holiday, 1040);
    assert.equal(earnings.special_holiday_nd, 26);
    assert.equal(earnings.special_holiday_ot, 338);
    assert.equal(earnings.special_holiday_ot_nd, 16.9);
    assert.equal(earnings.legal_holiday, 1600);
    assert.equal(earnings.legal_holiday_nd, 40); // 2 × 100 × 0.2
    assert.equal(earnings.legal_holiday_ot, 520); // 2 × 100 × 2.6
    assert.equal(earnings.legal_holiday_ot_nd, 26); // 1 × 100 × 0.26
    assert.equal(earnings.lh_rest_day, 2080); // 8 × 100 × 2.6
    assert.equal(earnings.lh_rest_day_ot, 676); // 2 × 100 × 3.38
    assert.equal(earnings.sh_rest_day, 1200); // 8 × 100 × 1.5
    assert.equal(earnings.sh_rest_day_ot, 390); // 2 × 100 × 1.95
    assert.equal(gross, 9373.8);
  });
});
