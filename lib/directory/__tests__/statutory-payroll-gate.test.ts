import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attachCutoffsWithoutIds,
  formatStatutoryIdReminderMemo,
  listStatutoryPayrollBlocks,
} from "../statutory-payroll-gate";

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

  it("warns one person missing SSS (does not imply register exclusion)", () => {
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
    assert.equal(blocked[0]?.cutoffs_without_ids, 0);
  });

  it("warns many people and lists every missing label", () => {
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

describe("attachCutoffsWithoutIds", () => {
  it("stamps how many cutoffs each warning person has appeared on", () => {
    const warnings = listStatutoryPayrollBlocks([
      {
        id: "e1",
        last_name: "Santos",
        first_name: "Ana",
        tin: null,
        sss_number: "1",
        philhealth_number: "1",
        pagibig_number: "1",
      },
    ]);
    const stamped = attachCutoffsWithoutIds(warnings, new Map([["e1", 4]]));
    assert.equal(stamped[0]?.cutoffs_without_ids, 4);
  });

  it("defaults unknown people to 0", () => {
    const warnings = listStatutoryPayrollBlocks([
      {
        id: "e2",
        tin: null,
        sss_number: "1",
        philhealth_number: "1",
        pagibig_number: "1",
      },
    ]);
    const stamped = attachCutoffsWithoutIds(warnings, new Map());
    assert.equal(stamped[0]?.cutoffs_without_ids, 0);
  });
});

describe("formatStatutoryIdReminderMemo", () => {
  it("returns empty when nobody is missing IDs", () => {
    assert.equal(formatStatutoryIdReminderMemo([]), "");
  });

  it("writes a reminder memo with missing IDs and cutoff count", () => {
    const memo = formatStatutoryIdReminderMemo([
      {
        directory_employee_id: "e1",
        employee_code: "202401-00001",
        last_name: "Santos",
        first_name: "Ana",
        client_id: "c1",
        missing: ["TIN", "SSS"],
        cutoffs_without_ids: 3,
      },
    ]);
    assert.match(memo, /MEMO · Missing statutory IDs/i);
    assert.match(memo, /Santos, Ana/);
    assert.match(memo, /TIN, SSS/);
    assert.match(memo, /3 cutoffs/);
    assert.match(memo, /remind to get the ID/i);
  });
});
