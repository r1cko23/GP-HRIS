import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import {
  atmReportRows,
  buildDisbursementDebitMemoWorkbook,
  debitMemoFilename,
  gcashReportRows,
  payrollReportByStore,
  PAYROLL_REPORT_DETAIL_HEADERS,
} from "../disbursement-debit-memo";
import type { DisbursementPerson } from "../disbursement-debit-memo";

/** MAIN-shaped PLK Sep 15 fixtures (sp_posted-dm-atmreport / gcashreport). */
const plkPeople: DisbursementPerson[] = [
  {
    last_name: "ASUNCION",
    first_name: "JHON LLYOD",
    middle_name: "J",
    bank_account_no: "002114822164",
    pay_through: "ATM",
    net_pay: 6779.24,
    daily_rate: 695,
    rh_worked: 69.95,
    department: "ARCOVIA",
    gross_pay: 7000,
    meal: 0,
    sil_adj: 0,
    allowance: 250,
    thirteenth_month: 9738.55,
    sss_ee: 595,
    hdmf_ee: 200,
    phic_ee: 350,
    sss_er: 1190,
    sss_provident_er: 0,
    sss_ecc: 10,
    hdmf_er: 200,
    phic_er: 350,
  },
  {
    last_name: "CANARIA",
    first_name: "IRISH VIA",
    gcash: "09525066089",
    pay_through: "GCash",
    net_pay: 5608.46,
    daily_rate: 695,
    rh_worked: 57.42,
    department: "EASTWOOD",
    gross_pay: 6000,
    allowance: 0,
    thirteenth_month: 500,
    sss_ee: 400,
    hdmf_ee: 100,
    phic_ee: 200,
    sss_er: 800,
    sss_ecc: 10,
    hdmf_er: 100,
    phic_er: 200,
  },
  {
    last_name: "CASH",
    first_name: "PICKUP",
    pay_through: "Cash",
    hire_date: "2024-01-15",
    net_pay: 1500,
    daily_rate: 695,
    rh_worked: 8,
    department: "ARCOVIA",
    allowance: 0,
  },
];

