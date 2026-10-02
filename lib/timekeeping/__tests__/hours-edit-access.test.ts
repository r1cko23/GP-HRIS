import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ORGANIC_CUTOFF_SOURCE_APP, GP_CLIENT_CUTOFF_SOURCE_APP } from "../cutoff-types";
import {
  canActorEditCutoffHours,
  cutoffHoursEditDenial,
  cutoffHoursWindowOpen,
} from "../hours-edit-fields";

describe("canActorEditCutoffHours", () => {
  it("lets admin correct hours while draft or pending audit", () => {
    assert.equal(
      canActorEditCutoffHours({ periodStatus: "draft", role: "admin" }),
      true
    );
    assert.equal(
      canActorEditCutoffHours({
        periodStatus: "pending_audit",
        role: "admin",
      }),
      true
    );
  });

  it("blocks HR family from typing hours in the audit window", () => {
    for (const role of ["head_of_hr", "hr_admin", "hr_compben"] as const) {
      assert.equal(
        canActorEditCutoffHours({ periodStatus: "draft", role }),
        false,
        role
      );
      assert.equal(
        canActorEditCutoffHours({ periodStatus: "pending_audit", role }),
        false,
        role
      );
    }
  });

  it("blocks approver, viewer, and missing role", () => {
    assert.equal(
      canActorEditCutoffHours({ periodStatus: "draft", role: "approver" }),
      false
    );
    assert.equal(
      canActorEditCutoffHours({ periodStatus: "draft", role: "viewer" }),
      false
    );
    assert.equal(
      canActorEditCutoffHours({ periodStatus: "draft", role: null }),
      false
    );
  });

  it("locks hours after approve, post, or cancel even for admin", () => {
    for (const periodStatus of ["approved", "posted", "cancelled"] as const) {
      assert.equal(
        canActorEditCutoffHours({ periodStatus, role: "admin" }),
        false,
        periodStatus
      );
    }
  });

  it("does not treat a service key as an admin hour editor", () => {
    assert.equal(
      canActorEditCutoffHours({
        periodStatus: "draft",
        role: null,
        viaServiceKey: true,
      }),
      false
    );
  });

  it("keeps organic payroll hours read-only, including regular hours, for every role", () => {
    for (const role of ["admin", "head_of_hr", "hr_admin", "approver"] as const) {
      for (const periodStatus of ["draft", "pending_audit"] as const) {
        assert.equal(
          canActorEditCutoffHours({
            periodStatus,
            role,
            sourceApp: ORGANIC_CUTOFF_SOURCE_APP,
          }),
          false,
          `${role} ${periodStatus}`
        );
      }
    }
  });

  it("keeps a cutoff with no source app read-only, matching the organic office path", () => {
    assert.equal(
      canActorEditCutoffHours({
        periodStatus: "draft",
        role: "admin",
        sourceApp: null,
      }),
      false
    );
  });

  it("still lets an admin correct hours on a deployed cutoff", () => {
    assert.equal(
      canActorEditCutoffHours({
        periodStatus: "draft",
        role: "admin",
        sourceApp: GP_CLIENT_CUTOFF_SOURCE_APP,
      }),
      true
    );
  });

  it("keeps the hours window open for HR so they can still aggregate and submit", () => {
    assert.equal(cutoffHoursWindowOpen("draft"), true);
    assert.equal(cutoffHoursWindowOpen("pending_audit"), true);
    assert.equal(
      canActorEditCutoffHours({ periodStatus: "draft", role: "hr_admin" }),
      false
    );
  });
});

describe("cutoffHoursEditDenial", () => {
  it("returns 403 when HR tries to insert hours during audit", () => {
    const denial = cutoffHoursEditDenial({
      periodStatus: "pending_audit",
      role: "hr_admin",
    });
    assert.equal(denial.ok, false);
    if (denial.ok) return;
    assert.equal(denial.status, 403);
    assert.match(denial.message, /admin/i);
  });

  it("returns 409 when anyone tries to edit organic payroll hours", () => {
    const denial = cutoffHoursEditDenial({
      periodStatus: "draft",
      role: "admin",
      sourceApp: ORGANIC_CUTOFF_SOURCE_APP,
    });
    assert.equal(denial.ok, false);
    if (denial.ok) return;
    assert.equal(denial.status, 409);
    assert.match(denial.message, /cannot be edited/i);
  });

  it("returns 409 when the cutoff is no longer in the hours window", () => {
    const denial = cutoffHoursEditDenial({
      periodStatus: "approved",
      role: "admin",
    });
    assert.equal(denial.ok, false);
    if (denial.ok) return;
    assert.equal(denial.status, 409);
  });
});
