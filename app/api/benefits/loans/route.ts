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

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const parsed = parseLoanListQuery(
    Object.fromEntries(request.nextUrl.searchParams.entries())
  );
  if (!parsed.ok) return jsonError(parsed.error, 400);

  const { client_id, q, loan_type, status, limit, offset } = parsed.value;

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
  if (!directoryIds.length) {
    return jsonOk({ data: [], count: 0, limit, offset });
  }

  const publicDb = publicDbClient();
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

  loanRows.sort((a, b) => {
    const terms = Number(a.remaining_terms ?? 0) - Number(b.remaining_terms ?? 0);
    if (terms !== 0) return terms;
    return String(a.id).localeCompare(String(b.id));
  });

  const count = loanRows.length;
  const page = loanRows.slice(offset, offset + limit);
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

  return jsonOk({ data, count, limit, offset });
}
