import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapParticularToLoanType, normalizePaymentTerm } from "../particular";
import {
  generateLoanInstallments,
  installmentCountFromHeader,
  perInstallmentFromHeader,
} from "../schedule";
import { deductionForCutoff } from "../deduct";

describe("mapParticularToLoanType", () => {
  it("maps SSS / Pag-IBIG / cash advance labels", () => {
    assert.equal(mapParticularToLoanType("SSS Loan"), "sss");
    assert.equal(mapParticularToLoanType("SSS Loan Calamity"), "sss_calamity");
    assert.equal(mapParticularToLoanType("Pag-Ibig Loan"), "pagibig");
    assert.equal(
      mapParticularToLoanType("Pag-Ibig Loan Calamiy"),
      "pagibig_calamity"
    );
    assert.equal(mapParticularToLoanType("Cash Advance"), "other");
    assert.equal(mapParticularToLoanType("Company ID"), "other");
  });
});

describe("normalizePaymentTerm", () => {
  it("treats Semi-Monthly as semi-monthly", () => {
    assert.equal(normalizePaymentTerm("Semi-Monthly"), "semi-monthly");
    assert.equal(normalizePaymentTerm("Monthly"), "monthly");
  });
});

describe("generateLoanInstallments", () => {
  it("builds 24 semi-monthly rows from a 12-month cash advance", () => {
    const rows = generateLoanInstallments({
      effectivityDate: "2026-01-01",
      installmentCount: 24,
      perInstallment: 541.25,
      originalBalance: 12990,
      paymentTerm: "semi-monthly",
    });
    assert.equal(rows.length, 24);
    assert.equal(rows[0].period_start, "2026-01-01");
    assert.equal(rows[0].period_end, "2026-01-15");
    assert.equal(rows[1].period_start, "2026-01-16");
    assert.equal(rows[1].period_end, "2026-01-31");
    assert.equal(rows[2].period_start, "2026-02-01");
    const total = rows.reduce((acc, r) => acc + r.amount, 0);
    assert.equal(Math.round(total * 100) / 100, 12990);
  });

  it("places monthly first-window SSS on the 1st only", () => {
    const rows = generateLoanInstallments({
      effectivityDate: "2026-09-01",
      installmentCount: 3,
      perInstallment: 1799.65,
      originalBalance: 5398.95,
      paymentTerm: "monthly",
      cutoffAssignment: "first",
    });
    assert.equal(rows.length, 3);
    assert.deepEqual(
      rows.map((r) => r.period_start),
      ["2026-09-01", "2026-10-01", "2026-11-01"]
    );
    assert.equal(rows[0].period_end, "2026-09-15");
  });
});

describe("header installment helpers", () => {
  it("splits a bi-monthly monthly payment across two cutoffs", () => {
    assert.equal(
      installmentCountFromHeader({
        totalTerms: 12,
        paymentTerm: "semi-monthly",
      }),
      24
    );
    assert.equal(
      perInstallmentFromHeader({
        monthlyPayment: 1082.5,
        paymentTerm: "semi-monthly",
      }),
      541.25
    );
  });
});

describe("deductionForCutoff", () => {
  const loan = {
    loan_type: "sss",
    monthly_payment: 1799.65,
    cutoff_assignment: "first",
    deduct_bi_monthly: false,
    current_balance: 17996.5,
    effectivity_date: "2025-07-01",
  };

  it("uses the matching schedule amount on the first kinsena", () => {
    const d = deductionForCutoff({
      loan,
      periodStart: new Date("2026-09-01T00:00:00Z"),
      scheduled: { id: "sched-1", amount: 1799.65 },
    });
    assert.equal(d.amount, 1799.65);
    assert.equal(d.schedule_id, "sched-1");
  });

  it("skips the second kinsena when assignment is first and no schedule", () => {
    const d = deductionForCutoff({
      loan,
      periodStart: new Date("2026-09-16T00:00:00Z"),
    });
    assert.equal(d.amount, 0);
  });

  it("caps at remaining balance", () => {
    const d = deductionForCutoff({
      loan: { ...loan, current_balance: 200 },
      periodStart: new Date("2026-09-01T00:00:00Z"),
      scheduled: { id: "sched-1", amount: 1799.65 },
    });
    assert.equal(d.amount, 200);
  });

  it("skips before effectivity", () => {
    const d = deductionForCutoff({
      loan: { ...loan, effectivity_date: "2026-10-01" },
      periodStart: new Date("2026-09-01T00:00:00Z"),
      periodEnd: new Date("2026-09-15T00:00:00Z"),
      scheduled: { id: "sched-1", amount: 1799.65 },
    });
    assert.equal(d.amount, 0);
  });
});
