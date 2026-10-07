import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  employmentStatusForTenureStatus,
  tenureInsertPayload,
} from "../tenure-employment";

describe("tenureInsertPayload", () => {
  it("always carries employment_id so Add employee hire cannot omit it", () => {
    const payload = tenureInsertPayload({
      organizationId: "org-1",
      employeeId: "emp-1",
      employmentId: "employment-1",
      sequence: 1,
      hire_date: "2026-09-30",
      resign_date: null,
      client_id: "c1",
      branch_id: "b1",
      position_id: "p1",
      daily_rate: null,
      billing_daily_rate: null,
      status: "for_verification",
      final_pay_status: "none",
      barred_reason: null,
      is_current: true,
      closed_at: null,
    });

    assert.equal(payload.employment_id, "employment-1");
    assert.equal(payload.employee_id, "emp-1");
    assert.equal(payload.status, "for_verification");
  });

  it("maps for_verification tenure to pending employment", () => {
    assert.equal(
      employmentStatusForTenureStatus("for_verification"),
      "pending"
    );
    assert.equal(employmentStatusForTenureStatus("active"), "active");
    assert.equal(employmentStatusForTenureStatus("inactive"), "inactive");
  });
});
