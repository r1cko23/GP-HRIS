import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planDiscardUnverifiedHire } from "../engagement-transitions";
import { canDiscardUnverifiedHire } from "../../access/directory-employee-writes";

describe("planDiscardUnverifiedHire", () => {
  it("allows discard of a for_verification hire with no payroll history", () => {
    const r = planDiscardUnverifiedHire({
      status: "for_verification",
      last_payroll_end: null,
    });
    assert.deepEqual(r, { ok: true });
  });

  it("rejects discard once the person is active", () => {
    const r = planDiscardUnverifiedHire({
      status: "active",
      last_payroll_end: null,
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /for verification/i);
    assert.equal(r.status, 409);
  });

  it("rejects discard of float, inactive, for_release, and barred", () => {
    for (const status of ["float", "inactive", "for_release", "barred"] as const) {
      const r = planDiscardUnverifiedHire({
        status,
        last_payroll_end: null,
      });
      assert.equal(r.ok, false, status);
      if (r.ok) return;
      assert.equal(r.status, 409);
    }
  });

  it("rejects discard when any payroll end is on file", () => {
    const r = planDiscardUnverifiedHire({
      status: "for_verification",
      last_payroll_end: "2026-09-15",
    });
    assert.equal(r.ok, false);
    if (r.ok) return;
    assert.match(r.error, /payroll/i);
    assert.equal(r.status, 409);
  });
});

describe("canDiscardUnverifiedHire", () => {
  const encoder = [
    "page:people.employees",
    "fn:employees.create",
    "fn:employees.section.core",
  ] as const;

  it("lets create-only encoders discard for_verification drafts they started", () => {
    assert.equal(
      canDiscardUnverifiedHire({
        capabilityKeys: encoder,
        employeeStatus: "for_verification",
      }),
      true
    );
  });

  it("denies create-only encoders from discarding active people", () => {
    assert.equal(
      canDiscardUnverifiedHire({
        capabilityKeys: encoder,
        employeeStatus: "active",
      }),
      false
    );
  });

  it("denies view-only actors", () => {
    assert.equal(
      canDiscardUnverifiedHire({
        capabilityKeys: [
          "page:people.employees",
          "fn:employees.section.core",
        ],
        employeeStatus: "for_verification",
      }),
      false
    );
  });
});
