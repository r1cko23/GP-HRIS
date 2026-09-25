import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_STATUSES,
  directoryStatusMeta,
  isPayrollEligibleStatus,
  resolveHireStatus,
  sentenceCaseStatusLabel,
  shouldAutoEnrollForStatus,
} from "../employees";

describe("directoryStatusMeta labels", () => {
  it("uses sentence case for every employee status (not snake_case)", () => {
    const expected: Record<(typeof EMPLOYEE_STATUSES)[number], string> = {
      active: "Active",
      inactive: "Inactive",
      barred: "Barred",
      float: "Float",
      for_release: "For release",
      for_verification: "For verification",
    };

    for (const status of EMPLOYEE_STATUSES) {
      const { label } = directoryStatusMeta(status);
      assert.equal(
        label,
        expected[status],
        `${status} must show sentence-case UI copy, not the raw enum`
      );
      assert.ok(!label.includes("_"), `${status} label still has underscores`);
    }
  });

  it("sentence-cases unknown snake_case statuses for display", () => {
    assert.equal(directoryStatusMeta("needs_review").label, "Needs review");
    assert.equal(sentenceCaseStatusLabel("for_release"), "For release");
  });
});

describe("People hire status + bundy gate", () => {
  it("defaults Add employee hire to for_verification", () => {
    assert.equal(resolveHireStatus(), "for_verification");
    assert.equal(resolveHireStatus(null), "for_verification");
    assert.equal(resolveHireStatus(undefined), "for_verification");
  });

  it("honors an explicit valid status override (scripts / rehire paths)", () => {
    assert.equal(resolveHireStatus("active"), "active");
    assert.equal(resolveHireStatus("float"), "float");
  });

  it("excludes for_verification from payroll", () => {
    assert.equal(isPayrollEligibleStatus("for_verification"), false);
    assert.equal(isPayrollEligibleStatus("active"), true);
  });

  it("auto-enrolls bundy only when Active — not on for_verification hire", () => {
    assert.equal(shouldAutoEnrollForStatus("for_verification"), false);
    assert.equal(shouldAutoEnrollForStatus("active"), true);
    assert.equal(shouldAutoEnrollForStatus("for_release"), false);
  });
});
