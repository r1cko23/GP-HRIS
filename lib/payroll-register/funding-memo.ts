/**
 * Hilton-style payroll funding / liquidation workbook (not Client SOA debit memo).
 * Splits a posted register by Directory pay_through into ATM / Cheque / GCash / Hold sheets.
 */

import XLSX from "xlsx-js-style";

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

export function buildFundingMemoWorkbook(input: {
  client_name: string;
  title: string;
  pay_out_date: string;
  people: FundingPerson[];
  gp_savings_account?: string;
}): Buffer {
  const client = text(input.client_name) || "Client";
  const title = text(input.title) || "Payroll funding";
  const payOut = text(input.pay_out_date);
  const savings = text(input.gp_savings_account) || "2110254455";
  const buckets = bucketFundingPeople(input.people);
  const byChannel = Object.fromEntries(
    buckets.map((b) => [b.channel, b])
  ) as Record<FundingPayThrough, FundingBucket | undefined>;
  const atm = byChannel.atm ?? {
    channel: "atm" as const,
    people: [],
    total: 0,
    pax: 0,
  };
  const cheque = byChannel.cheque;
  const gcash = byChannel.gcash;
  const hold = byChannel.hold;

  const wb = XLSX.utils.book_new();

  const summaryAoa: unknown[][] = [
    ["GREEN PASTURE PEOPLE MANAGEMENT INC."],
    [],
    [payOut],
    [],
    [],
    [],
    ["PAYROLL SUMMARY :", `${client} ${title}`.trim()],
    [],
    ["ATM PAYROLL"],
    [client, atm.total],
    ["CHEQUE PAYROLL"],
    [client, cheque?.total ?? 0],
    ["GCASH"],
    [client, gcash?.total ?? 0],
    ["HOLD"],
    [client, hold?.total ?? 0],
    [],
    ["TOTAL", round2(buckets.reduce((a, b) => a + b.total, 0))],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryAoa),
    "SUMMARY"
  );

  const atmAoa: unknown[][] = [
    [payOut],
    [],
    ["Banco De Oro"],
    ["Julia Vargas Branch"],
    ["Ortigas, Pasig City"],
    [],
    ["Gentlemen,"],
    [],
    [
      "This is to authorize your branch to debit the amount of P",
      atm.total,
      "from Savings Account",
    ],
    [
      `# ${savings} under the name of Green Pasture People Management Inc for credit to various savings accounts, viz;`,
    ],
    [],
    ["Account No.", "Amount", "Name of Employee"],
    ...atm.people.map((p) => [
      text(p.bank_account_no),
      n(p.net_pay),
      personDisplayName(p),
    ]),
    [],
    ["TOTAL", atm.total, atm.pax],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(atmAoa), "ATM PAYROLL");

  const liquidation = (
    sheetName: string,
    channel: FundingPayThrough,
    mobileCol: boolean
  ) => {
    const bucket = byChannel[channel];
    const people = bucket?.people ?? [];
    const header = mobileCol
      ? ["No.", "Mobile Number", "Name", "Amount", "PAY THRU"]
      : ["No.", "Name", "HIRING DATE", "Amount", "PAY THRU"];
    const rows = people.map((p, i) =>
      mobileCol
        ? [
            i + 1,
            text(p.gcash),
            personDisplayName(p),
            n(p.net_pay),
            channel.toUpperCase(),
          ]
        : [
            i + 1,
            personDisplayName(p),
            text(p.hire_date).slice(0, 10),
            n(p.net_pay),
            channel.toUpperCase(),
          ]
    );
    const aoa: unknown[][] = [
      ["GREEN PASTURE PEOPLE MANAGEMENT INC."],
      [],
      ["HOLD CASH PAYROLL LIQUIDATION"],
      ["Pay out Date:", payOut],
      [],
      header,
      [title],
      ...rows,
      [],
      ["TOTAL", "", "", bucket?.total ?? 0],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), sheetName);
  };

  liquidation("CHEQUE PAYROLL", "cheque", false);
  liquidation("GCASH", "gcash", true);
  liquidation("HOLD CASH PAYROLL", "hold", false);

  const reportAoa: unknown[][] = [
    [payOut],
    [],
    ["CLIENT NAME:", "CHANNEL", "PAX", "AMOUNT"],
    ["ATM", atm.pax, atm.total],
    ["CHEQUE", cheque?.pax ?? 0, cheque?.total ?? 0],
    ["GCASH", gcash?.pax ?? 0, gcash?.total ?? 0],
    ["HOLD", hold?.pax ?? 0, hold?.total ?? 0],
    [],
    [
      "TOTAL",
      buckets.reduce((a, b) => a + b.pax, 0),
      round2(buckets.reduce((a, b) => a + b.total, 0)),
    ],
  ];
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(reportAoa),
    "PAYROLL REPORT"
  );

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function fundingMemoFilename(
  clientLabel: string,
  periodLabel: string
): string {
  const c = text(clientLabel).replace(/\s+/g, "-") || "Client";
  const p = text(periodLabel).replace(/\s+/g, "-") || "period";
  return `Funding-Memo-${c}-${p}.xlsx`;
}
