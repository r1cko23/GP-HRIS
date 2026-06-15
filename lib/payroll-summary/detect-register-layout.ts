/**
 * Dynamic payroll register column layout from PDF header labels.
 *
 * Column count varies per client; header phrases (Daily Rate, Gross Amt, etc.)
 * are stable. pdf-parse splits headers across lines — join + phrase-match
 * recovers left-to-right column order, then map each index to a register field.
 */

import type { RegisterLayoutMap } from "./register-columns";

type RegisterFieldKey = keyof Omit<
  import("./register-columns").PayrollRegisterRow,
  "name"
>;

/** Longest phrases first so "Reg OT Hours" wins over "Hours". */
export const HEADER_PHRASES = [
  "Daily Rate",
  "Hours Worked",
  "Days Worked",
  "Basic Salary",
  "Total Salary",
  "Reg OT Hours",
  "Reg OT Amt",
  "Reg Nightdiff OT Hours",
  "Reg Nightdiff OT Amt",
  "NightDiff Hours",
  "NightDiff Amt",
  "Night Diff Hours",
  "Night Diff Amt",
  "Legal Holiday Hours",
  "Legal Holiday Amt",
  "Special Holiday OT Hours",
  "Special Holiday OT Amt",
  "Special Holiday OT",
  "Special Holiday Hours",
  "Special Holiday Amt",
  "SH Restday OT Hours",
  "SH Restday OT Amt",
  "Restday OT Hours",
  "Restday OT Amt",
  "Restday Hours",
  "Restday Amt",
  "Working Dayoff Hours",
  "Working Dayoff Amt",
  "Holiday OT Hours",
  "Holiday OT Amt",
  "Income Adjustment",
  "Service Incentive Leave",
  "Transpo Allowance",
  "Load Allowance",
  "Meal Allowance",
  "COMM Allowance",
  "Gas & Motor",
  "Other Deduction",
  "Total Deduction",
  "Net Amount",
  "13th Month Cuttoff",
  "13th Month Cutoff",
  "SIL Cuttoff",
  "SIL Cutoff",
  "13th Month YTD",
  "Pag-Ibig Loan",
  "Pag-IBIG Loan",
  "SSS Loan",
  "Withholding Tax",
  "WTax",
  "Gross Amt",
  "SSS Pro",
  "SSS PRO",
  "PHILHEALT H",
  "PHILHEALTH",
  "PhilHealth",
  "PagIbig",
  "Pag-IBIG",
  "Total OT",
  "Allowance",
  "Refund",
  "Reg OT",
  "Reg Nightdiff",
  "NightDiff",
  "Night Diff",
  "Legal Holiday",
  "Special Holiday",
  "Restday OT",
  "Restday",
  "Incentive Leave",
  "Hours",
  "Days",
  "Basic",
  "Deduction",
  "Cuttoff",
  "Cutoff",
  "YTD",
  "SSS",
  "Meal",
  "COMM",
  "Loan",
  "Other",
  "Amt",
  "H",
  "Pro",
].sort((a, b) => b.length - a.length);

