import { describe, expect, it } from "vitest";
import {
  clientNameFromPayrollSummaryFileName,
  clientNameFromRelativePath,
  isPlausibleCompanyName,
  resolveAuditClientName,
} from "@/lib/payroll-summary/resolve-audit-client-name";

describe("resolveAuditClientName", () => {
  it("prefers PDF company name when plausible", () => {
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
