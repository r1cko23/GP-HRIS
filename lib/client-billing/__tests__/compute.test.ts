import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeBillingLine,
  feeRate,
  registerIsBillable,
  resolveBillingDailyRate,
  wrapBillingSoa,
} from "../compute";

describe("feeRate", () => {
  it("keeps Directory fractions (0.12 = 12%)", () => {
    assert.equal(feeRate(0.12), 0.12);
    assert.equal(feeRate(0.055), 0.055);
  });

  it("treats values above 1 as percents", () => {
    assert.equal(feeRate(12), 0.12);
  });
});

describe("registerIsBillable", () => {
  it("is false when nobody has a billing daily rate (Organic house)", () => {
    assert.equal(
      registerIsBillable([{ billing_daily_rate: 0 }, { billing_daily_rate: null }]),
      false
    );
  });

  it("is true when any line has a billing daily rate", () => {
    assert.equal(
      registerIsBillable([{ billing_daily_rate: 0 }, { billing_daily_rate: 800 }]),
      true
    );
  });
});

describe("resolveBillingDailyRate", () => {
  it("uses the register snapshot when it is already billed", () => {
    assert.equal(
      resolveBillingDailyRate({
        register_billing_daily_rate: 900,
        employee_billing_daily_rate: 800,
        position_billing_daily_rate: 700,
      }),
      900
    );
  });

  it("falls back to the Directory person when the posted register has 0", () => {
    assert.equal(
      resolveBillingDailyRate({
        register_billing_daily_rate: 0,
        employee_billing_daily_rate: 695,
        position_billing_daily_rate: 600,
      }),
      695
    );
  });

  it("falls back to the position card when the person has no billing rate", () => {
    assert.equal(
      resolveBillingDailyRate({
        register_billing_daily_rate: 0,
        employee_billing_daily_rate: 0,
        position_billing_daily_rate: 600,
      }),
      600
    );
  });

  it("stays 0 when nothing has a billing rate (Organic house)", () => {
    assert.equal(
      resolveBillingDailyRate({
        register_billing_daily_rate: 0,
        employee_billing_daily_rate: null,
        position_billing_daily_rate: 0,
      }),
      0
    );
  });
});

describe("computeBillingLine", () => {
  it("bills Regular from hours_work × billing hourly (GREENHRISMAIN noofhourswork)", () => {
    const line = computeBillingLine({
      hours: {
        hours_work: 80,
        actual_regular_hours: 72,
        overtime_hours: 2,
        night_diff_hours: 1,
      },
      billing_daily_rate: 800,
    });
    assert.equal(line.billing_hourly_rate, 100);
    assert.equal(line.amounts.regular, 8000);
    assert.equal(line.amounts.overtime, 250);
    assert.equal(line.amounts.night_diff, 10);
    assert.equal(line.labor, 8260);
  });

  it("does not knock tardiness off billed Regular", () => {
    const line = computeBillingLine({
      hours: {
        hours_work: 80,
        actual_regular_hours: 80,
        tardiness_hours: 2,
      },
      billing_daily_rate: 800,
    });
    assert.equal(line.amounts.regular, 8000);
    assert.equal(line.labor, 8000);
  });

  it("adds employer mandatories as bill-back, not payroll net", () => {
    const line = computeBillingLine({
      hours: { hours_work: 8, actual_regular_hours: 8 },
      billing_daily_rate: 800,
      mandatories: { sss_er: 100, philhealth_er: 50, pagibig_er: 100, sss_ecc: 10 },
    });
    assert.equal(line.labor, 800);
    assert.equal(line.mandatories, 260);
    assert.equal(line.billable, 1060);
  });
});

describe("wrapBillingSoa", () => {
  it("applies admin fee then VAT and EWT on the vatable base", () => {
    const soa = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    assert.equal(soa.subtotal, 8260);
    assert.equal(soa.admin_fee_amount, 454.3);
    assert.equal(soa.vatable, 8714.3);
    assert.equal(soa.vat_amount, 1045.72);
    assert.equal(soa.ewt_amount, 174.29);
    assert.equal(soa.amount_due, 9585.73);
  });
});
