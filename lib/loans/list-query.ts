const LOAN_TYPES = [
  "company",
  "sss_calamity",
  "pagibig_calamity",
  "sss",
  "pagibig",
  "emergency",
  "other",
] as const;

const LOAN_STATUSES = ["all", "active", "inactive"] as const;

export type LoanListType = (typeof LOAN_TYPES)[number];
export type LoanListStatus = (typeof LOAN_STATUSES)[number];

export type LoanListQuery = {
  client_id: string;
  q: string;
  loan_type: LoanListType | null;
  status: LoanListStatus;
  limit: number;
  offset: number;
};

export type LoanListQueryResult =
  | { ok: true; value: LoanListQuery }
  | { ok: false; error: string };

function asRecord(params: unknown): Record<string, string | undefined> {
  if (!params || typeof params !== "object") return {};
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value == null) continue;
    out[key] = String(value);
  }
  return out;
}

export function parseLoanListQuery(params: unknown): LoanListQueryResult {
  const row = asRecord(params);
  const client_id = (row.client_id ?? "").trim();
  if (!client_id) {
    return { ok: false, error: "client_id is required" };
  }

  const loanTypeRaw = (row.loan_type ?? "").trim();
  if (loanTypeRaw && loanTypeRaw !== "all") {
    if (!(LOAN_TYPES as readonly string[]).includes(loanTypeRaw)) {
      return { ok: false, error: "Invalid loan type" };
    }
  }

  const statusRaw = (row.status ?? "all").trim() || "all";
  if (!(LOAN_STATUSES as readonly string[]).includes(statusRaw)) {
    return { ok: false, error: "Invalid status" };
  }

  const limit = Math.min(Math.max(Number(row.limit ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(row.offset ?? 0) || 0, 0);

  return {
    ok: true,
    value: {
      client_id,
      q: (row.q ?? "").trim(),
      loan_type:
        loanTypeRaw && loanTypeRaw !== "all"
          ? (loanTypeRaw as LoanListType)
          : null,
      status: statusRaw as LoanListStatus,
      limit,
      offset,
    },
  };
}
