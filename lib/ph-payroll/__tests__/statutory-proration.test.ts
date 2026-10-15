import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyStatutoryProration,
  cutoffNeedsStatutoryProration,
  statutoryProrationFactor,
} from "../statutory-proration";
import { statutoryThisCutoff } from "../statutory-schedule";
import { buildRegisterLine } from "@/lib/payroll-register/compute";

const semi = {
  cut1_start: 1,
  cut1_end: 15,
  cut2_start: 16,
  cut2_end: 30,
  pay_frequency: "semi-monthly" as const,
  statutory_schedule: "Semi-Monthly",
  wtax_schedule: "Semi-Monthly",
};

describe("cutoffNeedsStatutoryProration", () => {
  it("does not prorate a full second kinsena 16–30", () => {
    assert.equal(
      cutoffNeedsStatutoryProration(semi, "2026-09-16", "2026-09-30"),
      false
    );
  });

  it("prorates a short second window 16–25 (SMXCC weekly)", () => {
    assert.equal(
      cutoffNeedsStatutoryProration(semi, "2026-09-16", "2026-09-25"),
      true
    );
  });

  it("prorates when the cutoff pay frequency is weekly", () => {
    assert.equal(
      cutoffNeedsStatutoryProration(
        semi,
        "2026-09-16",
        "2026-09-30",
        "weekly"
      ),
      true
    );
  });
});

describe("statutoryProrationFactor / applyStatutoryProration", () => {
  it("is 1 on a full kinsena", () => {
    assert.equal(statutoryProrationFactor(7, false), 1);
  });

  it("uses days worked over 13 on a short cutoff (MAIN SSS)", () => {
    assert.equal(statutoryProrationFactor(7, true), 7 / 13);
  });

  it("snaps SSS to the ₱25 grid after proration", () => {
    // 450 × 7/13 = 242.307… → ₱250
    assert.equal(applyStatutoryProration(450, 7 / 13, { snap: 25 }), 250);
  });

  it("round-2 prorates PhilHealth without a peso grid", () => {
    // 225.88 × 7/13 ≈ 121.63
    assert.equal(applyStatutoryProration(225.88, 7 / 13), 121.63);
  });
});

describe("buildRegisterLine short kinsena proration", () => {
  const hoursRow = {
    id: "h1",
    directory_employee_id: "d1",
    office_employee_id: "o1",
    employee_code: "202609-00001",
    last_name: "Abas",
    first_name: "Ibrahim",
    daily_rate_payroll: 695,
    actual_regular_hours: 56,
  };

  it("posts full semi-monthly half on a complete second kinsena", () => {
    const flags = {
      ...statutoryThisCutoff(semi, "2026-09-16"),
      prorateToKinsenaDays: false,
    };
    const line = buildRegisterLine({
      hoursRow: { ...hoursRow, actual_regular_hours: 104 },
      payee: { id: "o1", daily_rate: 695 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      statutory: flags,
    });
    assert.equal(line.deductions.sss, 450);
    assert.equal(line.deductions.philhealth, 225.88);
  });

  it("prorates SSS (₱25 grid) and PhilHealth by days/13 on a short cutoff", () => {
    const flags = {
      ...statutoryThisCutoff(semi, "2026-09-16"),
      prorateToKinsenaDays: true,
    };
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", daily_rate: 695 },
      loans: [],
      periodStart: new Date("2026-09-16T00:00:00Z"),
      statutory: flags,
    });
    // 56h → 7 days; 450 × 7/13 → ₱250; 225.88 × 7/13 → ₱121.63
    assert.equal(line.deductions.sss, 250);
    assert.equal(line.deductions.philhealth, 121.63);
    assert.equal(line.deductions.pagibig, 0); // second kinsena: Pag-IBIG off
  });

  it("prorates Pag-IBIG and fixed PhilHealth on a short first kinsena", () => {
    const flags = {
      ...statutoryThisCutoff(semi, "2026-09-01"),
      prorateToKinsenaDays: true,
    };
    const line = buildRegisterLine({
      hoursRow,
      payee: { id: "o1", daily_rate: 695 },
      loans: [],
      periodStart: new Date("2026-09-01T00:00:00Z"),
      statutory: flags,
    });
    // Fixed PH ₱250 × 7/13 → ₱134.62; Pag-IBIG full ₱200 × 7/13 → ₱107.69
    assert.equal(line.deductions.philhealth, 134.62);
    assert.equal(line.deductions.pagibig, 107.69);
  });
});
