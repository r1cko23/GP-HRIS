import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_STATUSES,
  directoryStatusMeta,
  sentenceCaseStatusLabel,
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
