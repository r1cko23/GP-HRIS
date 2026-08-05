import { describe, expect, it } from "vitest";
import { extractCompanyName } from "@/lib/payroll-summary/parse-payroll-register-pdf";
import {
  clientNameFromPayrollSummaryFileName,
  clientNameFromRelativePath,
  isPlausibleCompanyName,
  resolveAuditClientName,
} from "@/lib/payroll-summary/resolve-audit-client-name";

describe("extractCompanyName", () => {
  it("reads GP-HRIS Client Name including site (EDD BATANGAS)", () => {
    const text = `
GREEN PASTURE PEOPLE MANAGEMENT INC.
Payroll Register
Client Name: NABATI FOOD PHILIPPINES INC. EDD BATANGAS
Cutoff: 06/01/2026 to 06/15/2026
Payout Date: 6/20/2026
Daily Rate Hours Days
`;
    expect(extractCompanyName(text)).toBe(
      "NABATI FOOD PHILIPPINES INC. EDD BATANGAS"
    );
  });

  it("keeps Bicol site distinct from Batangas", () => {
    const text = `
Client Name: NABATI FOOD PHILIPPINES INC. EDD BICOL
Cutoff: 06/01/2026 to 06/15/2026
`;
    expect(extractCompanyName(text)).toBe(
      "NABATI FOOD PHILIPPINES INC. EDD BICOL"
    );
  });

  it("ignores an employee row printed above Prepared By", () => {
    const text = `
CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC Converge
Cuttoff: 06/01/2026  6/20/2026
139. YEPES, ERIC M. 695.00 96.00 12.00 8,340.00 8,340.00 4.00 434.38
Prepared By: Approved By:
Salaries and Wages: 1,945,409.21
`;
    expect(extractCompanyName(text)).toBe(
      "CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC"
    );
  });

  it("reads a company header whose legal suffix has no period", () => {
    const text = `
SAMPLE VENUE HOLDINGS INC Payroll
Cuttoff: 06/01/2026  6/20/2026
1. DELA CRUZ, JUAN A. 695.00 96.00 12.00 8,340.00 8,340.00
Prepared By:
`;
    expect(extractCompanyName(text)).toBe("SAMPLE VENUE HOLDINGS INC");
  });

  it("strips trailing PDF artifact letter after Client Name", () => {
    const text = `
Client Name: NABATI FOOD PHILIPPINES INC. EDD BATANGAS W
Cutoff: 06/01/2026 to 06/15/2026
`;
    expect(extractCompanyName(text)).toBe(
      "NABATI FOOD PHILIPPINES INC. EDD BATANGAS"
    );
  });
});

describe("resolveAuditClientName", () => {
  it("prefers full PDF Client Name with site over filename", () => {
    expect(
      resolveAuditClientName({
        fileName: "Payrollsummary_BATANGAS.pdf",
        pdfCompanyName: "NABATI FOOD PHILIPPINES INC. EDD BATANGAS",
      })
    ).toBe("NABATI FOOD PHILIPPINES INC. EDD BATANGAS");
  });

  it("appends filename site when PDF is parent INC only", () => {
    expect(
      resolveAuditClientName({
        fileName: "Payrollsummary_BATANGAS.pdf",
        pdfCompanyName: "NABATI FOOD PHILIPPINES INC.",
      })
    ).toBe("NABATI FOOD PHILIPPINES INC. BATANGAS");

    expect(
      resolveAuditClientName({
        fileName: "Payrollsummary_BICOL.pdf",
        pdfCompanyName: "NABATI FOOD PHILIPPINES INC.",
      })
    ).toBe("NABATI FOOD PHILIPPINES INC. BICOL");
  });

  it("does not append NIKKEI brand onto a distinct venue legal entity", () => {
    expect(
      resolveAuditClientName({
        fileName: "PAYROLL SUMMARY_NIKKEI (2).pdf",
        pdfCompanyName: "TERRAZA EDSA SHANG INC.",
      })
    ).toBe("TERRAZA EDSA SHANG INC.");
  });

  it("rejects employee-row garbage as company name", () => {
    expect(
      isPlausibleCompanyName(
        "72. YEPES, JHED ANDREI J. 695.00 72.00 9.00 6,255.00"
      )
    ).toBe(false);
  });

  it("falls back to filename token and strips Windows copy suffix", () => {
    expect(
      clientNameFromPayrollSummaryFileName("PAYROLL SUMMARY_NIKKEI (5).pdf")
    ).toBe("NIKKEI");
    expect(
      resolveAuditClientName({
        fileName: "PAYROLL SUMMARY_NIKKEI (3).pdf",
        pdfCompanyName: null,
      })
    ).toBe("NIKKEI");
  });

  it("uses branch folder from relative path before filename", () => {
    expect(
      clientNameFromRelativePath(
        "NIKKEI JULY 16-24, 2026/TERRAZA EDSA SHANG INC/PAYROLL SUMMARY_NIKKEI.pdf"
      )
    ).toBe("TERRAZA EDSA SHANG INC");

    expect(
      resolveAuditClientName({
        fileName: "PAYROLL SUMMARY_NIKKEI.pdf",
        relativePath:
          "NIKKEI JULY 16-24, 2026/TERRAZA EDSA SHANG INC/PAYROLL SUMMARY_NIKKEI.pdf",
        pdfCompanyName: null,
      })
    ).toBe("TERRAZA EDSA SHANG INC");
  });

  it("strips period phrases from filename tokens", () => {
    expect(
      clientNameFromPayrollSummaryFileName(
        "Payroll Summary_VIVENTIS JULY 16-24, 2026.pdf"
      )
    ).toBe("VIVENTIS");
  });
});
