import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveLoanDisplayPerson } from "../display-person";

const claire = {
  id: "dir-aban",
  client_id: "nabati",
  employee_code: "202309-00023",
  last_name: "Aban",
  first_name: "Claire",
};

describe("resolveLoanDisplayPerson", () => {
  it("uses the Directory 201 when the loan has no Bundy row", () => {
    const person = resolveLoanDisplayPerson({
      directoryEmployeeId: claire.id,
      officeEmployeeId: null,
      directory: claire,
      office: null,
    });
    assert.equal(person.full_name, "Aban, Claire");
    assert.equal(person.employee_code, "202309-00023");
    assert.equal(person.client_id, "nabati");
    assert.equal(person.directory_employee_id, "dir-aban");
    assert.equal(person.office_employee_id, null);
  });

  it("keeps Directory name when an Organic Bundy row also exists", () => {
    const person = resolveLoanDisplayPerson({
      directoryEmployeeId: claire.id,
      officeEmployeeId: "office-1",
      directory: claire,
      office: {
        id: "office-1",
        employee_id: "GP-99",
        full_name: "Office Nickname",
      },
    });
    assert.equal(person.full_name, "Aban, Claire");
    assert.equal(person.employee_code, "202309-00023");
    assert.equal(person.office_employee_id, "office-1");
  });

  it("falls back to the Bundy row when Directory is missing", () => {
    const person = resolveLoanDisplayPerson({
      directoryEmployeeId: null,
      officeEmployeeId: "office-1",
      directory: null,
      office: {
        id: "office-1",
        employee_id: "GP-99",
        full_name: "Santos, Ana",
        last_name: "Santos",
        first_name: "Ana",
      },
    });
    assert.equal(person.full_name, "Santos, Ana");
    assert.equal(person.employee_code, "GP-99");
    assert.equal(person.directory_employee_id, null);
  });

  it("returns a blank person when neither side is linked", () => {
    const person = resolveLoanDisplayPerson({
      directoryEmployeeId: null,
      officeEmployeeId: null,
      directory: null,
      office: null,
    });
    assert.equal(person.full_name, "");
    assert.equal(person.employee_code, null);
  });
});