describe("disbursement debit memo (MAIN dm-* shapes)", () => {
  it("builds ATM rows like sp_posted-dm-atmreport", () => {
    const rows = atmReportRows(plkPeople);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
      accountNo: "002114822164",
      amount: 6779.24,
      name: "ASUNCION, JHON LLYOD J.",
      dailyRate: 695,
      rhWorked: 69.95,
      deptStore: "ARCOVIA",
    });
  });

  it("builds GCash rows like sp_posted-dm-gcashreport", () => {
    const rows = gcashReportRows(plkPeople);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].mobile, "09525066089");
    assert.equal(rows[0].amount, 5608.46);
    assert.equal(rows[0].name, "IRISH VIA CANARIA");
    assert.equal(rows[0].deptStore, "EASTWOOD");
  });

  it("groups PAYROLL REPORT by store with meal/SIL/allowance/statutory", () => {
    const stores = payrollReportByStore(plkPeople);
    const arcovia = stores.find((s) => s.department === "ARCOVIA");
    assert.ok(arcovia);
    assert.equal(arcovia!.atmPax, 1);
    assert.equal(arcovia!.atmNet, 6779.24);
    assert.equal(arcovia!.cashPax, 1);
    assert.equal(arcovia!.gcashPax, 0);
    assert.equal(arcovia!.allowance, 250);
    assert.equal(arcovia!.thirteenthMonth, 9738.55);
    assert.equal(arcovia!.sssEe, 595);
    assert.equal(arcovia!.hdmfEe, 200);
    assert.equal(arcovia!.phicEe, 350);
    assert.equal(arcovia!.sssEr, 1190);
    assert.equal(arcovia!.sssEcc, 10);
  });

  it("writes only PAYROLL REPORT / SUMMARY / ATM / GCASH with MAIN columns", () => {
    const buf = buildDisbursementDebitMemoWorkbook({
      client_name: "PLK PHILS. INC",
      title: "POPEYES",
      pay_out_date: "SEPTEMBER 15, 2026",
      people: plkPeople,
      period_half: "second",
    });
    const wb = XLSX.read(buf, { cellStyles: true });
    assert.deepEqual(wb.SheetNames, [
      "PAYROLL REPORT",
      "SUMMARY",
      "ATM PAYROLL",
      "GCASH PAYROLL",
    ]);

    const report = XLSX.utils.sheet_to_json(wb.Sheets["PAYROLL REPORT"], {
      header: 1,
      defval: "",
    }) as unknown[][];
    const headerRow = report.find((row) => row[0] === "CLIENT NAME");
    assert.ok(headerRow, "detail header row");
    for (const col of [
      "MEAL",
      "SIL/ADJ",
      "ALLOWANCE",
      "TOTAL PAX",
      "GROSS",
      "NET ",
      "13THMONTH PAY",
      "SSS",
      "HDMF",
      "PHIC",
      "PROVIDENT",
      "EC",
    ]) {
      assert.ok(
        headerRow!.includes(col),
        `PAYROLL REPORT missing column ${col}`
      );
    }
    assert.equal(headerRow!.length, PAYROLL_REPORT_DETAIL_HEADERS.length);

    const arcovia = report.find((row) => row[0] === "ARCOVIA");
    assert.ok(arcovia);
    // CLIENT NAME, ATM pax, ATM net … ALLOWANCE (col 10), TOTAL PAX, GROSS, NET, 13TH
    assert.equal(arcovia![1], 1); // ATM pax
    assert.equal(arcovia![2], 6779.24);
    assert.equal(arcovia![10], 250); // ALLOWANCE
    assert.equal(arcovia![12], 7000); // GROSS (ATM person only gross on that person; cash has no gross → 7000)
    assert.equal(arcovia![14], 9738.55); // 13THMONTH

    const atm = XLSX.utils.sheet_to_json(wb.Sheets["ATM PAYROLL"], {
      header: 1,
    }) as unknown[][];
    assert.ok(atm.some((row) => row.includes("ASUNCION, JHON LLYOD J.")));
    assert.ok(atm.some((row) => String(row[0] ?? "").includes("Banco De Oro")));

    const summary = XLSX.utils.sheet_to_json(wb.Sheets["SUMMARY"], {
      header: 1,
      defval: "",
    }) as unknown[][];
    assert.ok(
      summary.some((row) => row.includes("ATM PAYROLL")),
      "SUMMARY ATM section"
    );
    assert.ok(
      summary.some((row) => row.includes("GCASH PAYROLL")),
      "SUMMARY GCash section"
    );
    assert.ok(
      summary.some((row) =>
        row.some((c) => String(c).includes("ATM HEADCOUNT"))
      )
    );
    assert.ok(
      summary.some((row) =>
        row.some((c) => String(c).includes("GROSS AMOUNT"))
      ),
      "SUMMARY GROSS AMOUNT"
    );
    const grossRow = summary.find((row) =>
      row.some((c) => String(c).includes("GROSS AMOUNT"))
    );
    assert.equal(grossRow?.[3], 13000);
    assert.ok(
      summary.some((row) =>
        row.some((c) => String(c).includes("CASH HEADCOUNT"))
      )
    );
    assert.ok(
      summary.some((row) => row.some((c) => String(c).includes("FINAL PAY")))
    );
    assert.ok(
      summary.some((row) => row.includes("CASH PAYROLL")),
      "SUMMARY CASH PAYROLL section (MAIN COD label)"
    );

    // Column widths set so Excel opens without dragging columns
    for (const name of wb.SheetNames) {
      const cols = wb.Sheets[name]["!cols"];
      assert.ok(cols && cols.length > 0, `${name} has !cols`);
      assert.ok(
        cols!.every((c) => (c?.wch ?? 0) >= 6),
        `${name} each col wch >= 6`
      );
    }

    assert.equal(
      debitMemoFilename("PLK PHILS. INC", "2026-09-15"),
      "Debit-Memo-PLK-PHILS.-INC-2026-09-15.xlsx"
    );
  });

  it("SUMMARY matches MAIN COD headcount + gross labels", () => {
    const buf = buildDisbursementDebitMemoWorkbook({
      client_name: "CITY OF DREAMS MANILA",
      title: "COD",
      pay_out_date: "SEPTEMBER 15, 2026",
      people: [
        {
          last_name: "A",
          first_name: "ATM",
          pay_through: "ATM",
          bank_account_no: "002",
          net_pay: 100,
          gross_pay: 120,
          department: "CITY OF DREAMS MANILA",
        },
        {
          last_name: "G",
          first_name: "CASH",
          pay_through: "GCash",
          gcash: "0917",
          net_pay: 50,
          gross_pay: 60,
          department: "CITY OF DREAMS MANILA",
        },
      ],
    });
    const wb = XLSX.read(buf);
    const summary = XLSX.utils.sheet_to_json(wb.Sheets["SUMMARY"], {
      header: 1,
      defval: "",
    }) as unknown[][];
    const line = (label: string) =>
      summary.find((row) =>
        row.some((c) => String(c).replace(/\s+/g, " ").includes(label))
      );
    assert.equal(line("GROSS AMOUNT")?.[3], 180);
    assert.equal(line("ATM HEADCOUNT")?.[3], 1);
    assert.equal(line("GCASH HEADCOUNT")?.[3], 1);
    assert.equal(line("CASH HEADCOUNT")?.[3], 0);
    assert.equal(line("FINAL PAY")?.[3], 0);
    assert.equal(line("TOTAL HEADCOUNT")?.[3], 2);
    assert.equal(line("GRAND TOTAL")?.[3], 150);
  });
});
