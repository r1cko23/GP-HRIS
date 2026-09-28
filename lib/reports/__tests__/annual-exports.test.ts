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
  formatMissMerryName,
  toMissMerryPersonRows,
  countMissMerrySalaryRanges,
} from "../thirteenth-month";
import { rollAlphalistRows } from "../alphalist";

describe("Miss Merry 13th month person rows", () => {
  it("formats CLIENT / NAME / 13TH MONTH / YTD from YTD basic", () => {
    assert.equal(
      formatMissMerryName("Ramos", "Mc-Klaude", "D."),
      "RAMOS, MC-KLAUDE D."
    );
    const rows = toMissMerryPersonRows([
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Ramos",
        first_name: "Mc-Klaude",
        middle_name: "D.",
        client_name: "IFACE",
        cutoff_count: 12,
        ytd_basic: 101823.84,
        ytd_accrual: 8485.32,
      },
    ]);
    assert.deepEqual(rows, [
      {
        client: "IFACE",
        name: "RAMOS, MC-KLAUDE D.",
        thirteenth_month: 8485.32,
        ytd: 101823.84,
        payout: "",
      },
    ]);
    const bands = countMissMerrySalaryRanges([8485.32, 3293.33, 61079.35]);
    assert.equal(bands.find((b) => b.range === "LESS 5000")?.head_count, 1);
    assert.equal(
      bands.find((b) => b.range === "PHP5,001-10,000")?.head_count,
      1
    );
    assert.equal(
      bands.find((b) => b.range === "PHP60,001-70,000")?.head_count,
      1
    );
    assert.equal(
      bands.find((b) => b.range === "GRAND TOTAL")?.head_count,
      3
    );
  });
});

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

  it("reads Organic register deduction keys (sss / philhealth / withholding_tax)", () => {
    const rows = rollAlphalistRows([
      {
        directory_employee_id: "e2",
        employee_code: "B1",
        last_name: "Cruz",
        first_name: "Ben",
        gross_pay: 10000,
        net_pay: 8000,
        basic_pay: 8000,
        deductions: {
          sss: 450,
          philhealth: 200,
          pagibig: 100,
          withholding_tax: 250,
        },
      },
    ]);
    assert.equal(rows[0].sss_ee, 450);
    assert.equal(rows[0].philhealth_ee, 200);
    assert.equal(rows[0].pagibig_ee, 100);
    assert.equal(rows[0].wtax, 250);
  });
});

describe("MAIN Final Pay layout (13th month Final Pay PDF)", () => {
  it("maps Emp ID / Full Name / No of Months / Total Basic / 13th Month Pay", async () => {
    const {
      formatFinalPayFullName,
      finalPayNoOfMonths,
      toFinalPayRows,
      FINAL_PAY_HEADERS,
      finalPayRowValues,
      buildFinalPayCsv,
    } = await import("../thirteenth-month");

    assert.equal(
      formatFinalPayFullName("Recometa", "Reinalyn", "B"),
      "RECOMETA REINALYN B."
    );
    assert.equal(finalPayNoOfMonths(21), 10.5);
    assert.deepEqual(FINAL_PAY_HEADERS, [
      "Emp ID",
      "Full Name",
      "No of Months",
      "Total Basic",
      "13th Month Pay",
    ]);

    const rows = toFinalPayRows([
      {
        directory_employee_id: "e1",
        employee_code: "25417",
        last_name: "Recometa",
        first_name: "Reinalyn",
        middle_name: "B",
        cutoff_count: 21,
        ytd_basic: 144339.35,
        ytd_accrual: 12028.28,
      },
    ]);
    assert.deepEqual(rows, [
      {
        emp_id: "25417",
        full_name: "RECOMETA REINALYN B.",
        no_of_months: 10.5,
        total_basic: 144339.35,
        thirteenth_month_pay: 12028.28,
      },
    ]);
    assert.deepEqual(finalPayRowValues(rows[0]), [
      "25417",
      "RECOMETA REINALYN B.",
      10.5,
      144339.35,
      12028.28,
    ]);

    const csv = buildFinalPayCsv(rows, {
      clientName: "",
      status: "Active",
      periodFrom: "2025-11-16",
      periodTo: "2026-09-20",
    });
    assert.match(csv, /Client:  \| Status :Active/);
    assert.match(csv, /Period: 11\/16\/2025 to 09\/20\/2026/);
    assert.match(csv, /Emp ID,Full Name,No of Months,Total Basic,13th Month Pay/);
    assert.match(csv, /25417,RECOMETA REINALYN B\.,10\.5,144339\.35,12028\.28/);
    assert.match(csv, /Total:,144339\.35,12028\.28/);
  });
});

describe("Miss Merry validated workbook + PDF", () => {
  it("exports REPORTS DETAILS and 13TH MONTH PAY-VALIDATED sheets together", async () => {
    const XLSX = (await import("xlsx-js-style")).default;
    const {
      buildMissMerryValidatedWorkbook,
      buildMissMerryValidatedPdf,
      countMissMerrySalaryRanges,
      toMissMerryPersonRows,
    } = await import("../thirteenth-month");

    const people = toMissMerryPersonRows([
      {
        directory_employee_id: "e1",
        employee_code: "A1",
        last_name: "Quilala",
        first_name: "Lou Angelo",
        middle_name: "Pangilinan",
        client_name: "KASAKA HOSPITALITY GROUP INC.",
        cutoff_count: 2,
        ytd_basic: 7177.47,
        ytd_accrual: 598.12,
      },
    ]);
    const ranges = countMissMerrySalaryRanges(people.map((p) => p.thirteenth_month));
    const buffer = buildMissMerryValidatedWorkbook({
      year: 2026,
      clientName: "Nabati Food Philippines Inc.",
      salaryRanges: ranges,
      people,
    });
    const wb = XLSX.read(buffer, { type: "buffer" });
    assert.deepEqual(wb.SheetNames, [
      "REPORTS DETAILS",
      "13TH MONTH PAY-VALIDATED",
    ]);
    const details = XLSX.utils.sheet_to_json(wb.Sheets["REPORTS DETAILS"], {
      header: 1,
    }) as unknown[][];
    assert.equal(details[0]?.[0], "NO. OF WORKERS & SALARY RANGE");
    assert.deepEqual(details[2]?.slice(0, 2), ["RANGE", "HEAD COUNTS"]);
    assert.equal(
      details.find((r) => r[0] === "LESS 5000")?.[1],
      1
    );
    assert.equal(
      details.find((r) => r[0] === "GRAND TOTAL")?.[1],
      1
    );

    const pay = XLSX.utils.sheet_to_json(
      wb.Sheets["13TH MONTH PAY-VALIDATED"],
      { header: 1 }
    ) as unknown[][];
    assert.deepEqual(pay[0], [
      "CLIENT",
      "NAME",
      "13TH MONTH",
      "YTD",
      "PAYOUT",
    ]);
    assert.equal(pay[1]?.[0], "KASAKA HOSPITALITY GROUP INC.");
    assert.equal(pay[1]?.[1], "QUILALA, LOU ANGELO PANGILINAN");
    assert.equal(pay[1]?.[2], 598.12);
    assert.equal(pay[1]?.[3], 7177.47);

    const pdf = buildMissMerryValidatedPdf({
      year: 2026,
      clientName: "Nabati Food Philippines Inc.",
      salaryRanges: ranges,
      people,
    });
    assert.ok(pdf.length > 100);
    assert.equal(pdf.subarray(0, 4).toString("utf8"), "%PDF");
  });
});
