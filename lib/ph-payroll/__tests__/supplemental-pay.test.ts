import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSupplementalPayroll,
  payrollDaysFromHours,
  resolveSupplementalRates,
} from "../supplemental-pay";

describe("supplemental-pay", () => {
  it("resolves employee ecola over position", () => {
    const rates = resolveSupplementalRates({
      employee_ecola: 50,
      position_ecola: 30,
      position_sea: 10,
      position_ctpa: 5,
      employee_billing_daily_rate: 800,
    });
    assert.equal(rates.cola_per_day, 50);
    assert.equal(rates.sea_per_day, 10);
    assert.equal(rates.billing_daily_rate, 800);
  });

  it("zeros payroll amounts when client flags are off", () => {
    const rates = resolveSupplementalRates({
      employee_ecola: 50,
      position_sea: 10,
      position_ctpa: 5,
      employee_billing_daily_rate: 600,
    });
    const supplemental = computeSupplementalPayroll({
      policy: {
        include_cola: false,
        include_sea: false,
        include_ctpa: false,
      },
      rates,
      daysWork: 10,
    });
    assert.equal(supplemental.cola_payroll, 0);
    assert.equal(supplemental.sea_payroll, 0);
    assert.equal(supplemental.ctpa_payroll, 0);
    assert.equal(supplemental.cola_per_day, 50);
    assert.equal(supplemental.billing_gross_estimate, 6000);
  });

  it("computes allowance payroll when flags are on", () => {
    const rates = resolveSupplementalRates({
      employee_ecola: 50,
      position_sea: 10,
      position_ctpa: 5,
    });
    const supplemental = computeSupplementalPayroll({
      policy: {
        include_cola: true,
        include_sea: true,
        include_ctpa: true,
      },
      rates,
      daysWork: 8,
    });
    assert.equal(supplemental.cola_payroll, 400);
    assert.equal(supplemental.sea_payroll, 80);
    assert.equal(supplemental.ctpa_payroll, 40);
  });

  it("derives days from regular and PTO hours", () => {
    assert.equal(
      payrollDaysFromHours({ actual_regular_hours: 72, pto_hours: 8 }),
      10
    );
  });
});
