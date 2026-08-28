import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  buildOfficePatchFromDirectory,
  DIRECTORY_EMPLOYEE_SYNC_SELECT,
} from "@/lib/directory/office-from-directory-sync";
import {
  buildOfficeOrganicCases,
  type MatchMethod,
  type ReconcileCase,
} from "@/lib/directory/office-organic-reconcile";

export const dynamic = "force-dynamic";

const ORGANIC_ORG_NAME = "Organic";

function filterReconcileCases(
  cases: ReconcileCase[],
  params: {
    needsReviewOnly: boolean;
    q?: string;
    decision?: string;
  }
): ReconcileCase[] {
  let rows = cases;

  if (params.needsReviewOnly) {
    rows = rows.filter((row) => row.needs_review && !row.decision);
  }

  if (params.decision === "pending") {
    rows = rows.filter((row) => !row.decision);
  } else if (params.decision === "decided") {
    rows = rows.filter((row) => Boolean(row.decision));
  } else if (
    params.decision === "link" ||
    params.decision === "create" ||
    params.decision === "skip"
  ) {
    rows = rows.filter((row) => row.decision === params.decision);
  }

  if (params.q) {
    const q = params.q.toLowerCase();
    rows = rows.filter(
      (row) =>
        row.office.full_name?.toLowerCase().includes(q) ||
        row.office.employee_id?.toLowerCase().includes(q) ||
        row.current_link?.employee_code?.toLowerCase().includes(q) ||
        row.current_link?.last_name?.toLowerCase().includes(q) ||
        row.current_link?.first_name?.toLowerCase().includes(q)
    );
  }

  return rows;
}

