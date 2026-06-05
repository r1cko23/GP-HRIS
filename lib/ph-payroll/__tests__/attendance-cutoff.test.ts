import { computeDaysWork } from "../attendance-cutoff";

describe("computeDaysWork", () => {
  test("rank-and-file: uses max(basePayHours, actualTotalBH)", () => {
    const result = computeDaysWork({
      basePayHours: 96,
      actualTotalBH: 88,
      renderedSpecialBH: 0,
      excludeWorkedSpecialDayFromDaysWork: false,
    });
    expect(result.totalBHForDaysWork).toBe(96);
    expect(result.daysWorked).toBe(12);
  });

  test("managerial: uses base minus rendered special hours", () => {
    const result = computeDaysWork({
      basePayHours: 104,
      actualTotalBH: 43,
      renderedSpecialBH: 8,
      excludeWorkedSpecialDayFromDaysWork: true,
    });
    expect(result.totalBHForDaysWork).toBe(96);
    expect(result.daysWorked).toBe(12);
  });

  test("caps at 104 hours per cutoff", () => {
    const result = computeDaysWork({
      basePayHours: 104,
      actualTotalBH: 120,
      renderedSpecialBH: 0,
      excludeWorkedSpecialDayFromDaysWork: false,
    });
    expect(result.totalBHForDaysWork).toBe(104);
  });
});
