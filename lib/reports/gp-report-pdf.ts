/**
 * Shared Green Pasture print chrome for Finance PDFs.
 * Landscape A4, centered logo, company name — matches /reports/register.
 */

import fs from "fs";
import path from "path";
import jsPDF from "jspdf";

export const GP_REPORT_GREEN: [number, number, number] = [46, 125, 50];
export const GP_COMPANY_NAME = "Green Pasture People Management Inc.";

const LOGO_ASPECT = 185 / 500;
let cachedLogoDataUrl: string | null | undefined;

export function loadGpLogoDataUrl(): string | null {
  if (cachedLogoDataUrl !== undefined) return cachedLogoDataUrl;
  try {
    const logoPath = path.join(process.cwd(), "public", "gp-logo.webp");
    const bytes = fs.readFileSync(logoPath);
    cachedLogoDataUrl = `data:image/webp;base64,${bytes.toString("base64")}`;
    return cachedLogoDataUrl;
  } catch {
    cachedLogoDataUrl = null;
    return null;
  }
}

/** Test seam — reset memoized logo between cases. */
export function resetGpLogoCacheForTests(): void {
  cachedLogoDataUrl = undefined;
}

export type GpReportChrome = {
  doc: jsPDF;
  pageWidth: number;
  pageHeight: number;
  margin: number;
  /** Y below the title block where body content may start. */
  contentTop: number;
};

export function createGpLandscapeReport(input: {
  title: string;
  subtitle?: string;
  /** mm from left/right. Default 14. */
  margin?: number;
  format?: "a4" | "legal";
}): GpReportChrome {
  const margin = input.margin ?? 14;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: input.format ?? "a4",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = 12;

  const logo = loadGpLogoDataUrl();
  if (logo) {
    const logoWidth = 52;
    const logoHeight = logoWidth * LOGO_ASPECT;
    const logoX = (pageWidth - logoWidth) / 2;
    try {
      doc.addImage(logo, "WEBP", logoX, y, logoWidth, logoHeight);
      y += logoHeight + 6;
    } catch {
      // Continue without logo if the runtime cannot decode WEBP.
    }
  }

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(GP_COMPANY_NAME, pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFontSize(12);
  doc.text(input.title, pageWidth / 2, y, { align: "center" });
  y += 6;

  if (input.subtitle?.trim()) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(input.subtitle.trim(), pageWidth / 2, y, { align: "center" });
    y += 6;
  }

  return {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentTop: y + 2,
  };
}

export function stampGpReportFooter(doc: jsPDF, margin = 14): void {
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i += 1) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Confidential · ${GP_COMPANY_NAME} · page ${i} of ${pages}`,
      margin,
      doc.internal.pageSize.getHeight() - 8
    );
  }
}
