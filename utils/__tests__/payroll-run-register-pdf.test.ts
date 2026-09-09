import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYROLL_REGISTER_PDF_HEADERS } from "@/lib/payroll-summary/register-columns";
import type { GpPayrollRegisterTable } from "@/lib/payroll-export/build-gp-payroll-register";
import { generateGpPayrollRegisterPDF } from "../payroll-run-register-pdf";

function claireWideTable(): GpPayrollRegisterTable {
  // Wide pesos that were wrapping mid-digit on Legal landscape (Nabati Aug 16–31).
  const row = [
    "Aban, Claire",
    600,
    104,
    13,
    7800,
    7800,
    0,
    4140.11,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    4140.11,
    124.6,
    0,
    0,
    0,
    0,
    11940.11,
    425,
    0,
    195,
    100,
    0,
    895.92,
    184.08,
    1460.92,
    10479.19,
    650,
    124.6,
    12200,
  ];
  assert.equal(row.length, PAYROLL_REGISTER_PDF_HEADERS.length);
  return {
    title: "Payroll Summary",
    subtitle: "Nabati Food Philippines Inc. · Batangas · 08/16/2026 – 08/31/2026",
    headers: [...PAYROLL_REGISTER_PDF_HEADERS],
    rows: [row],
    totalsRow: ["TOTAL", ...row.slice(1)],
    columnWidths: [
      32, 11, 9, 8, 12, 12, 9, 11, 9, 11, 9, 11, 9, 11, 9, 11, 11, 10, 10, 10,
      10, 10, 12, 10, 10, 11, 11, 10, 11, 11, 12, 12, 11, 10, 11,
    ],
  };
}

type AutoTableCell = { text: string[]; raw?: unknown };
type AutoTableBodyRow = { cells: Record<string, AutoTableCell> };

function bodyRows(doc: {
  lastAutoTable?: { body?: AutoTableBodyRow[] };
}): AutoTableBodyRow[] {
  const body = doc.lastAutoTable?.body;
  assert.ok(body && body.length > 0, "autoTable body missing");
  return body;
}

describe("generateGpPayrollRegisterPDF", () => {
  it("keeps every money amount on a single line (no mid-number wrap)", () => {
    const doc = generateGpPayrollRegisterPDF(claireWideTable());
    const rows = bodyRows(
      doc as { lastAutoTable?: { body?: AutoTableBodyRow[] } }
    );

    for (const [rowIndex, row] of rows.entries()) {
      for (let col = 1; col < PAYROLL_REGISTER_PDF_HEADERS.length; col++) {
        const cell = row.cells[String(col)];
        const lines = cell?.text ?? [];
        assert.equal(
          lines.length,
          1,
          `row ${rowIndex} col ${col} (${PAYROLL_REGISTER_PDF_HEADERS[col]}) wrapped: ${JSON.stringify(lines)}`
        );
      }
    }

    const claire = rows[0]!.cells;
    assert.deepEqual(claire["7"]?.text, ["4,140.11"]);
    assert.deepEqual(claire["22"]?.text, ["11,940.11"]);
    assert.deepEqual(claire["31"]?.text, ["10,479.19"]);
    assert.deepEqual(claire["34"]?.text, ["12,200.00"]);
  });

  it("keeps wide TOTAL pesos on one line (many-employee scale)", () => {
    const base = claireWideTable();
    const fat = base.totalsRow.map((cell, i) =>
      i === 0 ? "TOTAL" : typeof cell === "number" ? cell * 42 : cell
    );
    const table = { ...base, totalsRow: fat };
    const doc = generateGpPayrollRegisterPDF(table);
    const rows = bodyRows(
      doc as { lastAutoTable?: { body?: AutoTableBodyRow[] } }
    );
    const total = rows[rows.length - 1]!.cells;
    for (let col = 1; col < PAYROLL_REGISTER_PDF_HEADERS.length; col++) {
      assert.equal(
        (total[String(col)]?.text ?? []).length,
        1,
        `TOTAL col ${col} wrapped: ${JSON.stringify(total[String(col)]?.text)}`
      );
    }
    assert.deepEqual(total["22"]?.text, ["501,484.62"]); // 11940.11 * 42
  });
});
