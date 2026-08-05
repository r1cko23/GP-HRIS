import { format, parse } from "date-fns";
import type { PayrollRegisterRow } from "./register-columns";
import {
  emptyRegisterRow,
  parseRegisterRow,
  pickRegisterTotals,
  resolveExternalRegisterLayout,
  resolveGpHrisLayout,
  type RegisterLayoutMap,
} from "./register-columns";
import type { PdfTextSource } from "./extract-pdf-text";
import type { PayrollSummaryMetrics } from "./types";

/** Employee name token (supports Ñ and other Latin letters). */
const NAME_PART = `[\\p{L}\\p{M}][\\p{L}\\p{M}\\s,.'\\-]*`;

export function parseMoney(value: string): number {
  const cleaned = value.replace(/,/g, "").trim();
  if (!cleaned || cleaned === "-" || cleaned === "—") return 0;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) ? num : 0;
}

export function parseNumericTokens(line: string): number[] {
  const tokens = line.match(/-?\d[\d,]*\.?\d*|-/g) ?? [];
  return tokens.map((token) => (token === "-" ? 0 : parseMoney(token)));
}

function toIsoDate(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function parseSlashDate(value: string): string | null {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseLongDate(value: string): string | null {
  try {
    const parsed = parse(value.trim(), "MMMM d, yyyy", new Date());
    if (Number.isNaN(parsed.getTime())) return null;
    return toIsoDate(parsed);
  } catch {
    return null;
  }
}

/**
 * Converge / Mike Razal registers print `Cuttoff: <start> <payout>` with no
 * "to" and no period-end date. Infer end from the usual bi-monthly windows:
 * 1–15 → 15th; 16–EOM → last day of that month.
 */
export function inferBiMonthlyPeriodEnd(periodStartIso: string): string | null {
  const match = periodStartIso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || !month || !day) return null;

  if (day <= 15) {
    return `${year}-${String(month).padStart(2, "0")}-15`;
  }

  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

export function extractPeriod(text: string): {
  periodStart: string;
  periodEnd: string;
} | null {
  const cutoffTypo = text.match(
    /Cutt?off:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (cutoffTypo) {
    const start = parseSlashDate(cutoffTypo[1]);
    const end = parseSlashDate(cutoffTypo[2]);
    if (start && end) return { periodStart: start, periodEnd: end };
  }

  const slashRange = text.match(
    /(\d{1,2}\/\d{1,2}\/\d{4})\s+to\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (slashRange) {
    const start = parseSlashDate(slashRange[1]);
    const end = parseSlashDate(slashRange[2]);
    if (start && end) return { periodStart: start, periodEnd: end };
  }

  const cutoffRange = text.match(
    /Cutoff:\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})\s*-\s*([A-Za-z]+\s+\d{1,2},\s*\d{4})/i
  );
  if (cutoffRange) {
    const start = parseLongDate(cutoffRange[1]);
    const end = parseLongDate(cutoffRange[2]);
    if (start && end) return { periodStart: start, periodEnd: end };
  }

  // Converge: "Cuttoff: 12/16/2025  1/5/2026" (start + payout, no "to")
  const cuttoffStartPayout = text.match(
    /Cutt?off:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (cuttoffStartPayout) {
    const start = parseSlashDate(cuttoffStartPayout[1]);
    if (start) {
      const end = inferBiMonthlyPeriodEnd(start);
      if (end) return { periodStart: start, periodEnd: end };
    }
  }

  return null;
}

export function extractCompanyName(text: string): string | null {
  // GP-HRIS Payroll Register header: "Client Name: NABATI … EDD BATANGAS"
  const clientLabeled =
    text.match(/Client\s*Name\s*:\s*([^\n\r]{3,160})/i) ??
    text.match(/Client\s*Name\s*:\s*\n\s*([^\n\r]{3,160})/i);
  if (clientLabeled) {
    const cleaned = clientLabeled[1]
      .replace(/\s*System\.Data\.DataRowView\s*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (cleaned.length >= 3 && !/^Cutoff|^Payout|^Report/i.test(cleaned)) {
      return cleaned;
    }
  }

  const beforePrepared = text.match(
    /\n([A-Z0-9][^\n]{4,160})\s*\nPrepared By:/i
  );
  if (beforePrepared) {
    const cleaned = beforePrepared[1]
      .replace(/\s*System\.Data\.DataRowView\s*$/i, "")
      .trim();
    if (cleaned.length >= 4) return cleaned;
  }

  // Legal entity + optional site suffix (do not stop at INC. alone)
  const lineMatch = text.match(
    /^([A-Z0-9][A-Z0-9\s&.,'-]+(?:CORP\.|INC\.|CO\.)(?:\s+[A-Z0-9][A-Z0-9\s&.,'/Ññ-]{0,80})?)/m
  );
  if (lineMatch) {
    const cleaned = lineMatch[1]
      .replace(/\s+(?:Payroll\s+Register|Daily\s+Rate|Cutoff|Cuttoff).*$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (cleaned.length >= 4) return cleaned;
  }

  const inlineMatch = text.match(
    /\b(CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC\.?)/i
  );
  if (inlineMatch) return inlineMatch[1].trim();

  const genericMatch = text.match(
    /([A-Z0-9][A-Z0-9\s&.,'-]+(?:CORP\.|INC\.|CO\.)(?:\s+[A-Z0-9][A-Z0-9\s&.,'/Ññ-]{0,80})?)\s*(?:Payroll Register)/i
  );
  return genericMatch
    ? genericMatch[1].replace(/\s{2,}/g, " ").trim()
    : null;
}

function extractPayoutDate(text: string): string | null {
  const labeled = text.match(/Payout Date:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (labeled) return parseSlashDate(labeled[1]);

  const afterPeriod = text.match(
    /\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}\s*\n\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (afterPeriod) return parseSlashDate(afterPeriod[1]);

  // Converge: second date after Cuttoff is the payout date
  const cuttoffStartPayout = text.match(
    /Cutt?off:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (cuttoffStartPayout) return parseSlashDate(cuttoffStartPayout[2]);

  return null;
}

/** Mike Razal PDFs sometimes put "Total" on its own line before the numeric row. */
function collapseSplitTotalLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === "Total" && i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (/^Total\s+[\d,]/.test(next)) {
        merged.push(next);
        i += 1;
        continue;
      }
      if (/^[\d,]/.test(next)) {
        merged.push(`Total ${next}`);
        i += 1;
        continue;
      }
    }
    merged.push(lines[i]);
  }

  return merged.join("\n");
}

function findTotalsLine(text: string): {
  line: string;
  format: "gp_hris" | "external_register";
} | null {
  const normalizedText = collapseSplitTotalLines(text);

  const gpMatch = normalizedText.match(/^TOTAL\s+(.+)$/m);
  if (gpMatch) {
    return { line: gpMatch[0], format: "gp_hris" };
  }

  let best: { line: string; tokenCount: number } | null = null;
  for (const rawLine of normalizedText.split(/\r?\n/)) {
    const line = rawLine.trim();
    // Prefer a line that starts with Total; also accept mid-line Total when
    // Converge headers share the totals row (e.g. "Gross Amt Total 1,234...").
    const totalAt = line.search(/\bTotal\s+(?=[\d,.\-])/i);
    if (totalAt < 0) continue;
    const fromTotal = line.slice(totalAt);
    const afterTotal = fromTotal.replace(/^Total\s+/i, "").trim();
    if (!/^[\d,\.\-]/.test(afterTotal)) continue;
    const tokenCount = parseNumericTokens(afterTotal).length;
    if (tokenCount < 12) continue;
    const startsWithTotal = totalAt === 0;
    const score = tokenCount + (startsWithTotal ? 1000 : 0);
    const bestScore = best
      ? best.tokenCount + (/^Total\s/i.test(best.line) ? 1000 : 0)
      : -1;
    if (!best || score > bestScore) {
      best = { line: fromTotal, tokenCount };
    }
  }
  if (best) {
    return { line: best.line, format: "external_register" };
  }

  return null;
}

function cleanGpNamePart(value: string): string {
  return value
    .replace(/\s*-\.\s*$/u, "")
    .replace(/\s+-\s*$/u, "")
    .replace(/\s*\.\s*$/u, "")
    .trim();
}

function normalizeEmployeeNumericTokens(nums: number[]): number[] {
  if (nums.length >= 29 && nums[0] === 0) {
    return nums.slice(1);
  }
  return nums;
}

function normalizeEmployeeLines(text: string): string {
  const lines = text.split(/\r?\n/);
  const merged: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const employeeStart = line.match(
      new RegExp(`^(\\d+\\.\\s+${NAME_PART})\\s+([\\d,\\.\\-\\s]+)$`, "u")
    );
    if (employeeStart) {
      merged.push(line);
      continue;
    }

    const partialName = line.match(
      new RegExp(`^(\\d+\\.\\s+${NAME_PART})$`, "u")
    );
    if (partialName && i + 1 < lines.length) {
      const next = lines[i + 1];
      const nameOnlyNext = next.trim().match(
        new RegExp(`^${NAME_PART}$`, "u")
      );
      if (nameOnlyNext && i + 2 < lines.length) {
        const numbers = lines[i + 2].trim();
        if (numbers.match(/^[\d,\.\-\s]+$/)) {
          merged.push(
            `${partialName[1]} ${cleanGpNamePart(nameOnlyNext[0].trim())} ${numbers}`
          );
          i += 2;
          continue;
        }
      }
      const continuation = next.match(
        new RegExp(`^(${NAME_PART})\\.\\s*$`, "u")
      );
      const nameContinuation = next.match(
        new RegExp(`^${NAME_PART}$`, "u")
      );
      const numericNext = next.match(/^([\d,\.\-\s]+)$/);
      if (continuation && i + 2 < lines.length) {
        const numbers = lines[i + 2];
        if (numbers.match(/^[\d,\.\-\s]+$/)) {
          merged.push(
            `${partialName[1]} ${continuation[1]}. ${numbers.trim()}`
          );
          i += 2;
          continue;
        }
      }
      if (nameContinuation && i + 2 < lines.length) {
        const numbers = lines[i + 2];
        if (numbers.match(/^[\d,\.\-\s]+$/)) {
          merged.push(
            `${partialName[1]} ${cleanGpNamePart(nameContinuation[0].trim())} ${numbers.trim()}`
          );
          i += 2;
          continue;
        }
      }
      if (numericNext) {
        merged.push(`${partialName[1]} ${numericNext[1].trim()}`);
        i += 1;
        continue;
      }
    }

    merged.push(line);
  }

  return merged.join("\n");
}

function parseEmployeeRows(
  text: string,
  format: "gp_hris" | "external_register",
  documentLayout?: RegisterLayoutMap | null
): PayrollRegisterRow[] {
  const normalized = normalizeEmployeeLines(text);
  const rows: PayrollRegisterRow[] = [];

  if (format === "external_register") {
    const pattern = new RegExp(
      `^(\\d+\\.\\s+${NAME_PART}?)\\s+([\\d,\\.\\-\\s]+)$`,
      "gmu"
    );
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(normalized)) !== null) {
      const name = match[1]
        .replace(/^\d+\.\s+/, "")
        .replace(/\s+/g, " ")
        .trim();
      let nums = parseNumericTokens(match[2]);
      nums = normalizeEmployeeNumericTokens(nums);
      const layout =
        documentLayout && nums.length >= documentLayout.minColumns
          ? documentLayout
          : (resolveExternalRegisterLayout(nums.length, text, nums, {
              isTotalRow: false,
            }) ?? null);
      if (!layout) continue;
      const row = parseRegisterRow(name, nums, layout);
      if (row) rows.push(row);
    }
    return rows;
  }

  const gpPattern = new RegExp(
    `^(${NAME_PART}?)\\s+([\\d,\\.\\-\\s]+)$`,
    "gmu"
  );
  let gpMatch: RegExpExecArray | null;
  while ((gpMatch = gpPattern.exec(normalized)) !== null) {
    const label = gpMatch[1].trim();
    if (
      label === "TOTAL" ||
      label.startsWith("Employee") ||
      label.includes("Payroll Register")
    ) {
      continue;
    }
    const nums = parseNumericTokens(gpMatch[2]);
    const layout = resolveGpHrisLayout(nums.length);
    if (!layout) continue;
    const row = parseRegisterRow(label, nums, layout);
    if (row) rows.push(row);
  }

  return rows;
}

