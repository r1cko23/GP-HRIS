import { NextRequest } from "next/server";
import {
  filterEmployeePatchBySections,
  redactEmployeeRecord,
} from "@/lib/access/employee-sections";
import { loadActorEmployeeSectionAccess } from "@/lib/access/load-actor-employee-sections";
import { requirePeopleEmployeesPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { assertAssignableApprovedPosition } from "@/lib/directory/apply-position-card-rates";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { pickDirectoryEmployeePatch } from "@/lib/directory/employee-patch";
import { matchPositionByTitle } from "@/lib/directory/find-or-create-client-position";
import { normalizeProseTextOrNull } from "@/lib/prose-text";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const { data, error } = await auth.supabase
    .from("employees")
    .select(
      `
      *,
      client:clients(id, name),
      branch:client_branches(id, name, location),
      department:client_departments(id, name),
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Employee not found", 404);
  const access = await loadActorEmployeeSectionAccess(auth);
  return jsonOk({
    data: redactEmployeeRecord(data as Record<string, unknown>, access),
  });
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const { data: current, error: currentError } = await auth.supabase
    .from("employees")
    .select("status, client_id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Employee not found", 404);

  const body = (await request.json()) as Record<string, unknown>;

  // Free-text title → match an approved Client position only (no auto-create).
  if ("job_title" in body) {
    const rawTitle =
      body.job_title === null || body.job_title === undefined
        ? ""
        : String(body.job_title);
    const title = (normalizeProseTextOrNull(rawTitle) ?? rawTitle).trim();
    if (!title) {
      body.position_id = null;
    } else {
      if (!current.client_id) {
        return jsonError("Assign a client before setting position title", 400);
      }
      const { data: cards, error: listError } = await auth.supabase
        .from("positions")
        .select(
          "id, job_title, client_id, is_active, approval_status, payroll_daily_rate, billing_daily_rate, ecola, sea, ctpa"
        )
        .eq("organization_id", orgId)
        .eq("client_id", current.client_id)
        .eq("approval_status", "approved")
        .eq("is_active", true);
      if (listError) return jsonError(listError.message, 500);
      const hit = matchPositionByTitle(cards ?? [], title);
      if (!hit) {
        return jsonError(
          "No approved position matches that title. Create and approve the rate card first.",
          400
        );
      }
      body.position_id = hit.id;
    }
    delete body.job_title;
  }

  const picked = pickDirectoryEmployeePatch(body);
  if (!picked.ok) return jsonError(picked.error, 400);

  const access = await loadActorEmployeeSectionAccess(auth);
  const filtered = filterEmployeePatchBySections(picked.patch, access);
  if (!filtered.ok) return jsonError(filtered.error, 403);
  const patch = filtered.patch;

  if (patch.branch_id) {
    const { data: branch } = await auth.supabase
      .from("client_branches")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", current.client_id)
      .eq("id", patch.branch_id as string)
      .maybeSingle();
    if (!branch) return jsonError("branch_id not in this client", 400);
  }

  if (patch.department_id) {
    const { data: department } = await auth.supabase
      .from("client_departments")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", current.client_id)
      .eq("id", patch.department_id as string)
      .maybeSingle();
    if (!department) return jsonError("department_id not in this client", 400);
  }

  if (patch.position_id) {
    if (!current.client_id) {
      return jsonError("Assign a client before setting position_id", 400);
    }
    const { data: position } = await auth.supabase
      .from("positions")
      .select(
        "id, client_id, is_active, approval_status, payroll_daily_rate, billing_daily_rate, ecola, sea, ctpa"
      )
      .eq("organization_id", orgId)
      .eq("id", patch.position_id as string)
      .maybeSingle();
    const checked = assertAssignableApprovedPosition({
      position: position as never,
      destinationClientId: current.client_id as string,
    });
    if (!checked.ok) return jsonError(checked.error, checked.status);
    patch.daily_rate = checked.rates.daily_rate;
    patch.billing_daily_rate = checked.rates.billing_daily_rate;
    patch.ecola = checked.rates.ecola;
    patch.sea = checked.rates.sea;
    patch.ctpa = checked.rates.ctpa;
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .update(patch)
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select(
      `
      *,
      client:clients(id, name),
      branch:client_branches(id, name, location),
      department:client_departments(id, name),
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Employee not found", 404);

  await emitDirectoryEvent("employee.upserted", {
    organization_id: orgId,
    employee: data,
  });
  if (patch.status && patch.status !== current.status) {
    await emitDirectoryEvent("employee.status_changed", {
      organization_id: orgId,
      employee_id: params.id,
      from: current.status,
      to: patch.status,
    });
  }
  return jsonOk({
    data: redactEmployeeRecord(data as Record<string, unknown>, access),
  });
}
