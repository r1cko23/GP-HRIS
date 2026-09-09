import assert from "node:assert/strict";
import { describe, it } from "node:test";
import XLSX from "xlsx-js-style";
import {
  bucketFundingPeople,
  buildFundingMemoWorkbook,
  parseFundingPayThrough,
  fundingMemoFilename,
} from "../funding-memo";

describe("parseFundingPayThrough", () => {
  it("normalizes ATM / cheque / GCash / hold", () => {
    assert.equal(parseFundingPayThrough(null), "atm");
    assert.equal(parseFundingPayThrough("ATM"), "atm");
    assert.equal(parseFundingPayThrough("Cheque"), "cheque");
    assert.equal(parseFundingPayThrough("GCash"), "gcash");
    assert.equal(parseFundingPayThrough("HOLD CASH"), "hold");
  });
});

describe("buildFundingMemoWorkbook", () => {
  it("splits channels into SUMMARY + ATM + liquidation sheets", () => {
    const people = [
      {
        last_name: "Aban",
        first_name: "Claire",
        bank_account_no: "111",
        pay_through: "ATM",
        net_pay: 5000,
      },
      {
        last_name: "Cruz",
        first_name: "Ben",
        pay_through: "Cheque",
        hire_date: "2024-01-01",
        net_pay: 2000,
      },
      {
        last_name: "Diaz",
        first_name: "Ana",
        pay_through: "GCash",
        gcash: "0917",
        net_pay: 1500,
      },
    ];
    const buckets = bucketFundingPeople(people);
    assert.equal(buckets.find((b) => b.channel === "atm")?.total, 5000);
    assert.equal(buckets.find((b) => b.channel === "cheque")?.pax, 1);

    const buf = buildFundingMemoWorkbook({
      client_name: "Manila Hilton Hotel",
      title: "Service Charge June 16-30, 2026 ADJUSTMENT",
      pay_out_date: "AUGUST 28, 2026",
      people,
    });
    const wb = XLSX.read(buf);
    for (const name of [
      "SUMMARY",
      "ATM PAYROLL",
      "CHEQUE PAYROLL",
      "GCASH",
      "HOLD CASH PAYROLL",
      "PAYROLL REPORT",
    ]) {
      assert.ok(wb.SheetNames.includes(name), name);
    }
    const atm = XLSX.utils.sheet_to_json(wb.Sheets["ATM PAYROLL"], {
      header: 1,
    }) as unknown[][];
    assert.ok(atm.some((row) => row.includes("Aban, Claire")));
    assert.equal(
      fundingMemoFilename("Manila Hilton Hotel", "2026-06-16-2026-06-30"),
      "Funding-Memo-Manila-Hilton-Hotel-2026-06-16-2026-06-30.xlsx"
    );
  });
});