function extractFooterGross(text: string): number | null {
  const match = text.match(/Salaries and Wages:\s*([\d,]+\.?\d*)/i);
  return match ? parseMoney(match[1]) : null;
}

function extractFooterSilCutoff(text: string): number | null {
  const match = text.match(
    /ACCRUALS\s+SIL\s*\n?\s*Cutt?\s*off:\s*([\d,]+\.?\d*)/i
  );
  return match ? parseMoney(match[1]) : null;
}

function extractFooterNet(text: string): number | null {
  const silCutoff = extractFooterSilCutoff(text);
  if (!silCutoff) return null;

  const silFormatted = silCutoff.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const pattern = new RegExp(
    `[\\d,]+\\.\\d{2}\\s+([\\d,]+\\.\\d{2})\\s+[\\d,]+\\.\\d{2}\\s+${silFormatted.replace(".", "\\.")}`
  );
  const match = text.match(pattern);
  return match ? parseMoney(match[1]) : null;
}

function applyExternalFooterTotals(
  text: string,
  totals: ReturnType<typeof pickRegisterTotals>
) {
  const footerGross = extractFooterGross(text);
  if (footerGross != null && footerGross > 0) {
    const drift = Math.abs(footerGross - totals.grossAmountTotal);
    if (
      !totals.grossAmountTotal ||
      drift > Math.max(1000, footerGross * 0.05)
    ) {
      totals.grossAmountTotal = footerGross;
    }
  }
  if (!totals.netAmountTotal) {
    totals.netAmountTotal = extractFooterNet(text) ?? 0;
  }
  if (!totals.silCutoffTotal) {
    totals.silCutoffTotal = extractFooterSilCutoff(text) ?? 0;
  }
  return totals;
}

