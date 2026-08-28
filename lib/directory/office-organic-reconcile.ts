import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type MatchMethod =
  | "employee_code"
  | "sss"
  | "tin"
  | "dob_lastname"
  | "name"
  | "hr_alias"
  | "none";

/** HR-confirmed identity aliases when office labels ≠ Directory legal names */
export const OFFICE_ORGANIC_ALIASES: Array<{
  office_employee_id?: string;
  office_name_equals?: string;
  directory_employee_code: string;
  reason: string;
}> = [
  {
    office_employee_id: "2025002",
    office_name_equals: "MGR G. RAZAL",
    directory_employee_code: "24231",
    reason: "HR: MGR G. RAZAL is Michael Galeon Razal",
  },
];

export type OfficeSide = {
  id: string;
  employee_id: string | null;
  full_name: string | null;
  is_active: boolean;
  birth_date: string | null;
  sss_number: string | null;
  tin_number: string | null;
  position: string | null;
  directory_employee_id: string | null;
  directory_client_id: string | null;
};

export type DirectorySide = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  status: string | null;
  birth_date: string | null;
  sss_number: string | null;
  tin: string | null;
  bank_account_no: string | null;
  client_id: string | null;
  job_title: string | null;
};

export type MatchCandidate = {
  directory: DirectorySide;
  method: MatchMethod;
  score: number;
  reasons: string[];
};

export type ReconcileCase = {
  office: OfficeSide;
  candidates: MatchCandidate[];
  current_link: DirectorySide | null;
  decision: "link" | "create" | "skip" | null;
  needs_review: boolean;
  review_reason: string;
};

function digits(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.replace(/\D/g, "");
  return cleaned.length ? cleaned : null;
}

