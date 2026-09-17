import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import {
  buildGcashUploadWorkbook,
  gcashUploadFilename,
  gcashUploadRows,
} from "../gcash-upload";
import type { DisbursementPerson } from "../disbursement-debit-memo";

const people: DisbursementPerson[] = [
  {
    last_name: "KILAT",
    first_name: "JOSIE",
    gcash: "09565974834",
    pay_through: "GCash",
    net_pay: 10175,
    department: "CONVERGE",
    client_name: "CONVERGE",
  },
  {
    last_name: "LORICA",
    first_name: "JENNIFER",
    gcash: "09619266005",
    pay_through: "GCash",
    net_pay: 18192.11,
    department: "BAESA",
    client_name: "NABATI",
  },
  {
    last_name: "ABAN",
    first_name: "Claire",
    pay_through: "ATM",
    net_pay: 5000,
    bank_account_no: "111",
  },
];

describe("gcash upload workbook", () => {
  it("includes only GCash people with mobile + amount", () => {
    const rows = gcashUploadRows(people);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].mobile, "09565974834");
    assert.equal(rows[0].amount, 10175);
    assert.equal(rows[0].name, "JOSIE KILAT");
    assert.equal(rows[0].client, "CONVERGE");
    assert.equal(rows[0].department, "CONVERGE");
  });

  it("writes GCASH BATCH and GCASH INDIVIDUAL sheets", () => {
    const buf = buildGcashUploadWorkbook({
      pay_out_date: "SEPTEMBER 05, 2026",
      people,
    });
    const wb = XLSX.read(buf);
    assert.deepEqual(wb.SheetNames, ["GCASH BATCH", "GCASH INDIVIDUAL"]);
    const batch = XLSX.utils.sheet_to_json(wb.Sheets["GCASH BATCH"], {
      header: 1,
    }) as unknown[][];
    assert.ok(batch.some((row) => row.includes("JOSIE KILAT")));
    assert.ok(batch.some((row) => row.includes("TOTAL")));
    assert.equal(
      gcashUploadFilename("2026-09-05"),
      "GCASH-FOR-UPLOADING-2026-09-05.xlsx"
    );
  });
});