const EXACT_LABEL_TO_FIELD: Record<string, RegisterFieldKey | null> = {
  "Daily Rate": "dailyRate",
  "Hours Worked": "hoursWorked",
  "Days Worked": "daysWorked",
  Basic: "basicSalary",
  "Basic Salary": "basicSalary",
  "Total Salary": "totalSalary",
  "Reg OT Hours": "regOTHours",
  "Reg OT Amt": "regOTAmount",
  "Reg Nightdiff OT Hours": "regNightdiffOTHours",
  "Reg Nightdiff OT Amt": "regNightdiffOTAmount",
  "NightDiff Hours": "nightDiffHours",
  "NightDiff Amt": "nightDiffAmount",
  "Night Diff Hours": "nightDiffHours",
  "Night Diff Amt": "nightDiffAmount",
  "Legal Holiday Hours": "specialHolidayHours",
  "Legal Holiday Amt": "specialHolidayAmount",
  "Special Holiday OT Hours": "specialHolidayOTHours",
  "Special Holiday OT Amt": "specialHolidayOTAmount",
  "Special Holiday Hours": "specialHolidayHours",
  "Special Holiday Amt": "specialHolidayAmount",
  "SH Restday OT Hours": "specialHolidayOTHours",
  "SH Restday OT Amt": "specialHolidayOTAmount",
  "Restday OT Hours": "restdayHours",
  "Restday OT Amt": "restdayAmount",
  "Restday Hours": "restdayHours",
  "Restday Amt": "restdayAmount",
  "Holiday OT Hours": "specialHolidayOTHours",
  "Holiday OT Amt": "specialHolidayOTAmount",
  "Working Dayoff Hours": "restdayHours",
  "Working Dayoff Amt": "restdayAmount",
  "Total OT": "totalOTAmount",
  "Service Incentive Leave": "serviceIncentiveLeaveAmount",
  "Incentive Leave": "serviceIncentiveLeaveAmount",
  "Meal Allowance": "transpoAllowance",
  Meal: "transpoAllowance",
  "COMM Allowance": "allowance",
  COMM: "allowance",
  "Gas & Motor": "loadAllowance",
  "Transpo Allowance": "transpoAllowance",
  "Load Allowance": "loadAllowance",
  Allowance: "allowance",
  Refund: "refund",
  "Income Adjustment": "otherDeduction",
  "Gross Amt": "grossAmount",
  SSS: "sss",
  "SSS Pro": "sssPRO",
  "SSS PRO": "sssPRO",
  "PHILHEALT H": "philhealth",
  PHILHEALTH: "philhealth",
  PhilHealth: "philhealth",
  PagIbig: "pagibig",
  "Pag-IBIG": "pagibig",
  "Pag-Ibig Loan": "sssLoan",
  "Pag-IBIG Loan": "sssLoan",
  "SSS Loan": "sssLoan",
  "Withholding Tax": "withholdingTax",
  WTax: "withholdingTax",
  "Other Deduction": "otherDeduction",
  Other: "otherDeduction",
  "Total Deduction": "totalDeduction",
  Deduction: "totalDeduction",
  "Net Amount": "netAmount",
  "13th Month Cuttoff": "thirteenthMonthCutoff",
  "13th Month Cutoff": "thirteenthMonthCutoff",
  Cuttoff: "thirteenthMonthCutoff",
  Cutoff: "thirteenthMonthCutoff",
  "SIL Cuttoff": "silCutoff",
  "SIL Cutoff": "silCutoff",
  "13th Month YTD": "thirteenthMonthYTD",
  YTD: "thirteenthMonthYTD",
  H: null,
  Amt: null,
  Pro: null,
  Loan: null,
};

export interface DetectedRegisterLayout {
  layout: RegisterLayoutMap;
  labels: string[];
  source: "header";
}

/** Extract header text from the register table (joins wrapped header lines). */
export function extractRegisterHeaderBlock(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let dailyIdx = lines.findIndex((l) => /^Daily Rate\b/i.test(l.trim()));
  if (dailyIdx < 0) {
    dailyIdx = lines.findIndex((l) => /\bDaily Rate\b/i.test(l));
  }
  if (dailyIdx < 0) return null;

  const endIdx = lines.findIndex((l, i) => {
    if (i <= dailyIdx) return false;
    const t = l.trim();
    if (/^Total\s+[\d,.\-]/i.test(t)) return true;
    if (/^\d+\.\s+[A-Z]/u.test(t)) return true;
    return false;
  });

  const slice = lines.slice(
    dailyIdx,
    endIdx > dailyIdx ? endIdx : dailyIdx + 30
  );
  return slice.join(" ").replace(/\s+/g, " ").trim();
}

/** Tokenize joined header text into column labels (left-to-right order). */
export function tokenizeRegisterHeaderLabels(headerText: string): string[] {
  const labels: string[] = [];
  let rest = headerText;
  let guard = 0;

  while (rest.trim() && guard++ < 100) {
    const lower = rest.toLowerCase();
    let matched: string | null = null;

    for (const phrase of HEADER_PHRASES) {
      if (lower.startsWith(phrase.toLowerCase())) {
        matched = phrase;
        break;
      }
    }

    if (matched) {
      labels.push(matched);
      rest = rest.slice(matched.length).trim();
      continue;
    }

    const skip = rest.match(/^(\S+)\s*/);
    if (skip) {
      rest = rest.slice(skip[0].length);
      continue;
    }
    break;
  }

  return labels;
}

/** Drop orphan / duplicate fragment labels when tokenizer over-counts columns. */
export function refineLabelsToColumnCount(
  labels: string[],
  tokenCount: number
): string[] {
  let refined = [...labels];

  const dropOrphan = () => {
    const idx = refined.findIndex(
      (l) => EXACT_LABEL_TO_FIELD[l] === null || l === "Deduction"
    );
    if (idx >= 0 && refined.length > tokenCount) {
      refined.splice(idx, 1);
      return true;
    }
    return false;
  };

  while (refined.length > tokenCount && dropOrphan()) {
    /* trim tokenizer noise */
  }

  // Collapse consecutive duplicate labels (e.g. repeated "Legal Holiday")
  for (let i = refined.length - 1; i > 0 && refined.length > tokenCount; i--) {
    if (refined[i] === refined[i - 1]) {
      refined.splice(i, 1);
    }
  }

  if (refined.length > tokenCount) {
    const grossIdx = refined.indexOf("Gross Amt");
    if (grossIdx > 0 && refined.length - grossIdx <= tokenCount) {
      refined = refined.slice(grossIdx - (tokenCount - (refined.length - grossIdx)));
    } else {
      refined = refined.slice(0, tokenCount);
    }
  }

  return refined;
}

