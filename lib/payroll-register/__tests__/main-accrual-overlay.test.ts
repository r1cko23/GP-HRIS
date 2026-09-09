import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PAYROLL_REGISTER_HEADERS } from "@/lib/payroll-summary/register-columns";
import { silCutoffAccrual } from "@/lib/reports/sil-cutoff-accrual";
import { thirteenthMonthAccrual } from "@/lib/reports/thirteenth-month";
import { buildOrganicRegisterSummaryTable } from "../build-register-summary-table";
import {
  matchScrapedAccrual,
  overlayMainAccruals,
  scrapedAccrualsFromParsedEmployees,
  selectLatestMainScrape,
  siteMatchesAuditCompany,
} from "../main-accrual-overlay";
import { organicRegisterLineToAuditRow } from "../organic-register-to-audit-row";

/** Claire Aban, Nabati Batangas Aug 16–31 MAIN scrape. */
const CLAIRE_SCRAPE = {
  name: "ABAN, CLAIRE U.",
  thirteenthMonthCutoff: 650,
  thirteenthMonthYTD: 12200,
  silCutoff: 124.6,
};

function nabatiClaireLine() {
  return {
    last_name: "Aban",
    first_name: "Claire",
    daily_rate: 600,
    gross_pay: 11940.11,
    total_deductions: 1460.92,
    net_pay: 10479.19,
    hours: { actual_regular_hours: 104, pto_hours: 0 },
    earnings: { basic: 7800, days_work: 13, allowance: 2600 },
    deductions: { sss: 425, pagibig: 140, loans: 0 },
  };
}

describe("silCutoffAccrual", () => {
  it("matches MAIN silp for Claire (days/313 × 5 × daily rate)", () => {
    assert.equal(silCutoffAccrual(13, 600), 124.6);
    assert.equal(silCutoffAccrual(0, 600), 0);
    assert.equal(silCutoffAccrual(13, 0), 0);
  });
});

describe("overlayMainAccruals", () => {
  it("keeps January YTD from the MAIN scrape and adds this cutoff when GP is later", () => {
    const overlay = overlayMainAccruals({
      basicPay: 7800,
      daysWorked: 13,
      dailyRate: 600,
      registerPeriodEnd: "2026-09-30",
      scrapePeriodEnd: "2026-08-31",
      scraped: CLAIRE_SCRAPE,
      laterCutoffBasics: [],
    });
    assert.equal(overlay.thirteenthMonthCutoff, 650);
    assert.equal(overlay.silCutoff, 124.6);
    assert.equal(overlay.thirteenthMonthYTD, 12850);
  });

  it("adds intervening posted kinsenas between the scrape and this cutoff", () => {
    const overlay = overlayMainAccruals({
      basicPay: 7800,
      daysWorked: 13,
      dailyRate: 600,
      registerPeriodEnd: "2026-09-30",
      scrapePeriodEnd: "2026-08-31",
      scraped: CLAIRE_SCRAPE,
      laterCutoffBasics: [7800],
    });
    assert.equal(overlay.thirteenthMonthYTD, 13500);
  });

  it("does not double-count YTD when the scrape is this same cutoff", () => {
    const overlay = overlayMainAccruals({
      basicPay: 7800,
      daysWorked: 13,
      dailyRate: 600,
      registerPeriodEnd: "2026-08-31",
      scrapePeriodEnd: "2026-08-31",
      scraped: CLAIRE_SCRAPE,
      laterCutoffBasics: [],
    });
    assert.equal(overlay.thirteenthMonthCutoff, 650);
    assert.equal(overlay.thirteenthMonthYTD, 12200);
  });

  it("accrues this cutoff only when nobody matched the scrape", () => {
    const overlay = overlayMainAccruals({
      basicPay: 7800,
      daysWorked: 13,
      dailyRate: 600,
      registerPeriodEnd: "2026-09-30",
      scrapePeriodEnd: "2026-08-31",
      scraped: null,
      laterCutoffBasics: [],
    });
    assert.equal(overlay.thirteenthMonthCutoff, 650);
    assert.equal(overlay.silCutoff, 124.6);
    assert.equal(overlay.thirteenthMonthYTD, 650);
  });
});

describe("matchScrapedAccrual", () => {
  it("matches Aban, Claire to ABAN, CLAIRE U.", () => {
    const hit = matchScrapedAccrual("Aban, Claire", [CLAIRE_SCRAPE]);
    assert.equal(hit?.thirteenthMonthYTD, 12200);
  });

  it("returns null for a different person", () => {
    assert.equal(matchScrapedAccrual("Perez, Christian", [CLAIRE_SCRAPE]), null);
  });
});

describe("organicRegisterLineToAuditRow accruals", () => {
  it("stamps this cutoff only when there is no MAIN scrape", () => {
    const row = organicRegisterLineToAuditRow(nabatiClaireLine());
    assert.equal(row.thirteenthMonthCutoff, 650);
    assert.equal(row.silCutoff, 124.6);
    assert.equal(row.thirteenthMonthYTD, 650);
  });

  it("stamps Claire's MAIN YTD plus this cutoff onto the summary row", () => {
    const row = organicRegisterLineToAuditRow(nabatiClaireLine(), {
      scrapePeriodEnd: "2026-08-31",
      registerPeriodEnd: "2026-09-30",
      scraped: CLAIRE_SCRAPE,
      laterCutoffBasics: [],
    });
    assert.equal(row.thirteenthMonthCutoff, 650);
    assert.equal(row.silCutoff, 124.6);
    assert.equal(row.thirteenthMonthYTD, 12850);
  });
});

