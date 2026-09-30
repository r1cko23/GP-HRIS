import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { resolveLoanDisplayPerson } from "@/lib/loans/display-person";
import {
  filterLoansByCreator,
  loanCreatorChoices,
  type LoanCreator,
  type LoanInsertAttribution,
} from "@/lib/loans/loan-creators";
import { parseLoanListQuery } from "@/lib/loans/list-query";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

const PEOPLE_PAGE = 200;

type DirectoryPersonRow = {
  id: string;
  client_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
};

function sanitizeIlike(value: string): string {
  return value.replace(/[%_,]/g, " ").trim();
}

async function loadClientPeople(
  directory: ReturnType<typeof directoryClient>,
  orgId: string,
  clientId: string,
  q: string
): Promise<DirectoryPersonRow[]> {
  const people: DirectoryPersonRow[] = [];
  const needle = sanitizeIlike(q);
  for (let offset = 0; ; offset += PEOPLE_PAGE) {
    let query = directory
      .from("employees")
      .select("id, client_id, employee_code, last_name, first_name")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("is_current_engagement", true)
      .order("last_name")
      .range(offset, offset + PEOPLE_PAGE - 1);
    if (needle) {
      query = query.or(
        `last_name.ilike.%${needle}%,first_name.ilike.%${needle}%,employee_code.ilike.%${needle}%`
      );
    }
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as DirectoryPersonRow[];
    people.push(...chunk);
    if (chunk.length < PEOPLE_PAGE) break;
  }
  return people;
}

