import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planImportedEmployeeIdentity } from "../employee-code";

describe("planImportedEmployeeIdentity", () => {
  it("does not keep a MAIN Employee_id as the live Directory code", () => {
    const plan = planImportedEmployeeIdentity({
      empCode: "29554",
      legacyId: 29554,
    });
    assert.equal(plan.liveCode, null);
    assert.deepEqual(plan.aliasCodes, ["29554"]);
  });

  it("allocates when MAIN EMP_code is blank and only Employee_id exists", () => {
    const plan = planImportedEmployeeIdentity({
      empCode: null,
      legacyId: 29559,
    });
    assert.equal(plan.liveCode, null);
    assert.deepEqual(plan.aliasCodes, ["29559"]);
  });

  it("keeps an already issued YYYYMM-##### live code and aliases the MAIN id", () => {
    const plan = planImportedEmployeeIdentity({
      empCode: "202603-00235",
      legacyId: 28170,
    });
    assert.equal(plan.liveCode, "202603-00235");
    assert.deepEqual(plan.aliasCodes, ["28170"]);
  });
});