async function resolveOrganicOrgId(
  directory: ReturnType<ReturnType<typeof createClient>["schema"]>
) {
  const { data, error } = await directory
    .from("organizations")
    .select("id, name")
    .ilike("name", ORGANIC_ORG_NAME)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

export async function GET(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.userId) {
    return jsonError("Browser Admin/HR session required for reconcile", 403);
  }

  try {
    const organicOrgId = await resolveOrganicOrgId(auth.supabase);
    if (!organicOrgId) return jsonError("Organic organization not found", 404);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return jsonError("Supabase env missing", 500);

    const publicDb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const onlyReview =
      request.nextUrl.searchParams.get("needs_review") !== "0";
    const q = request.nextUrl.searchParams.get("q")?.trim();
    const decision = request.nextUrl.searchParams.get("decision") ?? undefined;
    const limit = Math.min(
      Number(request.nextUrl.searchParams.get("limit") ?? 20),
      100
    );
    const offset = Math.max(
      Number(request.nextUrl.searchParams.get("offset") ?? 0),
      0
    );

    const built = await buildOfficeOrganicCases(
      publicDb,
      auth.supabase,
      organicOrgId
    );

    const filtered = filterReconcileCases(built.cases, {
      needsReviewOnly: onlyReview,
      q,
      decision,
    });
    const cases = filtered.slice(offset, offset + limit);

    return jsonOk({
      data: {
        organic_organization_id: built.organicOrgId,
        organic_client_id: built.organicClientId,
        summary: built.summary,
        cases,
        count: filtered.length,
        limit,
        offset,
      },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Reconcile list failed",
      500
    );
  }
}

type DecisionBody = {
  office_employee_id: string;
  decision: "link" | "create" | "skip";
  directory_employee_id?: string | null;
  match_method?: MatchMethod | string | null;
  /**
   * Which side HR treats as correct for this person.
   * - office: push status (and optional ID) onto Directory
   * - directory: keep Directory fields; optionally pull Directory code onto office
   */
  truth_side?: "office" | "directory";
  /** When truth=office and codes differ: set Directory employee_code = office employee_id */
  adopt_office_employee_id?: boolean;
  /** When truth=directory and codes differ: set office employee_id = Directory employee_code */
  adopt_directory_employee_code?: boolean;
  note?: string | null;
};

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.userId) {
    return jsonError("Browser Admin/HR session required for reconcile", 403);
  }

  const body = (await request.json()) as DecisionBody;
  if (!body.office_employee_id || !body.decision) {
    return jsonError("office_employee_id and decision are required", 400);
  }
  if (!["link", "create", "skip"].includes(body.decision)) {
    return jsonError("decision must be link | create | skip", 400);
  }
  if (body.decision === "link" && !body.directory_employee_id) {
    return jsonError("directory_employee_id is required for link", 400);
  }

  try {
    const organicOrgId = await resolveOrganicOrgId(auth.supabase);
    if (!organicOrgId) return jsonError("Organic organization not found", 404);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return jsonError("Supabase env missing", 500);
    const publicDb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: office, error: officeError } = await publicDb
      .from("employees")
      .select(
        "id, employee_id, full_name, is_active, birth_date, sss_number, tin_number, position, first_name, last_name, middle_initial, directory_employee_id"
      )
      .eq("id", body.office_employee_id)
      .maybeSingle();
    if (officeError) return jsonError(officeError.message, 500);
    if (!office) return jsonError("Office employee not found", 404);

    const { data: clientRow } = await auth.supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organicOrgId)
      .limit(1)
      .maybeSingle();
    const organicClientId = (clientRow?.id as string | undefined) ?? null;

    let directoryEmployeeId = body.directory_employee_id ?? null;
    const truthSide = body.truth_side === "directory" ? "directory" : "office";

    if (body.decision === "skip") {
      // record only
    } else if (body.decision === "create") {
      const nameParts = String(office.full_name ?? "")
        .trim()
        .split(/\s+/);
      const lastName =
        (office.last_name as string | null) ||
        nameParts[nameParts.length - 1] ||
        "UNKNOWN";
      const firstName =
        (office.first_name as string | null) || nameParts[0] || "UNKNOWN";

      const { data: created, error: createError } = await auth.supabase
        .from("employees")
        .insert({
          organization_id: organicOrgId,
          client_id: organicClientId,
          employee_code: office.employee_id,
          last_name: lastName,
          first_name: firstName,
          middle_name: (office.middle_initial as string | null) ?? null,
          birth_date: office.birth_date,
          status: office.is_active ? "active" : "inactive",
          sss_number: office.sss_number,
          tin: office.tin_number,
        })
        .select("id, client_id")
        .single();
      if (createError) return jsonError(createError.message, 400);
      directoryEmployeeId = created.id as string;

      const { error: linkError } = await publicDb
        .from("employees")
        .update({
          directory_employee_id: directoryEmployeeId,
          directory_client_id: (created.client_id as string | null) ?? organicClientId,
        })
        .eq("id", office.id);
      if (linkError) return jsonError(linkError.message, 400);
    } else if (body.decision === "link" && directoryEmployeeId) {
      const { data: dirEmp, error: dirError } = await auth.supabase
        .from("employees")
        .select(DIRECTORY_EMPLOYEE_SYNC_SELECT)
        .eq("id", directoryEmployeeId)
        .eq("organization_id", organicOrgId)
        .maybeSingle();
      if (dirError) return jsonError(dirError.message, 500);
      if (!dirEmp) {
        return jsonError("Directory employee not in Organic", 404);
      }

      if (truthSide === "office") {
        const patch: Record<string, unknown> = {
          status: office.is_active ? "active" : "inactive",
        };
        if (
          body.adopt_office_employee_id &&
          office.employee_id &&
          office.employee_id !== dirEmp.employee_code
        ) {
          patch.employee_code = office.employee_id;
        }
        const { error: patchError } = await auth.supabase
          .from("employees")
          .update(patch)
          .eq("id", directoryEmployeeId)
          .eq("organization_id", organicOrgId);
        if (patchError) return jsonError(patchError.message, 400);
      }

      const officePatch: Record<string, unknown> =
        truthSide === "directory"
          ? buildOfficePatchFromDirectory(dirEmp, {
              organicClientId,
              organicOrgId,
              adoptDirectoryEmployeeCode:
                body.adopt_directory_employee_code !== false,
              currentOfficeEmployeeId: office.employee_id as string | null,
              updatedBy: auth.userId,
            })
          : {
              directory_employee_id: directoryEmployeeId,
              directory_client_id:
                (dirEmp.client_id as string | null) ?? organicClientId,
            };

      const { error: linkError } = await publicDb
        .from("employees")
        .update(officePatch)
        .eq("id", office.id);
      if (linkError) return jsonError(linkError.message, 400);
    }

    const { data: decision, error: decisionError } = await auth.supabase
      .from("office_reconcile_decisions")
      .upsert(
        {
          organization_id: organicOrgId,
          office_employee_id: office.id,
          directory_employee_id: directoryEmployeeId,
          decision: body.decision,
          match_method: body.match_method ?? null,
          note:
            body.note ??
            (body.decision === "link" ? `truth_side=${truthSide}` : null),
          decided_by: auth.userId,
        },
        { onConflict: "organization_id,office_employee_id" }
      )
      .select()
      .single();
    if (decisionError) return jsonError(decisionError.message, 400);

    return jsonOk({
      data: {
        decision,
        directory_employee_id: directoryEmployeeId,
        truth_side: truthSide,
      },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Reconcile decision failed",
      500
    );
  }
}