/**
 * Parse extracted PDF text into structured payroll summary metrics.
 */
function isRecoverableExtractionParseError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Could not find totals row|Could not detect cutoff period|Unexpected .* column count/i.test(
    message
  );
}

export function parsePayrollRegisterText(
  text: string
): PayrollSummaryMetrics {
  const collapsedText = collapseSplitTotalLines(text.replace(/\t/g, " "));
  const period = extractPeriod(collapsedText);
  if (!period) {
    throw new Error(
      "Could not detect cutoff period in PDF. Expected a date range like 05/01/2026 to 05/15/2026."
    );
  }

  const totalsLine = findTotalsLine(collapsedText);
  if (!totalsLine) {
    throw new Error(
      "Could not find totals row in PDF. Expected a line starting with Total or TOTAL."
    );
  }

  const nums = parseNumericTokens(
    totalsLine.line.replace(/^TOTAL\s+/i, "").replace(/^Total\s+/i, "")
  );

  const format = totalsLine.format;

  let documentLayout: RegisterLayoutMap | null = null;
  if (format === "external_register") {
    documentLayout = resolveExternalRegisterLayout(
      nums.length,
      collapsedText,
      nums,
      { isTotalRow: true }
    );
    if (!documentLayout) {
      throw new Error(
        `Unexpected external register column count (${nums.length}). Expected 12–28 numeric fields for Payroll Summary layouts.`
      );
    }
  }

  const employees = parseEmployeeRows(collapsedText, format, documentLayout);
  const employeeCount = employees.length;

  let totalsRow: PayrollRegisterRow | null = null;

  if (format === "external_register") {
    totalsRow = parseRegisterRow("TOTAL", nums, documentLayout!);
  } else {
    const layout = resolveGpHrisLayout(nums.length);
    if (!layout) {
      throw new Error(
        `Unexpected GP-HRIS register column count (${nums.length}). Expected 33 or 34 numeric fields.`
      );
    }
    totalsRow = parseRegisterRow("TOTAL", nums, layout);
  }

  const picked = pickRegisterTotals(totalsRow ?? emptyRegisterRow("TOTAL"));
  const totals =
    format === "external_register"
      ? applyExternalFooterTotals(collapsedText, picked)
      : picked;

  return {
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    employeeCount,
    hoursWorkedTotal: totals.hoursWorkedTotal,
    regOTHoursTotal: totals.regOTHoursTotal,
    silTotal: totals.silTotal,
    silCutoffTotal: totals.silCutoffTotal,
    grossAmountTotal: totals.grossAmountTotal,
    netAmountTotal: totals.netAmountTotal,
    totalOTAmount: totals.totalOTAmount,
    companyName: extractCompanyName(collapsedText),
    payoutDate: extractPayoutDate(collapsedText),
    sourceFormat: format,
    employees,
  };
}

