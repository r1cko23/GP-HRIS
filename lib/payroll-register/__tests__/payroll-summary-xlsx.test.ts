import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import { buildOrganicRegisterSummaryTable } from "../build-register-summary-table";
import {
  buildPayrollSummaryWorkbook,
  payrollSummaryXlsxFilename,
} from "../payroll-summary-xlsx";

describe("payroll summary xlsx", () => {
  it("writes header row and employee net from the register table", () => {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-01",
      periodEnd: "2026-09-15",
      companyName: "PLK PHILS. INC",
      lines: [
        {
          last_name: "Asuncion",
          first_name: "Jhon",
          daily_rate: 695,
          net_pay: 6779.24,
          gross_pay: 8000,
          total_deductions: 1220.76,
          hours: { actual_regular_hours: 69.95 },
        },
      ],
    });
    const buf = buildPayrollSummaryWorkbook(table);
    const wb = XLSX.read(buf);
    assert.ok(wb.SheetNames.includes("Payroll Summary"));
    const aoa = XLSX.utils.sheet_to_json(wb.Sheets["Payroll Summary"], {
      header: 1,
    }) as unknown[][];
    assert.ok(aoa.some((row) => row.includes("Asuncion, Jhon")));
    assert.equal(
      payrollSummaryXlsxFilename("PLK", "2026-09-01", "2026-09-15"),
      "Payroll-Summary-PLK-2026-09-01-2026-09-15.xlsx"
    );
  });
});
