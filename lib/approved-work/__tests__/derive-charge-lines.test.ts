import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveChargeLines,
  type ApprovedWorkLineInput,
} from "../derive-charge-lines";

const work: ApprovedWorkLineInput = {
  approvedWorkLineId: "work-1",
  directoryEmployeeId: "employee-1",
  employeeCode: "GP-001",
  firstName: "Ana",
  lastName: "Reyes",
  regularHours: 80,
  payable: true,
  billable: true,
  payrollHourlyRate: 12.5,
  billingHourlyRate: 15.625,
};

describe("deriveChargeLines", () => {
  it("derives distinct payable and billable amounts from the same approved work", () => {
    assert.deepEqual(deriveChargeLines(work), {
      payable: {
        approvedWorkLineId: "work-1",
        directoryEmployeeId: "employee-1",
        employeeCode: "GP-001",
        firstName: "Ana",
        lastName: "Reyes",
        regularHours: 80,
        baseAmount: 1000,
        adjustmentAmount: 0,
        totalAmount: 1000,
        rate: 12.5,
        isChargeable: true,
      },
      billable: {
        approvedWorkLineId: "work-1",
        directoryEmployeeId: "employee-1",
        employeeCode: "GP-001",
        firstName: "Ana",
        lastName: "Reyes",
        regularHours: 80,
        baseAmount: 1250,
        adjustmentAmount: 0,
        totalAmount: 1250,
        rate: 15.625,
        isChargeable: true,
      },
    });
  });

  it("keeps payable work that is explicitly nonbillable", () => {
    const result = deriveChargeLines({ ...work, billable: false });

    assert.equal(result.payable.totalAmount, 1000);
    assert.equal(result.billable.totalAmount, 0);
    assert.equal(result.billable.isChargeable, false);
  });

  it("supports a bill-only adjustment without changing payable charges", () => {
    const result = deriveChargeLines({
      ...work,
      regularHours: 0,
      payable: false,
      billable: false,
      payableAdjustmentAmount: 0,
      billableAdjustmentAmount: 150,
    });

    assert.equal(result.payable.totalAmount, 0);
    assert.equal(result.billable.baseAmount, 0);
    assert.equal(result.billable.adjustmentAmount, 150);
    assert.equal(result.billable.totalAmount, 150);
    assert.equal(result.billable.isChargeable, true);
  });
});