function normName(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

function displayDirName(row: DirectorySide): string {
  return `${row.last_name ?? ""}, ${row.first_name ?? ""}${
    row.middle_name ? ` ${row.middle_name}` : ""
  }`.trim();
}

function scoreMethod(method: MatchMethod): number {
  switch (method) {
    case "employee_code":
      return 100;
    case "sss":
      return 90;
    case "tin":
      return 80;
    case "dob_lastname":
      return 50;
    case "hr_alias":
      return 95;
    case "name":
      return 35;
    default:
      return 0;
  }
}

export function matchOfficeToOrganic(
  office: OfficeSide,
  organicRows: DirectorySide[]
): MatchCandidate[] {
  const officeCode = office.employee_id?.trim() ?? "";
  const officeSss = digits(office.sss_number);
  const officeTin = digits(office.tin_number);
  const officeName = normName(office.full_name);
  const byId = new Map<string, MatchCandidate>();

  const add = (row: DirectorySide, method: MatchMethod, reason: string) => {
    const existing = byId.get(row.id);
    const score = scoreMethod(method);
    if (!existing || score > existing.score) {
      byId.set(row.id, {
        directory: row,
        method,
        score,
        reasons: [reason],
      });
    } else if (existing && score === existing.score) {
      existing.reasons.push(reason);
    } else if (existing) {
      existing.reasons.push(reason);
    }
  };

  for (const row of organicRows) {
    const code = row.employee_code?.trim() ?? "";
    if (officeCode && code && officeCode === code) {
      add(row, "employee_code", "Employee ID matches Directory code");
    }
    const sss = digits(row.sss_number);
    if (officeSss && sss && officeSss === sss) {
      add(row, "sss", "SSS matches");
    }
    const tin = digits(row.tin);
    if (officeTin && tin && officeTin === tin) {
      add(row, "tin", "TIN matches");
    }
    const last = normName(row.last_name);
    if (
      office.birth_date &&
      row.birth_date &&
      office.birth_date === row.birth_date &&
      last &&
      officeName.includes(last)
    ) {
      add(row, "dob_lastname", "Birthday + last name in office full name");
    }
    const first = normName(row.first_name);
    if (
      last &&
      first &&
      officeName.includes(last) &&
      officeName.includes(first)
    ) {
      add(row, "name", "First + last name appear in office full name");
    }
  }

  for (const alias of OFFICE_ORGANIC_ALIASES) {
    const codeOk =
      alias.office_employee_id &&
      officeCode &&
      alias.office_employee_id === officeCode;
    const nameOk =
      alias.office_name_equals &&
      officeName === normName(alias.office_name_equals);
    if (!codeOk && !nameOk) continue;
    const target = organicRows.find(
      (row) => row.employee_code?.trim() === alias.directory_employee_code
    );
    if (target) add(target, "hr_alias", alias.reason);
  }

  return [...byId.values()].sort((a, b) => b.score - a.score);
}

function reviewReason(
  office: OfficeSide,
  candidates: MatchCandidate[],
  current: DirectorySide | null
): { needs_review: boolean; reason: string } {
  const best = candidates[0];
  if (!best) {
    return {
      needs_review: true,
      reason: "No Organic match — HR can create a new 201 from office",
    };
  }
  if (best.method !== "employee_code") {
    return {
      needs_review: true,
      reason: `Possible match via ${best.method} (codes differ) — confirm which side is correct`,
    };
  }
  if (candidates.length > 1) {
    return {
      needs_review: true,
      reason: "Multiple Organic candidates — pick which 201 to keep linked",
    };
  }
  const wantActive = office.is_active ? "active" : "inactive";
  const dirStatus = (current ?? best.directory).status ?? "";
  if (office.is_active && dirStatus !== "active") {
    return {
      needs_review: true,
      reason: `Office is active but Organic status is “${dirStatus}”`,
    };
  }
  if (!office.is_active && dirStatus === "active") {
    return {
      needs_review: true,
      reason: "Office is inactive but Organic is still active",
    };
  }
  if (!office.directory_employee_id) {
    return {
      needs_review: true,
      reason: "Exact code match but not linked yet",
    };
  }
  if (
    office.directory_employee_id &&
    office.directory_employee_id !== best.directory.id
  ) {
    return {
      needs_review: true,
      reason: "Linked to a different Directory row than the best Organic match",
    };
  }
  void wantActive;
  return { needs_review: false, reason: "Already aligned" };
}

export async function buildOfficeOrganicCases(
  publicDb: SupabaseClient,
  directory: SupabaseClient,
  organicOrgId: string
): Promise<{
  cases: ReconcileCase[];
  organicOrgId: string;
  organicClientId: string | null;
  summary: Record<string, number>;
}> {
  const { data: clientRow } = await directory
    .from("clients")
    .select("id")
    .eq("organization_id", organicOrgId)
    .limit(1)
    .maybeSingle();
  const organicClientId = (clientRow?.id as string | undefined) ?? null;

  const { data: officeRows, error: officeError } = await publicDb
    .from("employees")
    .select(
      "id, employee_id, full_name, is_active, birth_date, sss_number, tin_number, position, directory_employee_id, directory_client_id"
    )
    .order("employee_id");
  if (officeError) throw officeError;

  const { data: organicRows, error: organicError } = await directory
    .from("employees")
    .select(
      "id, employee_code, last_name, first_name, middle_name, status, birth_date, sss_number, tin, bank_account_no, client_id, position:positions(job_title)"
    )
    .eq("organization_id", organicOrgId);
  if (organicError) throw organicError;

  const { data: decisions } = await directory
    .from("office_reconcile_decisions")
    .select("office_employee_id, decision, directory_employee_id, match_method")
    .eq("organization_id", organicOrgId);

  const decisionByOffice = new Map(
    (decisions ?? []).map((row) => [
      row.office_employee_id as string,
      row as {
        office_employee_id: string;
        decision: "link" | "create" | "skip";
        directory_employee_id: string | null;
        match_method: string | null;
      },
    ])
  );

  const organic = ((organicRows ?? []) as Array<
    DirectorySide & {
      position?: { job_title?: string | null } | { job_title?: string | null }[] | null;
    }
  >).map((row) => {
    const pos = row.position;
    const jobTitle = Array.isArray(pos)
      ? pos[0]?.job_title ?? null
      : pos?.job_title ?? null;
    const { position: _drop, ...rest } = row;
    return { ...rest, job_title: jobTitle } as DirectorySide;
  });
  const organicById = new Map(organic.map((row) => [row.id, row]));

  const cases: ReconcileCase[] = [];
  for (const raw of officeRows ?? []) {
    const office = raw as OfficeSide;
    const candidates = matchOfficeToOrganic(office, organic);
    const current = office.directory_employee_id
      ? organicById.get(office.directory_employee_id) ?? null
      : null;
    const decided = decisionByOffice.get(office.id) ?? null;
    const { needs_review, reason } = reviewReason(office, candidates, current);
    cases.push({
      office,
      candidates,
      current_link: current,
      decision: decided?.decision ?? null,
      needs_review: decided?.decision === "skip" ? false : needs_review,
      review_reason:
        decided?.decision === "skip"
          ? "Skipped by HR"
          : decided?.decision
            ? `Already decided: ${decided.decision}`
            : reason,
    });
  }

  const summary = {
    office_total: cases.length,
    needs_review: cases.filter((c) => c.needs_review && !c.decision).length,
    decided: cases.filter((c) => c.decision).length,
    skipped: cases.filter((c) => c.decision === "skip").length,
    linked: cases.filter((c) => c.decision === "link").length,
    created: cases.filter((c) => c.decision === "create").length,
  };

  return { cases, organicOrgId, organicClientId, summary };
}

export function publicAndDirectoryClients(url: string, serviceKey: string) {
  const publicDb = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const directory = publicDb.schema("directory");
  return { publicDb, directory };
}

export { displayDirName };
