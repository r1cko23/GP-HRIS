/**
 * Hilton-style payroll funding helpers + Debit Memo workbook alias.
 * Splits a posted register by Directory pay_through into ATM / Cheque / GCash / Hold.
 * Workbook output ports MAIN sp_posted-dm-* (see disbursement-debit-memo.ts).
 */

export type FundingPayThrough = "atm" | "cheque" | "gcash" | "hold" | "other";

export type FundingPerson = {
  employee_code?: string | null;
  last_name?: string | null;
  first_name?: string | null;
  hire_date?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  net_pay?: number | null;
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function text(value: unknown): string {
  if (value == null) return "";
  return String(value).trim();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

export function parseFundingPayThrough(value: unknown): FundingPayThrough {
  const raw = text(value).toLowerCase().replace(/[\s_-]+/g, "");
  if (!raw || raw === "atm" || raw === "bank" || raw === "payrollatm") return "atm";
  if (raw === "cheque" || raw === "check" || raw === "cash") return "cheque";
  if (raw === "gcash" || raw === "g-cash") return "gcash";
  if (raw.includes("hold") || raw === "finalpay") return "hold";
  return "other";
}

export function personDisplayName(p: FundingPerson): string {
  const last = text(p.last_name);
  const first = text(p.first_name);
  if (last && first) return `${last}, ${first}`;
  return last || first || text(p.employee_code);
}

export type FundingBucket = {
  channel: FundingPayThrough;
  people: FundingPerson[];
  total: number;
  pax: number;
};

export function bucketFundingPeople(people: FundingPerson[]): FundingBucket[] {
  const order: FundingPayThrough[] = ["atm", "cheque", "gcash", "hold", "other"];
  const map = new Map<FundingPayThrough, FundingPerson[]>();
  for (const ch of order) map.set(ch, []);
  for (const person of people) {
    const ch = parseFundingPayThrough(person.pay_through);
    map.get(ch)!.push(person);
  }
  return order
    .map((channel) => {
      const list = map.get(channel) ?? [];
      const total = round2(list.reduce((acc, p) => acc + n(p.net_pay), 0));
      return { channel, people: list, total, pax: list.length };
    })
    .filter((b) => b.pax > 0 || b.channel === "atm");
}

/** @deprecated Prefer buildDisbursementDebitMemoWorkbook — kept as alias. */
export function buildFundingMemoWorkbook(input: {
  client_name: string;
  title: string;
  pay_out_date: string;
  people: FundingPerson[];
  gp_savings_account?: string;
}): Buffer {
  // Lazy require avoids circular init with disbursement-debit-memo.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { buildDisbursementDebitMemoWorkbook } =
    require("./disbursement-debit-memo") as typeof import("./disbursement-debit-memo");
  return buildDisbursementDebitMemoWorkbook(input);
}

export function fundingMemoFilename(
  clientLabel: string,
  periodLabel: string
): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { debitMemoFilename } =
    require("./disbursement-debit-memo") as typeof import("./disbursement-debit-memo");
  return debitMemoFilename(clientLabel, periodLabel);
}
