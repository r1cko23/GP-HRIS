import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRoleLabel } from "../format-role-label";

describe("formatRoleLabel", () => {
  it("uses sentence case for dashboard roles", () => {
    assert.equal(formatRoleLabel("admin"), "Admin");
    assert.equal(formatRoleLabel("head_of_accounting"), "Head of accounting");
    assert.equal(formatRoleLabel("head_of_hr"), "Head of HR");
    assert.equal(formatRoleLabel("hr_admin"), "HR admin");
    assert.equal(formatRoleLabel("hr_compben"), "HR comp & benefits");
    assert.equal(formatRoleLabel("account_manager"), "Account manager");
    assert.equal(formatRoleLabel("ot_approver"), "OT approver");
    assert.equal(formatRoleLabel("ot_viewer"), "OT viewer");
    assert.equal(formatRoleLabel("approver"), "Approver");
    assert.equal(formatRoleLabel("viewer"), "Viewer");
  });

  it("sentence-cases an unknown role instead of leaving it lowercase", () => {
    assert.equal(formatRoleLabel("payroll_lead"), "Payroll lead");
    assert.equal(formatRoleLabel(""), "—");
    assert.equal(formatRoleLabel(null), "—");
  });
});
