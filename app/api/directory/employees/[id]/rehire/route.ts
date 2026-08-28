import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { syncOfficeEmployeesAfterDirectoryRehire } from "@/lib/directory/sync-office-after-rehire";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function asOptionalUuid(value: unknown, field: string): string | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return { error: `${field} must be a uuid string or null` };
  return value;
}

function asOptionalNumber(value: unknown, field: string): number | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return { error: `${field} must be a number` };
  return n;
}

/**
 * Rehire updates the existing person master (ADR 0006).
 * Does not create a new employee or change employee_code.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const hireDate =
    typeof body.hire_date === "string" && body.hire_date.trim()
      ? body.hire_date.trim()
      : null;
  if (!hireDate || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return jsonError("hire_date is required (YYYY-MM-DD)", 400);
  }

  const clientIdRaw = asOptionalUuid(body.client_id, "client_id");
  if (clientIdRaw && typeof clientIdRaw === "object" && "error" in clientIdRaw) {
    return jsonError(clientIdRaw.error, 400);
  }
  const branchIdRaw = asOptionalUuid(body.branch_id, "branch_id");
  if (branchIdRaw && typeof branchIdRaw === "object" && "error" in branchIdRaw) {
    return jsonError(branchIdRaw.error, 400);
  }
  const positionIdRaw = asOptionalUuid(body.position_id, "position_id");
  if (positionIdRaw && typeof positionIdRaw === "object" && "error" in positionIdRaw) {
    return jsonError(positionIdRaw.error, 400);
  }
  const dailyRate = asOptionalNumber(body.daily_rate, "daily_rate");
  if (dailyRate && typeof dailyRate === "object" && "error" in dailyRate) {
    return jsonError(dailyRate.error, 400);
  }
  const billingRate = asOptionalNumber(
    body.billing_daily_rate,
    "billing_daily_rate"
  );
  if (billingRate && typeof billingRate === "object" && "error" in billingRate) {
    return jsonError(billingRate.error, 400);
  }
  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;

  const { data: current, error: currentError } = await auth.supabase
    .from("employees")
    .select(
      "id, status, client_id, branch_id, position_id, hire_date, first_hire_date, employee_code, is_current_engagement, superseded_by, daily_rate, billing_daily_rate"
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Employee not found", 404);

  if (current.is_current_engagement === false) {
    return jsonError(
      current.superseded_by
        ? `This is a superseded engagement. Rehire on the current master (${current.superseded_by}).`
        : "This is a superseded engagement. Open the current master 201 to rehire.",
      400
    );
  }

  const force =
    body.force === true ||
    body.force === "1" ||
    body.force === "true";
  if (current.status !== "inactive" && !force) {
    return jsonError(
      "Rehire is only for inactive people. Use Activate for float / barred / verification, or Complete / Cancel release for for_release.",
      400
    );
  }

  const nextClientId =
    (clientIdRaw as string | null) ?? (current.client_id as string | null);
  if (!nextClientId) {
    return jsonError("client_id is required for rehire", 400);
  }

  const { data: client, error: clientError } = await auth.supabase
    .from("clients")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", nextClientId)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);
  if (!client) return jsonError("Client not found in this organization", 400);

  const nextBranchId =
    body.branch_id !== undefined
      ? (branchIdRaw as string | null)
      : (current.branch_id as string | null);
  const nextPositionId =
    body.position_id !== undefined
      ? (positionIdRaw as string | null)
      : (current.position_id as string | null);

  if (nextBranchId) {
    const { data: branch } = await auth.supabase
      .from("client_branches")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", nextClientId)
      .eq("id", nextBranchId)
      .maybeSingle();
    if (!branch) return jsonError("branch_id not in this client", 400);
  }

  if (nextPositionId) {
    const { data: position } = await auth.supabase
      .from("positions")
      .select("id")
      .eq("organization_id", orgId)
      .eq("client_id", nextClientId)
      .eq("id", nextPositionId)
      .maybeSingle();
    if (!position) return jsonError("position_id not in this client", 400);
  }

  const firstHire =
    (current.first_hire_date as string | null) ??
    (current.hire_date as string | null) ??
    hireDate;

  const patch: Record<string, unknown> = {
    status: "active",
    hire_date: hireDate,
    first_hire_date: firstHire,
    resign_date: null,
    client_id: nextClientId,
    branch_id: nextBranchId,
    position_id: nextPositionId,
    is_current_engagement: true,
    legacy_final_pay_status: null,
    updated_at: new Date().toISOString(),
  };

  if (body.daily_rate !== undefined) {
    patch.daily_rate = dailyRate as number | null;
  }
  if (body.billing_daily_rate !== undefined) {
    patch.billing_daily_rate = billingRate as number | null;
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
      position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
    `
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Employee not found", 404);

  const movementRemarks = [
    "REHIRED — updated existing person master (no new employee_code).",
    current.employee_code ? `code=${current.employee_code}` : null,
    `from_status=${current.status}`,
    remarks,
  ]
    .filter(Boolean)
    .join(" · ");

  await auth.supabase.from("employee_movements").insert({
    organization_id: orgId,
    employee_id: params.id,
    date_from: hireDate,
    date_to: null,
    status: "REHIRED",
    remarks: movementRemarks,
  });

  const officeSync = await syncOfficeEmployeesAfterDirectoryRehire(
    {
      id: params.id,
      organization_id: orgId,
      client_id: data.client_id as string | null,
      branch_id: data.branch_id as string | null,
      position_id: data.position_id as string | null,
      hire_date: data.hire_date as string | null,
      daily_rate: data.daily_rate as number | string | null,
      billing_daily_rate: data.billing_daily_rate as number | string | null,
      position: data.position as
        | { job_title?: string | null }
        | { job_title?: string | null }[]
        | null,
    },
    { updatedBy: auth.userId }
  );

  await emitDirectoryEvent("employee.upserted", {
    organization_id: orgId,
    employee: data,
  });
  await emitDirectoryEvent("employee.status_changed", {
    organization_id: orgId,
    employee_id: params.id,
    from: current.status,
    to: "active",
  });
  await emitDirectoryEvent("employee.rehired", {
    organization_id: orgId,
    employee_id: params.id,
    hire_date: hireDate,
    employee_code: current.employee_code,
    office_rows_updated: officeSync.updated,
  });

  return jsonOk({
    data,
    office_sync: {
      updated: officeSync.updated,
      ...(officeSync.error ? { warning: officeSync.error } : {}),
    },
  });
}
