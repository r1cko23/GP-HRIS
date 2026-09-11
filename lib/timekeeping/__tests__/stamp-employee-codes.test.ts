import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
});
