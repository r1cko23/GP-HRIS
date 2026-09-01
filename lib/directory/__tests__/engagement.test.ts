import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orgAccessPolicy } from "../org-access";
import {
  planLifecycle,
  planRehire,
  planTransfer,
  type EngagementRow,
} from "../engagement-transitions";

const base: EngagementRow = {
  id: "e1",
  status: "active",
  client_id: "c1",
  branch_id: null,
  position_id: null,
  hire_date: "2024-01-15",
  first_hire_date: "2024-01-15",
  resign_date: null,
  employee_code: "202401-00001",
  is_current_engagement: true,
  superseded_by: null,
};

describe("orgAccessPolicy", () => {
  it("allows service key and admin without membership", () => {
    assert.equal(
      orgAccessPolicy(
        { userId: null, role: null, viaServiceKey: true },
        false
      ).ok,
      true
    );
    assert.equal(
      orgAccessPolicy(
        { userId: "u1", role: "admin", viaServiceKey: false },
        false
      ).ok,
      true
    );
  });

  it("requires membership for HR family", () => {
    assert.equal(
      orgAccessPolicy(
        { userId: "u1", role: "head_of_hr", viaServiceKey: false },
        false
      ).ok,
      false
    );
    assert.equal(
      orgAccessPolicy(
        { userId: "u1", role: "head_of_hr", viaServiceKey: false },
        true
      ).ok,
      true
    );
  });
});

describe("planLifecycle", () => {
  it("starts final pay → for_release", () => {
    const r = planLifecycle({
      current: base,
      action: "start_final_pay",
      today: "2026-08-01",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.plan.patch.status, "for_release");
  });

  it("blocks activate from inactive (must rehire)", () => {
    const r = planLifecycle({
      current: { ...base, status: "inactive" },
      action: "activate",
    });
    assert.equal(r.ok, false);
  });

  it("activates from float", () => {
    const r = planLifecycle({
      current: { ...base, status: "float" },
      action: "activate",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.plan.patch.status, "active");
  });
});

describe("planRehire", () => {
  it("requires inactive unless admin force", () => {
    assert.equal(
      planRehire({
        current: base,
        hire_date: "2026-09-01",
        client_id: "c1",
        force: false,
      }).ok,
      false
    );
    assert.equal(
      planRehire({
        current: base,
        hire_date: "2026-09-01",
        client_id: "c1",
        force: true,
        actorIsAdmin: true,
      }).ok,
      true
    );
    assert.equal(
      planRehire({
        current: base,
        hire_date: "2026-09-01",
        client_id: "c1",
        force: true,
        actorIsAdmin: false,
      }).ok,
      false
    );
  });

  it("preserves first_hire_date on inactive rehire", () => {
    const r = planRehire({
      current: {
        ...base,
        status: "inactive",
        first_hire_date: "2020-03-01",
        hire_date: "2020-03-01",
      },
      hire_date: "2026-09-01",
      client_id: "c2",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.plan.patch.first_hire_date, "2020-03-01");
    assert.equal(r.plan.patch.hire_date, "2026-09-01");
    assert.equal(r.plan.patch.status, "active");
  });
});

describe("planTransfer", () => {
  it("rejects same client and inactive", () => {
    assert.equal(planTransfer({ current: base, client_id: "c1" }).ok, false);
    assert.equal(
      planTransfer({
        current: { ...base, status: "inactive" },
        client_id: "c2",
      }).ok,
      false
    );
  });

  it("activates float on transfer", () => {
    const r = planTransfer({
      current: { ...base, status: "float" },
      client_id: "c2",
      to_client_name: "Hotel B",
      from_client_name: "Hotel A",
    });
    assert.equal(r.ok, true);
    if (!r.ok) return;
    assert.equal(r.plan.patch.status, "active");
    assert.equal(r.plan.movement.status, "TRANSFERRED");
  });
});
