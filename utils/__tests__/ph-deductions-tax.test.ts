/**
 * BIR withholding tax table tests (semi-monthly + monthly).
 * Table effective Jan 1, 2023 — still valid for 2026 payroll.
 */

import {
  getWithholdingTaxBreakdown,
  calculateSemiMonthlyWithholdingTax,
  calculateWithholdingTax,
} from "../ph-deductions";

describe("BIR Semi-Monthly Withholding Tax (Jan 1 2023+)", () => {
  test("bracket 1: ₱10,417 and below = zero tax", () => {
    expect(calculateSemiMonthlyWithholdingTax(10417)).toBe(0);
    expect(calculateSemiMonthlyWithholdingTax(5000)).toBe(0);
  });

  test("bracket 2: 15% over ₱10,417", () => {
    // ₱15,000 taxable → (15000 - 10417) × 15% = 687.45
    expect(calculateSemiMonthlyWithholdingTax(15000)).toBe(687.45);
  });

  test("bracket 3: ₱937.50 + 20% over ₱16,667", () => {
    // ₱20,000 → 937.50 + (20000 - 16667) × 20% = 937.50 + 666.60 = 1604.10
    expect(calculateSemiMonthlyWithholdingTax(20000)).toBe(1604.1);
  });

  test("semi-monthly brackets differ from monthly at same peso amount", () => {
    const semi = getWithholdingTaxBreakdown(15000, "semi-monthly");
    const monthly = getWithholdingTaxBreakdown(15000, "monthly");
    expect(semi.withholdingTax).toBe(687.45);
    expect(monthly.withholdingTax).toBe(0); // monthly bracket 1 is up to 20833
    expect(semi.frequency).toBe("semi-monthly");
    expect(monthly.frequency).toBe("monthly");
  });
});

describe("BIR Monthly Withholding Tax (legacy full-month)", () => {
  test("monthly bracket 1: ₱20,833 and below = zero", () => {
    expect(calculateWithholdingTax(20833)).toBe(0);
  });
});