/** Pad or trim labels so each numeric column index has a slot (empty = unlabeled statutory). */
export function alignLabelsToColumnCount(
  labels: string[],
  tokenCount: number
): string[] {
  let refined = refineLabelsToColumnCount(labels, tokenCount);
  if (refined.length === tokenCount) return refined;

  if (refined.length < tokenCount) {
    const grossIdx = refined.indexOf("Gross Amt");
    const netIdx = refined.lastIndexOf("Net Amount");
    if (grossIdx >= 0 && netIdx > grossIdx) {
      const missing = tokenCount - refined.length;
      const prefix = refined.slice(0, grossIdx + 1);
      const suffix = refined.slice(grossIdx + 1);
      const padded = [
        ...prefix,
        ...Array(missing).fill(""),
        ...suffix,
      ].slice(0, tokenCount);
      if (padded.length === tokenCount) return padded;
    }
    while (refined.length < tokenCount) refined.push("");
    return refined;
  }

  return refined.slice(0, tokenCount);
}

function precedingLabel(labels: string[], index: number): string {
  for (let i = index - 1; i >= 0; i--) {
    const l = labels[i];
    if (l !== "Hours" && l !== "Amt" && l !== "H" && l !== "Days") return l;
  }
  return "";
}

/**
 * Map a header label at a given column index to a register field.
 * Handles repeated "Hours" / "Amt" fragments based on surrounding labels.
 */
export function resolveFieldForHeaderLabel(
  label: string,
  index: number,
  labels: string[]
): RegisterFieldKey | null {
  if (label === "Hours") {
    if (index <= 4) return "hoursWorked";
    const prev = precedingLabel(labels, index);
    if (/Reg OT/i.test(prev)) return "regOTHours";
    if (/Reg Nightdiff/i.test(prev)) return "regNightdiffOTHours";
    if (/NightDiff|Night Diff/i.test(prev)) return "nightDiffHours";
    if (/Legal Holiday/i.test(prev)) return "specialHolidayHours";
    if (/Special Holiday/i.test(prev)) return "specialHolidayHours";
    if (/Restday/i.test(prev)) return "restdayHours";
    if (/Holiday OT/i.test(prev)) return "specialHolidayOTHours";
    if (/Working Dayoff/i.test(prev)) return "restdayHours";
    return "regOTHours";
  }

  if (label === "Amt") {
    const prev = precedingLabel(labels, index);
    if (/Reg OT/i.test(prev)) return "regOTAmount";
    if (/Reg Nightdiff/i.test(prev)) return "regNightdiffOTAmount";
    if (/NightDiff|Night Diff/i.test(prev)) return "nightDiffAmount";
    if (/Legal Holiday/i.test(prev)) return "specialHolidayAmount";
    if (/Special Holiday/i.test(prev)) return "specialHolidayAmount";
    if (/Restday OT/i.test(prev)) return "restdayAmount";
    if (/Holiday OT/i.test(prev)) return "specialHolidayOTAmount";
    if (/Working Dayoff/i.test(prev)) return "restdayAmount";
    return null;
  }

  if (label === "Days" && index <= 3) return "daysWorked";

  if (label === "Reg OT" && labels[index + 1] === "Hours") {
    return "regOTHours";
  }

  if (label === "Reg Nightdiff") {
    if (labels[index + 1] === "OT Hours" || labels[index + 2] === "Hours") {
      return "regNightdiffOTHours";
    }
    if (labels[index + 1] === "OT Amt" || labels[index + 2] === "Amt") {
      return "regNightdiffOTAmount";
    }
    return "regNightdiffOTHours";
  }

  if (label === "NightDiff" || label === "Night Diff") {
    if (labels[index + 1] === "Hours") return "nightDiffHours";
    if (labels[index + 1] === "Amt") return "nightDiffAmount";
    return "nightDiffHours";
  }

  if (label === "Legal Holiday") {
    if (labels[index + 1] === "Hours") return "specialHolidayHours";
    if (labels[index + 1] === "Amt") return "specialHolidayAmount";
    return "specialHolidayHours";
  }

  if (label === "Special Holiday") {
    if (labels[index + 1] === "Hours") return "specialHolidayHours";
    if (labels[index + 1] === "Amt") return "specialHolidayAmount";
    return "specialHolidayHours";
  }

  if (label === "Restday" || label === "Restday OT") {
    if (labels[index + 1] === "Hours") return "restdayHours";
    if (labels[index + 1] === "Amt") return "restdayAmount";
    return "restdayHours";
  }

  return EXACT_LABEL_TO_FIELD[label] ?? null;
}

