import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reconcileApprovedWorkLines } from "../reconcile";

describe("reconcileApprovedWorkLines", () => {
  it("classifies matched, pay-only, bill-only, and variance rows", () => {
    const rows = reconcileApprovedWorkLines({
      approvedWorkLines: [
        { id: "matched", payable: true, billable: true },
        { id: "pay-only", payable: true, billable: false },
        { id: "bill-only", payable: false, billable: false },
        { id: "variance", payable: true, billable: true },
      ],
      payableLines: [
        { approvedWorkLineId: "matched", totalAmount: 100 },
        { approvedWorkLineId: "pay-only", totalAmount: 80 },
        { approvedWorkLineId: "variance", totalAmount: 90 },
      ],
      billableLines: [
        { approvedWorkLineId: "matched", totalAmount: 100 },
        { approvedWorkLineId: "bill-only", totalAmount: 25 },
        { approvedWorkLineId: "variance", totalAmount: 120 },
      ],
    });

    assert.deepEqual(
      rows.map(({ id, reconciliationStatus, varianceAmount }) => ({
        id,
        reconciliationStatus,
        varianceAmount,
      })),
      [
        { id: "matched", reconciliationStatus: "matched", varianceAmount: 0 },
        {
          id: "pay-only",
          reconciliationStatus: "pay_only",
          varianceAmount: -80,
        },
        {
          id: "bill-only",
          reconciliationStatus: "bill_only",
          varianceAmount: 25,
        },
        {
          id: "variance",
          reconciliationStatus: "variance",
          varianceAmount: 30,
        },
      ]
    );
  });
});
