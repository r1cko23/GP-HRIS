import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canDecideTimeApproval,
  canOpenTimeApprovalQueue,
  isHRFamilyRole,
} from "../roles";

describe("time approval queue access", () => {
  it("lets Head of accounting open OT and leave for her approver group", () => {
    assert.equal(canOpenTimeApprovalQueue("head_of_accounting"), true);
    assert.equal(canDecideTimeApproval("head_of_accounting"), true);
    assert.equal(isHRFamilyRole("head_of_accounting"), false);
  });

  it("keeps approver, viewer, admin, and HR on the queue", () => {
    for (const role of ["approver", "viewer", "admin", "head_of_hr", "hr_admin", "hr_compben"]) {
      assert.equal(canOpenTimeApprovalQueue(role), true, role);
    }
    assert.equal(canDecideTimeApproval("approver"), true);
    assert.equal(canDecideTimeApproval("viewer"), false);
    assert.equal(canDecideTimeApproval("admin"), true);
    assert.equal(canDecideTimeApproval("head_of_hr"), true);
  });

  it("keeps everyone else out, including an empty role", () => {
    for (const role of ["employee", "account_manager", "ot_approver", "", null, undefined]) {
      assert.equal(canOpenTimeApprovalQueue(role), false, String(role));
      assert.equal(canDecideTimeApproval(role), false, String(role));
    }
  });
});
