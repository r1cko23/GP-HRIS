import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import { wrapBillingSoa } from "../compute";
import {
  billingLineToSoaRow,
  buildDebitMemo,
  buildSoaExpenseRows,
  buildSoaHeader,
  debitMemoFilename,
  debitMemoToPdf,
  parseBillingOutputPack,
  soaFilename,
  soaHeaderPairs,
  soaSheet,
  soaWorkbookBuffer,
  withDirectoryPerson,
} from "../outputs";

const abanLine = {
  employee_code: "202309-00023",
  last_name: "Aban",
  first_name: "Claire",
  billing_daily_rate: 600,
  billing_hourly_rate: 75,
  hours: {
    hours_work: 96,
    actual_regular_hours: 96,
    overtime_hours: 0,
    night_diff_hours: 0,
  },
  amounts: {
    regular: 7200,
    overtime: 0,
    night_diff: 0,
    allowance: 0,
  },
  labor: 7200,
  mandatories: 0,
  billable: 7200,
};

describe("parseBillingOutputPack", () => {
  it("defaults unknown packs to generic", () => {
    assert.equal(parseBillingOutputPack(null), "generic");
    assert.equal(parseBillingOutputPack("GENERIC"), "generic");
    assert.equal(parseBillingOutputPack("aldex"), "aldex");
    assert.equal(parseBillingOutputPack("nope"), "generic");
  });
});

describe("billingLineToSoaRow", () => {
  it("maps a Nabati GENERIC line: 96h × ₱600 billing daily (hourly 75 → ₱7,200)", () => {
    const row = billingLineToSoaRow(abanLine);
    assert.equal(row.employee_code, "202309-00023");
    assert.equal(row.last_name, "Aban");
    assert.equal(row.first_name, "Claire");
    assert.equal(row.daily_rate, 600);
    assert.equal(row.hourly_rate, 75);
    assert.equal(row.reg_hours, 96);
    assert.equal(row.reg_amount, 7200);
    assert.equal(row.labor, 7200);
    assert.equal(row.billable, 7200);
  });

  it("copies stored amounts and does not recompute labor from hours", () => {
    const row = billingLineToSoaRow({
      ...abanLine,
      amounts: { ...abanLine.amounts, regular: 1 },
      labor: 1,
      billable: 1,
    });
    assert.equal(row.reg_hours, 96);
    assert.equal(row.reg_amount, 1);
    assert.equal(row.labor, 1);
  });
});

describe("withDirectoryPerson", () => {
  it("fills a missing employee code from the Directory 201", () => {
    const filled = withDirectoryPerson(
      { ...abanLine, employee_code: null },
      { employee_code: "202309-00023", last_name: "Aban", first_name: "Claire" }
    );
    assert.equal(filled.employee_code, "202309-00023");
  });

  it("does not overwrite a code already stored on the billing line", () => {
    const filled = withDirectoryPerson(abanLine, {
      employee_code: "OTHER",
      last_name: "X",
      first_name: "Y",
    });
    assert.equal(filled.employee_code, "202309-00023");
    assert.equal(filled.last_name, "Aban");
  });
});

describe("buildSoaHeader", () => {
  it("ports MAIN headerGENERIC letterhead fields from the stored run (not recomputed)", () => {
    const wrap = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    const header = buildSoaHeader({
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      headcount: 27,
      totals: wrap,
      pack: "generic",
      prepared_by_name: "Ana Cruz",
      prepared_by_role: "Billing Officer",
      noted_by_name: "Ben Santos",
      noted_by_role: "Account Manager",
    });
    assert.equal(header.billing_reference, "BILL-2026-09-16-2026-09-30");
    assert.equal(header.client_name, "Nabati Food Philippines Inc.");
    assert.equal(header.date_covered, "Sep-16-2026 to Sep-30-2026");
    assert.equal(header.billing_date, "2026-09-08");
    assert.equal(header.site, "Batangas");
    assert.equal(header.admin_fee_rate, 0.055);
    assert.equal(header.vat_rate, 0.12);
    assert.equal(header.ewt_rate, 0.02);
    assert.equal(header.amount_due, 9585.73);
    assert.equal(header.pack, "generic");
    assert.equal(header.prepared_by_name, "Ana Cruz");
    assert.equal(header.prepared_by_role, "Billing Officer");
    assert.equal(header.noted_by_name, "Ben Santos");
    assert.equal(header.noted_by_role, "Account Manager");
    const pairs = soaHeaderPairs(header);
    assert.ok(pairs.some((row) => row[0] === "Prepared by" && row[1] === "Ana Cruz"));
    assert.ok(pairs.some((row) => row[0] === "Noted by" && row[1] === "Ben Santos"));
  });
});

describe("buildSoaExpenseRows", () => {
  it("copies BILLINGEXPENSE-shaped particular / amount rows (empty when none)", () => {
    assert.deepEqual(buildSoaExpenseRows(undefined), []);
    assert.deepEqual(buildSoaExpenseRows([]), []);
    assert.deepEqual(
      buildSoaExpenseRows([
        { particular: "Uniform", amount: 1000 },
        { particular: "Food Service", amount: 3500 },
      ]),
      [
        { particular: "Uniform", amount: 1000 },
        { particular: "Food Service", amount: 3500 },
      ]
    );
  });

  it("drops blank particulars and non-finite amounts", () => {
    assert.deepEqual(
      buildSoaExpenseRows([
        { particular: "  ", amount: 10 },
        { particular: "Uniform", amount: "x" },
        { particular: "Nameplate", amount: 250.5 },
      ]),
      [{ particular: "Nameplate", amount: 250.5 }]
    );
  });
});

