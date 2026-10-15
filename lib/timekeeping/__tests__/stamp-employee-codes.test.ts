import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  payeeFieldsFromHoursSnapshot,
  preserveExistingPayeeFreeze,
  stampEmployeeCodesOntoHours,
  type DirectoryEmployeeCodeMap,
} from "../stamp-employee-codes";
import type { CutoffHoursIngestRow } from "../cutoff-types";

describe("stampEmployeeCodesOntoHours", () => {
  it("fills missing employee_code from Directory for Claire-style GP-Client rows", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "28fdb6f2-593d-4ade-8690-251fcc5f5a9c",
        last_name: "Aban",
        first_name: "Claire",
        actual_regular_hours: 96,
        hours_work: 96,
        source_of_data: "GP-CLIENT",
      },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "28fdb6f2-593d-4ade-8690-251fcc5f5a9c",
        {
          employee_code: "202309-00023",
          last_name: "Aban",
          first_name: "Claire",
        },
      ],
    ]);

    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.employee_code, "202309-00023");
    assert.equal(stamped[0]?.last_name, "Aban");
    assert.equal(stamped[0]?.first_name, "Claire");
  });

  it("does not overwrite a code the sibling already sent", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "emp-1",
        employee_code: "ALREADY-1",
        last_name: "X",
        first_name: "Y",
      },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-1",
        {
          employee_code: "DIRECTORY-9",
          last_name: "Dir",
          first_name: "Name",
        },
      ],
    ]);

    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.employee_code, "ALREADY-1");
  });

  it("leaves the row alone when Directory has no code for that person", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "missing",
        last_name: "Nobody",
        first_name: "Here",
      },
    ];
    const stamped = stampEmployeeCodesOntoHours(hours, new Map());
    assert.equal(stamped[0]?.employee_code, undefined);
  });

  it("fills blank names from Directory when ingest only sent the UUID", () => {
    const hours: CutoffHoursIngestRow[] = [
      { directory_employee_id: "emp-2" },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-2",
        {
          employee_code: "202401-00001",
          last_name: "Reyes",
          first_name: "Ana",
        },
      ],
    ]);
    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.employee_code, "202401-00001");
    assert.equal(stamped[0]?.last_name, "Reyes");
    assert.equal(stamped[0]?.first_name, "Ana");
  });

  it("handles zero hours rows", () => {
    assert.deepEqual(stampEmployeeCodesOntoHours([], new Map()), []);
  });

  it("fills missing daily_rate_payroll from Directory for GP-Client ingest", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "emp-rate",
        last_name: "Testwh",
        first_name: "Room",
        actual_regular_hours: 80,
        source_of_data: "GP-CLIENT",
      },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-rate",
        {
          employee_code: "202609-98001",
          last_name: "Testwh",
          first_name: "Room",
          daily_rate: 695,
        },
      ],
    ]);
    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.daily_rate_payroll, 695);
  });

  it("does not overwrite a daily rate the sibling already sent", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "emp-rate",
        daily_rate_payroll: 800,
      },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-rate",
        {
          employee_code: "202609-98001",
          last_name: "Testwh",
          first_name: "Room",
          daily_rate: 695,
        },
      ],
    ]);
    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.daily_rate_payroll, 800);
  });

  it("stamps rate_snapshot from Directory when hours have none", () => {
    const hours: CutoffHoursIngestRow[] = [
      { directory_employee_id: "emp-pay" },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-pay",
        {
          employee_code: "202501-00001",
          last_name: "Galvez",
          first_name: "Jerico",
          daily_rate: 645,
          pay_through: "GCash",
          gcash: "09657438855",
          bank_name: "BDO",
          bank_account_no: "123456",
        },
      ],
    ]);
    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.daily_rate_payroll, 645);
    const snap = stamped[0]?.rate_snapshot as Record<string, unknown>;
    assert.equal(snap?.daily_rate, 645);
    assert.equal(snap?.pay_through, "GCash");
    assert.equal(snap?.gcash, "09657438855");
    assert.equal(snap?.bank_name, "BDO");
    assert.equal(snap?.bank_account_no, "123456");
    assert.ok(typeof snap?.stamped_at === "string" && snap.stamped_at.length > 0);
  });

  it("does not overwrite an existing rate_snapshot when Directory rate/pay_through change", () => {
    const hours: CutoffHoursIngestRow[] = [
      {
        directory_employee_id: "emp-pay",
        daily_rate_payroll: 645,
        rate_snapshot: {
          daily_rate: 645,
          pay_through: "Atm",
          gcash: null,
          bank_name: "BDO",
          bank_account_no: "999",
          stamped_at: "2026-09-01T00:00:00.000Z",
        },
      },
    ];
    const directory: DirectoryEmployeeCodeMap = new Map([
      [
        "emp-pay",
        {
          employee_code: "202501-00001",
          last_name: "Galvez",
          first_name: "Jerico",
          daily_rate: 700,
          pay_through: "GCash",
          gcash: "09657438855",
          bank_name: "BPI",
          bank_account_no: "111",
        },
      ],
    ]);
    const stamped = stampEmployeeCodesOntoHours(hours, directory);
    assert.equal(stamped[0]?.daily_rate_payroll, 645);
    assert.deepEqual(stamped[0]?.rate_snapshot, {
      daily_rate: 645,
      pay_through: "Atm",
      gcash: null,
      bank_name: "BDO",
      bank_account_no: "999",
      stamped_at: "2026-09-01T00:00:00.000Z",
    });
  });
});

describe("preserveExistingPayeeFreeze", () => {
  it("keeps DB freeze when re-ingest sends blank rate/snapshot", () => {
    const incoming: CutoffHoursIngestRow[] = [
      { directory_employee_id: "emp-1", actual_regular_hours: 80 },
    ];
    const existing = new Map([
      [
        "emp-1",
        {
          daily_rate_payroll: 645,
          rate_snapshot: {
            daily_rate: 645,
            pay_through: "Atm",
            stamped_at: "2026-09-01T00:00:00.000Z",
          },
        },
      ],
    ]);
    const merged = preserveExistingPayeeFreeze(incoming, existing);
    assert.equal(merged[0]?.daily_rate_payroll, 645);
    assert.equal(
      (merged[0]?.rate_snapshot as { pay_through?: string })?.pay_through,
      "Atm"
    );
  });
});

describe("payeeFieldsFromHoursSnapshot", () => {
  it("prefers snapshot over Directory fallback", () => {
    const fields = payeeFieldsFromHoursSnapshot(
      {
        daily_rate: 645,
        pay_through: "Atm",
        gcash: null,
        bank_name: "BDO",
        bank_account_no: "123",
        stamped_at: "2026-09-01T00:00:00.000Z",
      },
      {
        employee_code: "x",
        last_name: "A",
        first_name: "B",
        daily_rate: 700,
        pay_through: "GCash",
        gcash: "0917",
        bank_name: "BPI",
        bank_account_no: "999",
      }
    );
    assert.equal(fields.daily_rate, 645);
    assert.equal(fields.pay_through, "Atm");
    assert.equal(fields.gcash, null);
    assert.equal(fields.bank_account_no, "123");
  });
});