export interface PayrollRegisterParseResult {
  metrics: PayrollSummaryMetrics;
  pdfText: string;
  pdfTextSource: import("./extract-pdf-text").PdfTextSource;
  nativeScore: number;
  ocrScore: number | null;
  ocrConfigured: boolean;
}

export async function parsePayrollRegisterPdfResult(
  buffer: Buffer
): Promise<PayrollRegisterParseResult> {
  const { extractPdfTextResult } = await import("./extract-pdf-text");
  const { isOcrSpaceConfigured } = await import("./ocr-space");
  const extraction = await extractPdfTextResult(buffer);
  const { nativeScore, ocrScore, nativeText, ocrText } = extraction;

  const candidates: Array<{ text: string; source: PdfTextSource }> = [
    { text: extraction.text, source: extraction.source },
  ];
  const alternate =
    extraction.source === "ocr-space"
      ? { text: nativeText, source: "pdf-parse" as const }
      : ocrText != null
        ? { text: ocrText, source: "ocr-space" as const }
        : null;
  if (alternate && alternate.text.trim() !== extraction.text.trim()) {
    candidates.push(alternate);
  }

  let metrics: PayrollSummaryMetrics | null = null;
  let pdfTextSource = extraction.source;
  let pdfText = extraction.text;
  let lastError: unknown = null;

  for (const candidate of candidates) {
    try {
      metrics = parsePayrollRegisterText(candidate.text);
      pdfTextSource = candidate.source;
      pdfText = candidate.text;
      if (
        candidate.source !== extraction.source &&
        process.env.NODE_ENV !== "production"
      ) {
        console.warn(
          `[payroll-summary] parse via ${extraction.source} failed; used ${candidate.source} fallback`
        );
      }
      break;
    } catch (error) {
      lastError = error;
      if (!isRecoverableExtractionParseError(error)) {
        throw error;
      }
    }
  }

  if (!metrics) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to parse payroll register PDF");
  }

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[payroll-summary] PDF text via ${pdfTextSource} (native score ${nativeScore}` +
        (ocrScore != null ? `, OCR score ${ocrScore}` : "") +
        ")"
    );
  }

  return {
    metrics,
    pdfText,
    pdfTextSource,
    nativeScore,
    ocrScore,
    ocrConfigured: isOcrSpaceConfigured(),
  };
}

export async function parsePayrollRegisterPdf(
  buffer: Buffer
): Promise<PayrollSummaryMetrics> {
  const { metrics } = await parsePayrollRegisterPdfResult(buffer);
  return metrics;
}