/**
 * Nabati-style registers label night diff as "Reg Nightdiff OT" only — no plain
 * NightDiff columns. Fold into nightDiff fields for BI consistency.
 */
function foldRegNightdiffWhenNoPlainNightDiff(
  labels: string[],
  layout: RegisterLayoutMap
): void {
  const hasPlainNightDiff = labels.some(
    (l) => l === "NightDiff Hours" || l === "Night Diff Hours"
  );
  if (hasPlainNightDiff) return;
  if (layout.regNightdiffOTAmount == null) return;

  layout.nightDiffHours = layout.regNightdiffOTHours ?? layout.nightDiffHours;
  layout.nightDiffAmount = layout.regNightdiffOTAmount;
  delete layout.regNightdiffOTHours;
  delete layout.regNightdiffOTAmount;
}

/**
 * When the register omits Reg OT columns but pdf-parse header still reads
 * "NightDiff" before Legal Holiday, those columns are Reg OT — not night diff.
 */
function remapMisplacedRegOTColumns(
  labels: string[],
  layout: RegisterLayoutMap
): void {
  const hasRegOTHeader = labels.includes("Reg OT Hours");
  const nightIdx = labels.indexOf("NightDiff Hours");
  const legalIdx = labels.findIndex(
    (l) => l === "Legal Holiday Hours" || l === "Legal Holiday"
  );

  if (hasRegOTHeader || nightIdx < 0) return;
  if (legalIdx >= 0 && nightIdx > legalIdx) return;

  const nightAmtIdx = labels.indexOf("NightDiff Amt");
  if (nightAmtIdx !== nightIdx + 1) return;

  layout.regOTHours = nightIdx;
  layout.regOTAmount = nightAmtIdx;
  delete layout.nightDiffHours;
  delete layout.nightDiffAmount;
}

/** Build a RegisterLayoutMap from header labels + numeric column count. */
export function buildLayoutFromHeaderLabels(
  labels: string[],
  tokenCount: number
): RegisterLayoutMap | null {
  if (tokenCount < 10) return null;

  const refined = alignLabelsToColumnCount(labels, tokenCount);
  if (refined.length !== tokenCount) return null;

  const layout: RegisterLayoutMap = { minColumns: tokenCount };

  for (let index = 0; index < tokenCount; index++) {
    const label = refined[index];
    if (!label) continue;
    const field = resolveFieldForHeaderLabel(label, index, refined);
    if (!field) continue;
    if (layout[field] == null) {
      layout[field] = index;
    }
  }

  remapMisplacedRegOTColumns(refined, layout);
  foldRegNightdiffWhenNoPlainNightDiff(refined, layout);

  if (layout.grossAmount == null || layout.netAmount == null) return null;
  if (layout.hoursWorked == null && layout.dailyRate == null) return null;

  return layout;
}

/**
 * Detect external register layout from PDF text headers.
 * Returns null when headers are missing or cannot be aligned to column count.
 */
export function detectExternalRegisterLayout(
  text: string,
  tokenCount: number
): DetectedRegisterLayout | null {
  const headerBlock = extractRegisterHeaderBlock(text);
  if (!headerBlock) return null;

  const labels = tokenizeRegisterHeaderLabels(headerBlock);
  const layout = buildLayoutFromHeaderLabels(labels, tokenCount);
  if (!layout) return null;

  return {
    layout,
    labels: alignLabelsToColumnCount(labels, tokenCount),
    source: "header",
  };
}

/**
 * Infer the most common employee-row column count (validates totals row).
 */
export function inferRegisterColumnCount(text: string): number | null {
  const pattern = /^\d+\.\s+.+?\s+([\d,.\-\s]+)$/gmu;
  const counts = new Map<number, number>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const tokens = match[1].match(/-?\d[\d,]*\.?\d*|-/g) ?? [];
    const n = tokens.length;
    if (n >= 10) counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  let best: number | null = null;
  let bestCount = 0;
  for (const [cols, freq] of counts) {
    if (freq > bestCount) {
      best = cols;
      bestCount = freq;
    }
  }
  return best;
}