describe("buildOrganicRegisterSummaryTable accruals", () => {
  it("prints 13th / SIL / YTD totals from the MAIN scrape overlay", () => {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [nabatiClaireLine()],
      mainScrape: {
        periodEnd: "2026-08-31",
        employees: [CLAIRE_SCRAPE],
      },
    });
    const i13 = PAYROLL_REGISTER_HEADERS.indexOf("13th Month Cutoff");
    const iSil = PAYROLL_REGISTER_HEADERS.indexOf("SIL Cutoff");
    const iYtd = PAYROLL_REGISTER_HEADERS.indexOf("13th Month YTD");
    assert.equal(table.rows[0][i13], 650);
    assert.equal(table.rows[0][iSil], 124.6);
    assert.equal(table.rows[0][iYtd], 12850);
    assert.equal(table.totalsRow[i13], 650);
    assert.equal(table.totalsRow[iYtd], 12850);
  });

  it("leaves unmatched people on this cutoff only and still stamps the match", () => {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [
        nabatiClaireLine(),
        {
          last_name: "Perez",
          first_name: "Christian",
          daily_rate: 600,
          hours: { actual_regular_hours: 104 },
          earnings: { basic: 7800, days_work: 13 },
        },
      ],
      mainScrape: {
        periodEnd: "2026-08-31",
        employees: [CLAIRE_SCRAPE],
      },
    });
    const iYtd = PAYROLL_REGISTER_HEADERS.indexOf("13th Month YTD");
    assert.equal(table.rows[0][iYtd], 12850);
    assert.equal(table.rows[1][iYtd], 650);
    assert.equal(table.totalsRow[iYtd], 13500);
  });

  it("adds intervening posted basics between the scrape and this cutoff", () => {
    const table = buildOrganicRegisterSummaryTable({
      periodStart: "2026-09-16",
      periodEnd: "2026-09-30",
      lines: [nabatiClaireLine()],
      mainScrape: {
        periodEnd: "2026-08-31",
        employees: [CLAIRE_SCRAPE],
      },
      laterPostedBasics: [{ name: "ABAN, CLAIRE U.", basicPay: 7800 }],
    });
    const iYtd = PAYROLL_REGISTER_HEADERS.indexOf("13th Month YTD");
    assert.equal(table.rows[0][iYtd], 13500);
  });
});

describe("siteMatchesAuditCompany", () => {
  it("matches Nabati Batangas to the MAIN EDD Batangas company", () => {
    assert.equal(
      siteMatchesAuditCompany(
        "Nabati Food Philippines Inc.",
        "Batangas",
        "NABATI FOOD PHILIPPINES INC. EDD BATANGAS"
      ),
      true
    );
    assert.equal(
      siteMatchesAuditCompany(
        "Nabati Food Philippines Inc.",
        "Batangas",
        "NABATI FOOD PHILIPPINES INC. EDD LAS PINAS"
      ),
      false
    );
    assert.equal(
      siteMatchesAuditCompany(
        "Nabati Food Philippines Inc.",
        null,
        "NABATI FOOD PHILIPPINES INC. EDD BATANGAS"
      ),
      false
    );
  });
});

describe("selectLatestMainScrape", () => {
  it("picks the latest ready upload on or before this cutoff", () => {
    const uploads = [
      {
        companyName: "NABATI FOOD PHILIPPINES INC. EDD BATANGAS",
        periodEnd: "2026-06-15",
        employees: [CLAIRE_SCRAPE],
      },
      {
        companyName: "NABATI FOOD PHILIPPINES INC. EDD BATANGAS",
        periodEnd: "2026-08-31",
        employees: [{ ...CLAIRE_SCRAPE, thirteenthMonthYTD: 12200 }],
      },
      {
        companyName: "NABATI FOOD PHILIPPINES INC. EDD LAS PINAS",
        periodEnd: "2026-08-31",
        employees: [{ ...CLAIRE_SCRAPE, thirteenthMonthYTD: 99999 }],
      },
    ];
    const hit = selectLatestMainScrape(uploads, {
      clientName: "Nabati Food Philippines Inc.",
      branchName: "Batangas",
      onOrBefore: "2026-09-30",
    });
    assert.equal(hit?.periodEnd, "2026-08-31");
    assert.equal(hit?.employees[0]?.thirteenthMonthYTD, 12200);
  });

  it("returns null when no ready upload matches the site", () => {
    assert.equal(
      selectLatestMainScrape(
        [
          {
            companyName: "CHICHA HUT",
            periodEnd: "2026-08-31",
            employees: [CLAIRE_SCRAPE],
          },
        ],
        {
          clientName: "Nabati Food Philippines Inc.",
          branchName: "Batangas",
          onOrBefore: "2026-09-30",
        }
      ),
      null
    );
  });
});

describe("scrapedAccrualsFromParsedEmployees", () => {
  it("reads 13th / SIL / YTD off parsed MAIN employees", () => {
    const [row] = scrapedAccrualsFromParsedEmployees([
      {
        name: "ABAN, CLAIRE U.",
        thirteenthMonthCutoff: 650,
        thirteenthMonthYTD: 12200,
        silCutoff: 124.6,
      },
    ]);
    assert.deepEqual(row, CLAIRE_SCRAPE);
  });
});

describe("thirteenthMonthAccrual claire", () => {
  it("is 650 on 7800 basic", () => {
    assert.equal(thirteenthMonthAccrual(7800), 650);
  });
});
