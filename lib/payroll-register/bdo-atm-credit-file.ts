/**
 * BDO ATM Payroll credit .txt — matches output of
 * "BDO ATM Payroll Converter for BOB_With User Guides.xls"
 * (sample: D7I09262601.txt).
 *
 * Format (not the VBA H/T fixed-width mode):
 *   {12-digit account}\t{amount 0.00}\r\n
 *
 * Filename: {companyCode}{MMDDYY}{batch} e.g. D7I09262601.txt
 */

export const BDO_DEFAULT_COMPANY_CODE = "D7I";
export const BDO_DEFAULT_FUNDING_ACCOUNT = "2110254455";

export type BdoAtmCreditRowInput = {
  accountNo: string;
  amount: number;
  name?: string;
};

export type BdoAtmCreditBuildInput = {
  uploadDate: string; // YYYY-MM-DD
  batchNo: number;
  companyCode: string;
  fundingAccount: string;
  rows: BdoAtmCreditRowInput[];
  /** Override "today" for past-date checks (tests). Defaults to local calendar date. */
  today?: string;
};

export type BdoAtmCreditOk = {
  ok: true;
  text: string;
  recordCount: number;
  totalAmount: number;
  warnings: string[];
  filename: string;
};

export type BdoAtmCreditErr = {
  ok: false;
  error: string;
  warnings: string[];
};

export type BdoAtmCreditResult = BdoAtmCreditOk | BdoAtmCreditErr;

const round2 = (v: number) => Math.round(v * 100) / 100;

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

function digitsOnly(value: unknown): string {
  return text(value).replace(/\D/g, "");
}

/** VBA Format(x, "@@@@@@@@@@") — kept for tests / legacy helpers. */
export function formatAtField(value: string | number, width: number): string {
  const s = String(value);
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

/** Normalize funding account digits (stored on disbursement; not in .txt body). */
export function formatFundingAccount(account: string): string {
  const digits = digitsOnly(account);
  if (!digits || Number(digits) === 0) {
    throw new Error("Invalid funding account number");
  }
  const normalized = digits.replace(/^0+/, "") || "0";
  return normalized.length < 8 ? normalized.padStart(8, "0") : normalized;
}

/** Amount with two decimals (converter sample: 7465.00). */
export function formatBdoAmount(amount: number): string {
  return round2(amount).toFixed(2);
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

/**
 * BDO converter download name: {companyCode}{MMDDYY}{batch}
 * e.g. D7I + 092626 + 01 → D7I09262601.txt
 */
export function bdoAtmCreditFilename(input: {
  uploadDate: string;
  batchNo: number;
  companyCode: string;
}): string {
  const code = text(input.companyCode).toUpperCase() || BDO_DEFAULT_COMPANY_CODE;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(input.uploadDate));
  if (!m) throw new Error("Upload date must be YYYY-MM-DD");
  const mmddyy = `${m[2]}${m[3]}${m[1].slice(2)}`;
  const batch = String(Math.trunc(input.batchNo)).padStart(2, "0");
  return `${code}${mmddyy}${batch}.txt`;
}

/**
 * Filter ATM credit candidates: skip zero-net (warnings), collect invalid
 * positive-amount rows as errors for the caller.
 */
export function prepareBdoAtmCreditRows(rows: BdoAtmCreditRowInput[]): {
  rows: Array<{ accountNo: string; amount: number }>;
  warnings: string[];
  errors: string[];
} {
  const warnings: string[] = [];
  const errors: string[] = [];
  const out: Array<{ accountNo: string; amount: number }> = [];

  for (const row of rows) {
    const accountNo = digitsOnly(row.accountNo);
    const amount = round2(Number(row.amount ?? 0));
    const label = text(row.name) || accountNo || "(unnamed)";

    if (!Number.isFinite(amount)) {
      errors.push(`${label}: amount is not a number`);
      continue;
    }
    if (amount < 0) {
      errors.push(`${label}: negative amount not accepted`);
      continue;
    }
    if (amount === 0) {
      warnings.push(`${label}: skipped zero net pay`);
      continue;
    }
    if (!accountNo || Number(accountNo) === 0) {
      errors.push(`${label}: missing or invalid BDO account number`);
      continue;
    }
    if (!/^\d+$/.test(accountNo)) {
      errors.push(`${label}: account number must be numeric`);
      continue;
    }
    // Preserve leading zeros (sample accounts are 12-digit).
    out.push({ accountNo, amount });
  }

  return { rows: out, warnings, errors };
}

export function buildBdoAtmCreditTxt(
  input: BdoAtmCreditBuildInput
): BdoAtmCreditResult {
  const warnings: string[] = [];
  const today = input.today ?? todayIso();
  const uploadDate = text(input.uploadDate);
  const batchNo = Math.trunc(Number(input.batchNo));
  const companyCode = text(input.companyCode).toUpperCase();
  const fundingRaw = text(input.fundingAccount);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(uploadDate)) {
    return { ok: false, error: "Upload date must be YYYY-MM-DD", warnings };
  }
  if (uploadDate < today) {
    return {
      ok: false,
      error: "Upload date must not be past-dated",
      warnings,
    };
  }
  if (!Number.isFinite(batchNo) || batchNo < 1 || batchNo > 99) {
    return {
      ok: false,
      error: "Batch must be an integer between 1 and 99",
      warnings,
    };
  }
  if (!companyCode) {
    return { ok: false, error: "Company code is required", warnings };
  }

  try {
    formatFundingAccount(fundingRaw);
  } catch {
    return {
      ok: false,
      error: "Invalid funding account number",
      warnings,
    };
  }

  const prepared = prepareBdoAtmCreditRows(input.rows);
  warnings.push(...prepared.warnings);
  if (prepared.errors.length > 0) {
    return {
      ok: false,
      error: prepared.errors.join("; "),
      warnings,
    };
  }
  if (prepared.rows.length === 0) {
    return {
      ok: false,
      error: "No payable ATM rows (all zero net or missing accounts)",
      warnings,
    };
  }

  const totalAmount = round2(
    prepared.rows.reduce((acc, r) => acc + r.amount, 0)
  );
  const recordCount = prepared.rows.length;

  // Sample converter body: account TAB amount, CRLF lines (no H/T wrapper).
  const textOut =
    prepared.rows
      .map((r) => `${r.accountNo}\t${formatBdoAmount(r.amount)}`)
      .join("\r\n") + "\r\n";

  return {
    ok: true,
    text: textOut,
    recordCount,
    totalAmount,
    warnings,
    filename: bdoAtmCreditFilename({
      uploadDate,
      batchNo,
      companyCode,
    }),
  };
}
