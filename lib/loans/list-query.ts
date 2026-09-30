import { APRIL_LOAN_CREATOR_ID } from "./loan-creators";

const LOAN_TYPES = [
  "company",
  "sss_calamity",
  "pagibig_calamity",
  "sss",
  "pagibig",
  "pagibig_mpl",
  "pagibig_safe",
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
  /** User id of the person who created the loan. Null means every creator. */
  created_by: string | null;
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

  const createdByRaw = (row.created_by ?? "").trim();
  const reviewRaw = (row.review ?? "").trim();
  let created_by: string | null = null;
  if (createdByRaw && createdByRaw !== "all") {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(createdByRaw)) {
      return { ok: false, error: "Invalid created by filter" };
    }
    created_by = createdByRaw;
  } else if (reviewRaw === "april") {
    created_by = APRIL_LOAN_CREATOR_ID;
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
      created_by,
      limit,
      offset,
    },
  };
}
