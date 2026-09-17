import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDisbursementDebitMemoPdf,
  buildGcashUploadPdf,
} from "../disbursement-pdf";
import type { DisbursementPerson } from "../disbursement-debit-memo";

const people: DisbursementPerson[] = [
  {
    last_name: "ASUNCION",
    first_name: "JHON",
    bank_account_no: "002114822164",
    pay_through: "ATM",
    net_pay: 6779.24,
    daily_rate: 695,
    rh_worked: 69.95,
    department: "ARCOVIA",
  },
  {
    last_name: "CANARIA",
    first_name: "IRISH",
    gcash: "09525066089",
    pay_through: "GCash",
    net_pay: 5608.46,
    daily_rate: 695,
    rh_worked: 57.42,
    department: "EASTWOOD",
    client_name: "PLK",
  },
];

describe("disbursement PDFs", () => {
  it("renders debit memo multi-page PDF", () => {
    const pdf = buildDisbursementDebitMemoPdf({
      client_name: "PLK PHILS. INC",
      title: "POPEYES",
      pay_out_date: "SEPTEMBER 15, 2026",
      people,
    });
    assert.ok(pdf.byteLength > 500);
    assert.equal(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3]), "%PDF");
  });

  it("renders GCash upload PDF", () => {
    const pdf = buildGcashUploadPdf({
      pay_out_date: "SEPTEMBER 05, 2026",
      people,
      client_name: "PLK",
    });
    assert.ok(pdf.byteLength > 400);
    assert.equal(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3]), "%PDF");
  });
});
