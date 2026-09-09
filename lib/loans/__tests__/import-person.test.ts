import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planLoanImportPerson } from "../import-person";

describe("planLoanImportPerson", () => {
  it("imports a Deployed loan onto the Directory person when there is no Bundy enrollment", () => {
    const plan = planLoanImportPerson({
      directoryEmployeeId: "dayto",
      officeEmployeeId: null,
    });
    assert.deepEqual(plan, {
      action: "import",
      directory_employee_id: "dayto",
      employee_id: null,
    });
  });

  it("keeps the Bundy employee id when Organic already has one", () => {
    const plan = planLoanImportPerson({
      directoryEmployeeId: "organic-person",
      officeEmployeeId: "office-row",
    });
    assert.deepEqual(plan, {
      action: "import",
      directory_employee_id: "organic-person",
      employee_id: "office-row",
    });
  });

  it("skips when GREENHRISMAIN Employee_id has no Directory person", () => {
    const plan = planLoanImportPerson({
      directoryEmployeeId: null,
      officeEmployeeId: null,
    });
    assert.deepEqual(plan, { action: "skip", reason: "no_directory_person" });
  });
});
