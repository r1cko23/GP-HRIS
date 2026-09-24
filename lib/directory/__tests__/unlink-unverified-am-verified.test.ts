import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planUnlinkUnverifiedAmVerified } from "../unlink-unverified-am-verified";

describe("planUnlinkUnverifiedAmVerified", () => {
  const delima = {
    id: "dir-delima",
    legacy_id: 29743,
    status: "active",
    last_name: "DELIMA",
    first_name: "ALBERT",
  };
  const pendingSet = new Set([29743]);

  it("unlinks AM Verified when MAIN verificationstatus is Pending (Delima)", () => {
    const plan = planUnlinkUnverifiedAmVerified({
      pendingLegacyIds: pendingSet,
      directoryById: new Map([[delima.id, delima]]),
      verified: [
        {
          id: "v1",
          directory_employee_id: delima.id,
          employee_name: "Delima, Albert Lorica",
          employment_status: "active",
          is_current: true,
        },
      ],
      draft: [],
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.table, "csm_employees_verified");
    assert.equal(plan[0]?.reason, "main_pending_verification");
    assert.equal(plan[0]?.legacyId, 29743);
  });

  it("unlinks Draft rows on the same Pending 201", () => {
    const plan = planUnlinkUnverifiedAmVerified({
      pendingLegacyIds: pendingSet,
      directoryById: new Map([[delima.id, delima]]),
      verified: [],
      draft: [
        {
          id: "d1",
          directory_employee_id: delima.id,
          employee_name: "Delima, Albert Lorica",
          employment_status: "active",
        },
      ],
    });
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.table, "csm_employees_draft");
  });

  it("unlinks AM Verified on for_verification Directory", () => {
    const person = { ...delima, legacy_id: 1, status: "for_verification" };
    const plan = planUnlinkUnverifiedAmVerified({
      pendingLegacyIds: new Set(),
      directoryById: new Map([[person.id, person]]),
      verified: [
        {
          id: "v2",
          directory_employee_id: person.id,
          employment_status: "active",
          is_current: true,
        },
      ],
      draft: [],
    });
    assert.equal(plan[0]?.reason, "directory_for_verification");
  });

  it("keeps AM Verified on inactive / for_release Directory (not Pending)", () => {
    const inactive = { ...delima, id: "dir-in", legacy_id: 2, status: "inactive" };
    const forRelease = {
      ...delima,
      id: "dir-fr",
      legacy_id: 3,
      status: "for_release",
    };
    const plan = planUnlinkUnverifiedAmVerified({
      pendingLegacyIds: new Set(),
      directoryById: new Map([
        [inactive.id, inactive],
        [forRelease.id, forRelease],
      ]),
      verified: [
        {
          id: "v3",
          directory_employee_id: inactive.id,
          employment_status: "active",
          is_current: true,
        },
        {
          id: "v4",
          directory_employee_id: forRelease.id,
          employment_status: "active",
          is_current: true,
        },
      ],
      draft: [],
    });
    assert.equal(plan.length, 0);
  });

  it("skips non-current Verified rows and unlinked rows", () => {
    const plan = planUnlinkUnverifiedAmVerified({
      pendingLegacyIds: pendingSet,
      directoryById: new Map([[delima.id, delima]]),
      verified: [
        {
          id: "old",
          directory_employee_id: delima.id,
          is_current: false,
          employment_status: "active",
        },
        {
          id: "bare",
          directory_employee_id: null,
          is_current: true,
          employment_status: "active",
        },
      ],
      draft: [],
    });
    assert.equal(plan.length, 0);
  });
});