describe("soaSheet", () => {
  it("puts GENERIC hours × billing rate on the body and wrap totals on Wrap", () => {
    const wrap = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    const sheet = soaSheet({
      pack: "generic",
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      lines: [abanLine],
      totals: wrap,
      expenses: [{ particular: "Uniform", amount: 1000 }],
    });
    assert.equal(sheet.pack, "generic");
    assert.ok(sheet.headers.includes("Reg hours"));
    assert.ok(sheet.headers.includes("Reg amount"));
    const body = sheet.rows[0];
    assert.equal(body[sheet.headers.indexOf("Employee code")], "202309-00023");
    assert.equal(body[sheet.headers.indexOf("Reg hours")], 96);
    assert.equal(body[sheet.headers.indexOf("Reg amount")], 7200);
    assert.equal(sheet.wrap.find((row) => row[0] === "Amount due")?.[1], 9585.73);
    assert.equal(sheet.header.client_name, "Nabati Food Philippines Inc.");
    assert.equal(sheet.header.date_covered, "Sep-16-2026 to Sep-30-2026");
    assert.deepEqual(sheet.expenses, [{ particular: "Uniform", amount: 1000 }]);
  });
});

describe("buildDebitMemo", () => {
  it("copies the stored wrap amount due (does not re-wrap fees)", () => {
    const wrap = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    const memo = buildDebitMemo({
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      headcount: 27,
      totals: wrap,
    });
    assert.equal(memo.amount_due, 9585.73);
    assert.equal(memo.billing_reference, "BILL-2026-09-16-2026-09-30");
    assert.equal(memo.headcount, 27);

    const stored = buildDebitMemo({
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      headcount: 1,
      totals: { ...wrap, amount_due: 999 },
    });
    assert.equal(stored.amount_due, 999);
  });
});

describe("file bytes", () => {
  it("writes an xlsx SOA and a PDF debit memo from stored wrap totals", () => {
    const wrap = wrapBillingSoa({
      labor: 8260,
      mandatories: 0,
      admin_fee: 0.055,
      vat: 0.12,
      ewt: 0.02,
    });
    const sheet = soaSheet({
      pack: "generic",
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      lines: [abanLine],
      totals: wrap,
      expenses: [{ particular: "Uniform", amount: 1000 }],
    });
    const xlsx = soaWorkbookBuffer(sheet);
    assert.equal(xlsx.subarray(0, 2).toString("utf8"), "PK");
    const wb = XLSX.read(xlsx, { type: "buffer" });
    assert.deepEqual(wb.SheetNames, ["Header", "Body", "Expense", "Wrap"]);
    const headerRows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets.Header, {
      header: 1,
    }) as Array<[string, unknown]>;
    assert.equal(
      headerRows.find((row) => row[0] === "Date covered")?.[1],
      "Sep-16-2026 to Sep-30-2026"
    );
    const expenseRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
      wb.Sheets.Expense
    );
    assert.equal(expenseRows[0]?.Particular, "Uniform");
    assert.equal(expenseRows[0]?.Amount, 1000);

    const memo = buildDebitMemo({
      client_name: "Nabati Food Philippines Inc.",
      site: "Batangas",
      period_start: "2026-09-16",
      period_end: "2026-09-30",
      billing_reference: "BILL-2026-09-16-2026-09-30",
      billing_date: "2026-09-08",
      headcount: 27,
      totals: wrap,
    });
    const pdf = debitMemoToPdf(memo);
    assert.equal(Buffer.from(pdf.subarray(0, 4)).toString("latin1"), "%PDF");
    const pdfText = Buffer.from(pdf).toString("latin1");
    assert.match(pdfText, /BILL-2026-09-16-2026-09-30/);
    assert.match(pdfText, /9,585.73/);
    assert.match(pdfText, /Debit memo/);
    assert.match(pdfText, /Green Pasture People Management Inc/);
    // Landscape MediaBox: width > height (A4 landscape ~842 x 595 points)
    assert.match(pdfText, /MediaBox\s*\[\s*0\s+0\s+841\.[\d]+\s+595\.[\d]+\s*\]/);
  });
});

describe("filenames", () => {
  it("stamps pack and billing reference", () => {
    assert.equal(
      soaFilename("generic", "BILL-2026-09-16-2026-09-30"),
      "SOA-GENERIC-BILL-2026-09-16-2026-09-30.xlsx"
    );
    assert.equal(
      soaFilename("aldex", "BILL-2026-09-16-2026-09-30"),
      "SOA-ALDEX-BILL-2026-09-16-2026-09-30.xlsx"
    );
    assert.equal(
      debitMemoFilename("BILL-2026-09-16-2026-09-30"),
      "DM-BILL-2026-09-16-2026-09-30.pdf"
    );
  });
});
