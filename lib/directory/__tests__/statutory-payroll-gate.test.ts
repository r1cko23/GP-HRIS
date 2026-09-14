import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listStatutoryPayrollBlocks } from "../statutory-payroll-gate";

describe("listStatutoryPayrollBlocks", () => {
  it("returns nobody when the list is empty", () => {
    assert.deepEqual(listStatutoryPayrollBlocks([]), []);
  });

  it("returns nobody when one person has all four numbers", () => {
    const blocked = listStatutoryPayrollBlocks([
      {
        id: "e1",
        last_name: "Santos",
        first_name: "Ana",
        tin: "123",
        sss_number: "34",
        philhealth_number: "12",
        pagibig_number: "12",
      },
    ]);
    assert.equal(blocked.length, 0);
  });

  it("blocks one person missing SSS", () => {
    const blocked = listStatutoryPayrollBlocks([
      {
        id: "e1",
        last_name: "Santos",
        first_name: "Ana",
        tin: "123",
        sss_number: null,
        philhealth_number: "12",
        pagibig_number: "12",
      },
    ]);
    assert.equal(blocked.length, 1);
    assert.deepEqual(blocked[0]?.missing, ["SSS"]);
    assert.equal(blocked[0]?.directory_employee_id, "e1");
  });

  it("blocks many people and lists every missing label", () => {
    const blocked = listStatutoryPayrollBlocks([
      {
        id: "ok",
        tin: "1",
        sss_number: "2",
        philhealth_number: "3",
        pagibig_number: "4",
      },
      {
        id: "gap-a",
        last_name: "Cruz",
        first_name: "Ben",
        tin: "",
        sss_number: "2",
        philhealth_number: "3",
        pagibig_number: "4",
      },
      {
        id: "gap-b",
        last_name: "Reyes",
        first_name: "Cora",
      },
    ]);
    assert.equal(blocked.length, 2);
    assert.deepEqual(blocked[0]?.missing, ["TIN"]);
    assert.deepEqual(blocked[1]?.missing, [
      "SSS",
      "TIN",
      "PhilHealth",
      "Pag-IBIG",
    ]);
  });
});
