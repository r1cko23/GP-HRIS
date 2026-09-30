import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anniversaryDateInYear,
  buildSilMonthlyRow,
  isEligibleForSilMonthlyRun,
  priorAnniversaryDate,
  silAmount,
  silDaysEntitlement,
  silMonthsFromDays,
  silMonthlyRunWindow,
  daysWorkedFromRegisterLine,
  sumDaysWorkedInWindow,
} from "../sil-monthly-run";
import {
  buildSilMonthlyWorkbook,
  silMonthlyFilename,
  SIL_MONTHLY_HEADERS,
} from "../sil-monthly-export";
import XLSX from "xlsx-js-style";

describe("silMonthsFromDays / entitlement / amount (hotel Excel)", () => {
  it("matches Ana Lamar sample: 302.06 days @ 695 → 4.84 days / ₱3363.80", () => {
    const days = 302.06;
    const rate = 695;
    assert.equal(Number(silMonthsFromDays(days).toFixed(10)), 11.6176923077);
    assert.equal(silDaysEntitlement(days), 4.84);
    assert.equal(silAmount(rate, days), 3363.8);
  });

  it("returns 0 for zero / negative days or rate", () => {
    assert.equal(silMonthsFromDays(0), 0);
    assert.equal(silDaysEntitlement(0), 0);
    assert.equal(silAmount(695, 0), 0);
    assert.equal(silAmount(0, 302.06), 0);
    assert.equal(silAmount(695, -1), 0);
  });
});

describe("anniversary helpers", () => {
  it("builds anniversary in year and prior anniversary", () => {
    assert.equal(anniversaryDateInYear("2024-03-14", 2026), "2026-03-14");
    assert.equal(priorAnniversaryDate("2024-03-14", 2026), "2025-03-14");
  });

  it("clamps Feb 29 hire to Feb 28 in non-leap year", () => {
    assert.equal(anniversaryDateInYear("2020-02-29", 2025), "2025-02-28");
    assert.equal(anniversaryDateInYear("2020-02-29", 2024), "2024-02-29");
  });

  it("includes only hire-month anniversaries with tenure ≥ 1 year as of month-end", () => {
    // Hired Mar 14 2024 → eligible Mar 2025+
    assert.equal(isEligibleForSilMonthlyRun("2024-03-14", 2026, 3), true);
    assert.equal(isEligibleForSilMonthlyRun("2024-03-14", 2025, 3), true);
    assert.equal(isEligibleForSilMonthlyRun("2024-03-14", 2024, 3), false);
    // Wrong month
    assert.equal(isEligibleForSilMonthlyRun("2024-03-14", 2026, 4), false);
    // Missing hire
    assert.equal(isEligibleForSilMonthlyRun(null, 2026, 3), false);
  });

  it("window is prior anniversary through this anniversary", () => {
    assert.deepEqual(silMonthlyRunWindow("2024-03-14", 2026), {
      from: "2025-03-14",
      to: "2026-03-14",
    });
  });
});

describe("buildSilMonthlyRow", () => {
  it("computes row fields and remarks when days missing", () => {
    const withDays = buildSilMonthlyRow({
      last_name: "Lamar",
      first_name: "Ana",
      hire_date: "2024-03-14",
      status: "active",
      daily_rate: 695,
      days_worked: 302.06,
    });
    assert.equal(withDays.months, 302.06 / 26);
    assert.equal(withDays.days_entitlement, 4.84);
    assert.equal(withDays.amount, 3363.8);
    assert.equal(withDays.employment_status, "Active");
    assert.equal(withDays.remarks, "");

    const noDays = buildSilMonthlyRow({
      last_name: "Cruz",
      first_name: "Ben",
      hire_date: "2023-03-01",
      status: "inactive",
      daily_rate: 500,
      days_worked: 0,
    });
    assert.equal(noDays.employment_status, "Inactive");
    assert.match(noDays.remarks, /missing/i);
  });
});

describe("daysWorkedFromRegisterLine", () => {
  it("reads earnings.days_work then hours÷8", () => {
    assert.equal(
      daysWorkedFromRegisterLine({ earnings: { days_work: 13 }, hours: {} }),
      13
    );
    assert.equal(
      daysWorkedFromRegisterLine({
        earnings: {},
        hours: { actual_regular_hours: 88, pto_hours: 8 },
      }),
      12
    );
  });
});

describe("sumDaysWorkedInWindow", () => {
  it("sums days for lines whose payroll_date falls in [from, to]", () => {
    const total = sumDaysWorkedInWindow(
      [
        { payroll_date: "2025-03-15", days_worked: 13 },
        { payroll_date: "2025-04-15", days_worked: 12.5 },
        { payroll_date: "2025-03-13", days_worked: 99 }, // before window
        { payroll_date: "2026-03-15", days_worked: 10 }, // after window
        { payroll_date: "2026-03-14", days_worked: 11 },
      ],
      { from: "2025-03-14", to: "2026-03-14" }
    );
    assert.equal(total, 36.5);
  });
});

describe("SIL monthly export", () => {
  it("writes hotel sheet headers, title, and amount total", () => {
    const row = buildSilMonthlyRow({
      last_name: "Lamar",
      first_name: "Ana",
      hire_date: "2024-03-14",
      status: "active",
      daily_rate: 695,
      days_worked: 302.06,
    });
    const buf = buildSilMonthlyWorkbook([row], {
      year: 2026,
      month: 3,
      client_name: "IM ONSEN AND SPA INC. - IM HOTEL",
    });
    const wb = XLSX.read(buf);
    assert.ok(wb.SheetNames.includes("SIL"));
    const sheet = wb.Sheets.SIL;
    const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    assert.equal(aoa[0]?.[0], "SERVICE INCENTIVE LEAVE - MARCH 2026");
    assert.equal(aoa[1]?.[0], "IM ONSEN AND SPA INC. - IM HOTEL");
    assert.deepEqual(aoa[3], [...SIL_MONTHLY_HEADERS]);
    assert.equal(aoa[4]?.[1], "LAMAR");
    assert.equal(aoa[4]?.[10], 3363.8);
    assert.equal(silMonthlyFilename(2026, 3, "IM Hotel"), "SIL-MARCH-2026-IM-Hotel.xlsx");
  });
});
