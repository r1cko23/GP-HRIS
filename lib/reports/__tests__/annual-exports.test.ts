import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import {
  buildSilAccrualSheet,
  silAccrualFilename,
  silAccrualWorkbookBuffer,
} from "../sil-accrual-export";
import {
  rollThirteenthMonthYtd,
  thirteenthMonthAccrual,
} from "../thirteenth-month";
import { rollAlphalistRows } from "../alphalist";

describe("thirteenthMonthAccrual", () => {
  it("is basic/12 rounded", () => {
    assert.equal(thirteenthMonthAccrual(12000), 1000);
    assert.equal(thirteenthMonthAccrual(0), 0);
    assert.equal(thirteenthMonthAccrual(100), 8.33);
  });
});

describe("rollThirteenthMonthYtd", () => {
  it("sums zero / one / many cutoffs per person", () => {
    assert.deepEqual(rollThirteenthMonthYtd([]), []);
    const one = rollThirteenthMonthYtd([
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        basic_pay: 12000,
      },
    ]);
    assert.equal(one.length, 1);
    assert.equal(one[0].ytd_accrual, 1000);
    assert.equal(one[0].cutoff_count, 1);

    const many = rollThirteenthMonthYtd([
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        basic_pay: 12000,
      },
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        basic_pay: 12000,
      },
      {
        directory_employee_id: "e2",
        employee_code: "B1",
        last_name: "Cruz",
        first_name: "Ben",
        basic_pay: 6000,
      },
    ]);
    assert.equal(many.length, 2);
    assert.equal(many[0].ytd_accrual, 2000);
    assert.equal(many[0].cutoff_count, 2);
    assert.equal(many[1].ytd_accrual, 500);
  });
});

describe("SIL accrual export", () => {
  it("writes allotted / used / credits rows", () => {
    const sheet = buildSilAccrualSheet([
      {
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        hire_date: "2023-09-01",
        sil_allotted: 10,
        sil_days_used: 2,
        sil_credits: 8,
        sil_balance_year: 2026,
        sil_last_accrual: "2026-09-01",
        status: "active",
      },
    ]);
    assert.equal(sheet.rows[0][0], "A1");
    assert.equal(sheet.rows[0][6], 10);
    assert.equal(sheet.rows[0][8], 8);
    const buf = silAccrualWorkbookBuffer(sheet.rows.length ? [
      {
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        sil_credits: 8,
        sil_allotted: 10,
        sil_days_used: 2,
        sil_balance_year: 2026,
      },
    ] : [], { year: 2026, client_name: "Nabati" });
    const wb = XLSX.read(buf);
    assert.ok(wb.SheetNames.includes("SIL"));
    assert.equal(silAccrualFilename(2026, "Nabati Food"), "SIL-accrual-2026-Nabati-Food.xlsx");
  });
});

describe("rollAlphalistRows", () => {
  it("aggregates taxable + statutory + 13th nontaxable", () => {
    const rows = rollAlphalistRows([
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        tin: "123",
        gross_pay: 15000,
        net_pay: 12000,
        basic_pay: 12000,
        deductions: { sss_ee: 500, philhealth_ee: 200, pagibig_ee: 100, wtax: 300 },
      },
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Aban",
        first_name: "Claire",
        tin: "123",
        gross_pay: 15000,
        net_pay: 12000,
        basic_pay: 12000,
        deductions: { sss_ee: 500, philhealth_ee: 200, pagibig_ee: 100, wtax: 300 },
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].gross_taxable, 30000);
    assert.equal(rows[0].nontaxable_13th, 2000);
    assert.equal(rows[0].sss_ee, 1000);
    assert.equal(rows[0].wtax, 600);
    assert.equal(rows[0].cutoff_count, 2);
  });
});
