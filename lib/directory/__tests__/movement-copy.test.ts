import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STILL_WORKING_REMARKS,
  formatMovementRemarks,
  priorEngagementRemarks,
} from "../movement-copy";

describe("priorEngagementRemarks", () => {
  it("names the employee code and legacy id when both exist", () => {
    assert.equal(
      priorEngagementRemarks({
        employeeCode: "202609-00004",
        legacyId: 29680,
      }),
      "Linked earlier employee file 202609-00004 (legacy #29680)."
    );
  });

  it("works with code only", () => {
    assert.equal(
      priorEngagementRemarks({ employeeCode: "202609-00004" }),
      "Linked earlier employee file 202609-00004."
    );
  });

  it("works with neither", () => {
    assert.equal(
      priorEngagementRemarks({}),
      "Linked an earlier employee file."
    );
  });
});

describe("formatMovementRemarks", () => {
  it("rewrites still-working system boilerplate", () => {
    assert.equal(
      formatMovementRemarks(
        "HR confirmed still working — keep active; re-check after next released payroll."
      ),
      STILL_WORKING_REMARKS
    );
  });

  it("rewrites parked Extra 201 notes without dumping UUIDs", () => {
    assert.equal(
      formatMovementRemarks(
        "Extra 201 parked under person master. · code=202609-00004 · legacy_id=29680 · source_row=5dd13461-c3db-42e4-9af4-3ba0f5fde9fb"
      ),
      "Linked earlier employee file 202609-00004 (legacy #29680)."
    );
  });

  it("rewrites GREENHRISMAIN collapse notes", () => {
    assert.equal(
      formatMovementRemarks(
        "GREENHRISMAIN rehire episode collapsed to person master. · code=ABC · legacy_id=1 · source_row=uuid · status=inactive"
      ),
      "Linked earlier employee file ABC (legacy #1)."
    );
  });

  it("passes through ordinary HR notes", () => {
    assert.equal(
      formatMovementRemarks("On maternity leave until November."),
      "On maternity leave until November."
    );
  });

  it("returns null for empty remarks", () => {
    assert.equal(formatMovementRemarks(null), null);
    assert.equal(formatMovementRemarks("   "), null);
  });
});
