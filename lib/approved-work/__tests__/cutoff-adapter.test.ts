import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDraftChargeLinesFromCutoff } from "../cutoff-adapter";

describe("buildDraftChargeLinesFromCutoff", () => {
  it("uses snapshotted cutoff pay and Directory placement bill rates", () => {
    const [draft] = buildDraftChargeLinesFromCutoff({
      approvedWorkLines: [
        {
          id: "work-1",
          sourceCutoffHoursId: "hours-1",
          directoryEmployeeId: "employee-1",
          employeeCode: "GP-001",
          firstName: "Ana",
          lastName: "Reyes",
          regularHours: 80,
          payable: true,
          billable: true,
        },
      ],
      cutoffHours: [
        {
          id: "hours-1",
          directoryEmployeeId: "employee-1",
          dailyRatePayroll: 800,
        },
      ],
      directoryRates: [
        {
          directoryEmployeeId: "employee-1",
          payrollDailyRate: 700,
          billingDailyRate: 1000,
        },
      ],
    });

    assert.equal(draft.rates.payrollDailyRate, 800);
    assert.equal(draft.rates.billingDailyRate, 1000);
    assert.equal(draft.payable.totalAmount, 8000);
    assert.equal(draft.billable.totalAmount, 10000);
  });

  it("retains a nonbillable pay line and an independent bill-only adjustment", () => {
    const drafts = buildDraftChargeLinesFromCutoff({
      approvedWorkLines: [
        {
          id: "pay-only",
          sourceCutoffHoursId: "hours-1",
          directoryEmployeeId: "employee-1",
          employeeCode: null,
          firstName: null,
          lastName: null,
          regularHours: 8,
          payable: true,
          billable: false,
        },
        {
          id: "bill-adjustment",
          sourceCutoffHoursId: null,
          directoryEmployeeId: "employee-1",
          employeeCode: null,
          firstName: null,
          lastName: null,
          regularHours: 0,
          payable: false,
          billable: false,
          billableAdjustmentAmount: 250,
        },
      ],
      cutoffHours: [
        {
          id: "hours-1",
          directoryEmployeeId: "employee-1",
          dailyRatePayroll: 800,
        },
      ],
      directoryRates: [
        {
          directoryEmployeeId: "employee-1",
          payrollDailyRate: 800,
          billingDailyRate: 1000,
        },
      ],
    });

    assert.equal(drafts[0].payable.totalAmount, 800);
    assert.equal(drafts[0].billable.totalAmount, 0);
    assert.equal(drafts[1].payable.totalAmount, 0);
    assert.equal(drafts[1].billable.totalAmount, 250);
  });
});