function createdByFromAudit(newValues: unknown): string | null {
  if (!newValues || typeof newValues !== "object") return null;
  const value = (newValues as { created_by?: unknown }).created_by;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

async function loadClientLoanCreators(
  publicDb: ReturnType<typeof publicDbClient>,
  directoryIds: string[]
): Promise<{ creators: LoanCreator[]; creatorByLoanId: Map<string, string> }> {
  if (!directoryIds.length) {
    return { creators: [], creatorByLoanId: new Map() };
  }

  const directorySet = new Set(directoryIds);
  const { data: inserts, error: insertError } = await publicDb
    .from("audit_logs")
    .select("record_id, new_values")
    .eq("table_name", "employee_loans")
    .eq("action", "INSERT")
    .not("new_values->>created_by", "is", null);
  if (insertError) throw new Error(insertError.message);

  const auditByLoan = new Map<string, string>();
  const recordIds: string[] = [];
  for (const row of inserts ?? []) {
    const loanId = row.record_id as string | null;
    const createdBy = createdByFromAudit(row.new_values);
    if (!loanId || !createdBy) continue;
    auditByLoan.set(loanId, createdBy);
    recordIds.push(loanId);
  }

  const attributions: LoanInsertAttribution[] = [];
  const seen = new Set<string>();
  if (recordIds.length) {
    const { data: owned, error: ownedError } = await publicDb
      .from("employee_loans")
      .select("id, directory_employee_id")
      .in("id", recordIds);
    if (ownedError) throw new Error(ownedError.message);
    for (const row of owned ?? []) {
      const directoryId = row.directory_employee_id as string | null;
      if (!directoryId || !directorySet.has(directoryId)) continue;
      const createdBy = auditByLoan.get(row.id as string) ?? null;
      attributions.push({ loanId: row.id as string, createdBy });
      seen.add(row.id as string);
    }
  }

  for (let i = 0; i < directoryIds.length; i += PEOPLE_PAGE) {
    const idChunk = directoryIds.slice(i, i + PEOPLE_PAGE);
    const { data: live, error: liveError } = await publicDb
      .from("employee_loans")
      .select("id, created_by")
      .in("directory_employee_id", idChunk)
      .not("created_by", "is", null);
    if (liveError) throw new Error(liveError.message);
    for (const row of live ?? []) {
      const loanId = row.id as string;
      if (seen.has(loanId)) continue;
      const createdBy = typeof row.created_by === "string" ? row.created_by : null;
      attributions.push({ loanId, createdBy });
    }
  }

  const draft = loanCreatorChoices(attributions, []);
  if (!draft.creators.length) return draft;

  const { data: users, error: userError } = await publicDb
    .from("users")
    .select("id, full_name")
    .in(
      "id",
      draft.creators.map((creator) => creator.id)
    );
  if (userError) throw new Error(userError.message);

  return loanCreatorChoices(
    attributions,
    (users ?? []).map((user) => ({
      id: user.id as string,
      name: (user.full_name as string | null) ?? null,
    }))
  );
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const parsed = parseLoanListQuery(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { client_id, q, loan_type, status, created_by, limit, offset } = parsed.value;

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("id")
    .eq("id", client_id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found in organization", 404);

  let people: DirectoryPersonRow[];
  try {
    people = await loadClientPeople(directoryClient(), orgId, client_id, q);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to load people", 500);
  }

  const personById = new Map(people.map((row) => [row.id, row]));
  const directoryIds = people.map((row) => row.id);
  const publicDb = publicDbClient();

  let rosterIds = directoryIds;
  if (q) {
    try {
      const roster = await loadClientPeople(directoryClient(), orgId, client_id, "");
      rosterIds = roster.map((row) => row.id);
    } catch (err) {
      return jsonError(err instanceof Error ? err.message : "Failed to load people", 500);
    }
  }

  let creators: LoanCreator[] = [];
  let creatorByLoanId = new Map<string, string>();
  try {
    const loaded = await loadClientLoanCreators(publicDb, rosterIds);
    creators = loaded.creators;
    creatorByLoanId = loaded.creatorByLoanId;
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Failed to load loan creators", 500);
  }

  if (!directoryIds.length) {
    return jsonOk({ data: [], count: 0, limit, offset, creators });
  }
  const loanRows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < directoryIds.length; i += PEOPLE_PAGE) {
    const idChunk = directoryIds.slice(i, i + PEOPLE_PAGE);
    let query = publicDb
      .from("employee_loans")
      .select(
        "id, employee_id, directory_employee_id, loan_type, particular, original_balance, current_balance, monthly_payment, total_terms, remaining_terms, effectivity_date, cutoff_assignment, deduct_bi_monthly, is_active, payment_term, notes"
      )
      .in("directory_employee_id", idChunk)
      .order("remaining_terms", { ascending: true });
    if (loan_type) query = query.eq("loan_type", loan_type);
    if (status === "active") query = query.eq("is_active", true);
    if (status === "inactive") query = query.eq("is_active", false);
    const { data, error } = await query;
    if (error) return jsonError(error.message, 500);
    loanRows.push(...((data ?? []) as Array<Record<string, unknown>>));
  }

  const loanList: Array<Record<string, unknown> & { id: string }> = loanRows.map(
    (row) => ({
      ...row,
      id: String(row.id),
    })
  );
  const visibleLoans = filterLoansByCreator(loanList, creatorByLoanId, created_by);

  visibleLoans.sort((a, b) => {
    const terms = Number(a.remaining_terms ?? 0) - Number(b.remaining_terms ?? 0);
    if (terms !== 0) return terms;
    return String(a.id).localeCompare(String(b.id));
  });

  const count = visibleLoans.length;
  const page = visibleLoans.slice(offset, offset + limit);
  const pageIds = page.map((row) => row.id as string);

  const nextByLoan = new Map<string, { period_start: string; amount: number }>();
  if (pageIds.length) {
    const { data: schedules, error: scheduleError } = await publicDb
      .from("employee_loan_schedules")
      .select("loan_id, period_start, amount")
      .in("loan_id", pageIds)
      .eq("status", "pending")
      .order("period_start");
    if (scheduleError) return jsonError(scheduleError.message, 500);
    for (const row of schedules ?? []) {
      const loanId = row.loan_id as string;
      if (nextByLoan.has(loanId)) continue;
      nextByLoan.set(loanId, {
        period_start: String(row.period_start),
        amount: Number(row.amount) || 0,
      });
    }
  }

  const data = page.map((row) => {
    const directoryId = (row.directory_employee_id as string | null) ?? null;
    const directory = directoryId ? personById.get(directoryId) ?? null : null;
    const person = resolveLoanDisplayPerson({
      directoryEmployeeId: directoryId,
      officeEmployeeId: (row.employee_id as string | null) ?? null,
      directory: directory ?? null,
      office: null,
    });
    const next = nextByLoan.get(row.id as string);
    return {
      ...row,
      person,
      next_due: next?.period_start ?? null,
      next_due_amount: next?.amount ?? null,
    };
  });

  return jsonOk({ data, count, limit, offset, creators });
}
