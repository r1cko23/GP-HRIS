import { format, parse } from "date-fns";
import type { PayrollRegisterRow } from "./register-columns";
import {
  emptyRegisterRow,
  mergeConverge28Layout,
  parseRegisterRow,
  pickRegisterTotals,
  EXTERNAL_EARNINGS_28_LAYOUT,
  resolveExternalRegisterLayout,
  resolveGpHrisLayout,
} from "./register-columns";
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

export function extractPeriod(text: string): {
  periodStart: string;
  periodEnd: string;
} | null {
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

  return null;
}

function extractCompanyName(text: string): string | null {
  const lineMatch = text.match(
    /^([A-Z0-9][A-Z0-9\s&.,'-]+(?:CORP\.|INC\.|CO\.))\s/m
  );
  if (lineMatch) return lineMatch[1].trim();

  const inlineMatch = text.match(
    /\b(CONVERGE INFO AND COMMUNICATIONS TECH SOLUTIONS INC\.?)/i
  );
  if (inlineMatch) return inlineMatch[1].trim();

  const genericMatch = text.match(
    /([A-Z0-9][A-Z0-9\s&.,'-]+(?:CORP\.|INC\.|CO\.))\s*(?:Payroll Register)/i
  );
  return genericMatch ? genericMatch[1].trim() : null;
}

function extractPayoutDate(text: string): string | null {
  const labeled = text.match(/Payout Date:\s*\n?\s*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (labeled) return parseSlashDate(labeled[1]);

  const afterPeriod = text.match(
    /\d{1,2}\/\d{1,2}\/\d{4}\s+to\s+\d{1,2}\/\d{1,2}\/\d{4}\s*\n\s*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (afterPeriod) return parseSlashDate(afterPeriod[1]);

  return null;
}

function findTotalsLine(text: string): {
  line: string;
  format: "gp_hris" | "external_register";
} | null {
  const gpMatch = text.match(/^TOTAL\s+(.+)$/m);
  if (gpMatch) {
    return { line: gpMatch[0], format: "gp_hris" };
  }

  const externalMatch = text.match(/^Total\s+([\d,\.\-\s]+)$/m);
  if (externalMatch) {
    return { line: externalMatch[0], format: "external_register" };
  }

  return null;
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
            `${partialName[1]} ${nameContinuation[0].trim()} ${numbers.trim()}`
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
  format: "gp_hris" | "external_register"
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
      const nums = parseNumericTokens(match[2]);
      const layout =
        nums.length >= EXTERNAL_EARNINGS_28_LAYOUT.minColumns
          ? mergeConverge28Layout(nums, false)
          : resolveExternalRegisterLayout(nums.length, text, nums);
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
  if (!totals.netAmountTotal) {
    totals.netAmountTotal = extractFooterNet(text) ?? 0;
  }
  if (!totals.silCutoffTotal) {
    totals.silCutoffTotal = extractFooterSilCutoff(text) ?? 0;
  }
  if (!totals.grossAmountTotal) {
    totals.grossAmountTotal = extractFooterGross(text) ?? 0;
  }
  return totals;
}

/**
 * Parse extracted PDF text into structured payroll summary metrics.
 */
export function parsePayrollRegisterText(
  text: string
): PayrollSummaryMetrics {
  const period = extractPeriod(text);
  if (!period) {
    throw new Error(
      "Could not detect cutoff period in PDF. Expected a date range like 05/01/2026 to 05/15/2026."
    );
  }

  const totalsLine = findTotalsLine(text);
  if (!totalsLine) {
    throw new Error(
      "Could not find totals row in PDF. Expected a line starting with Total or TOTAL."
    );
  }

  const nums = parseNumericTokens(
    totalsLine.line.replace(/^TOTAL\s+/i, "").replace(/^Total\s+/i, "")
  );

  const format = totalsLine.format;
  const employees = parseEmployeeRows(text, format);
  const employeeCount = employees.length;

  let totalsRow: PayrollRegisterRow | null = null;

  if (format === "external_register") {
    const layout =
      nums.length >= EXTERNAL_EARNINGS_28_LAYOUT.minColumns
        ? mergeConverge28Layout(nums, true)
        : resolveExternalRegisterLayout(nums.length, text, nums, {
            isTotalRow: true,
          });
    if (!layout) {
      throw new Error(
        `Unexpected external register column count (${nums.length}). Expected 21, 24, or 28 numeric fields.`
      );
    }
    totalsRow = parseRegisterRow("TOTAL", nums, layout);
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
      ? applyExternalFooterTotals(text, picked)
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
    companyName: extractCompanyName(text),
    payoutDate: extractPayoutDate(text),
    sourceFormat: format,
    employees,
  };
}

export async function parsePayrollRegisterPdf(
  buffer: Buffer
): Promise<PayrollSummaryMetrics> {
  const { extractPdfText } = await import("./extract-pdf-text");
  const text = await extractPdfText(buffer);
  return parsePayrollRegisterText(text);
}
