import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { emitDirectoryEvent } from "@/lib/directory/events";
import { isEmployeeStatus } from "@/lib/directory/employees";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const LIFECYCLE_ACTIONS = [
  "start_final_pay",
  "complete_final_pay",
  "mark_inactive",
  "set_float",
  "set_barred",
  "set_for_verification",
  "activate",
] as const;

type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

function isLifecycleAction(value: string): value is LifecycleAction {
  return (LIFECYCLE_ACTIONS as readonly string[]).includes(value);
}

/**
 * Explicit lifecycle transitions for the person master (ADR 0006).
 * Inactive → active must use /rehire (preserves first_hire_date + engagement story).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const action =
    typeof body.action === "string" ? body.action.trim() : "";
  if (!action || !isLifecycleAction(action)) {
    return jsonError(
      `action required. Allowed: ${LIFECYCLE_ACTIONS.join(", ")}`,
      400
    );
  }

  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;
  const resignDate =
    typeof body.resign_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.resign_date.trim())
      ? body.resign_date.trim()
      : null;

  const { data: current, error: currentError } = await auth.supabase
    .from("employees")
    .select(
      "id, status, client_id, hire_date, employee_code, is_current_engagement, superseded_by, resign_date"
    )
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (currentError) return jsonError(currentError.message, 500);
  if (!current) return jsonError("Employee not found", 404);

  if (current.is_current_engagement === false) {
    return jsonError(
      "Lifecycle actions only apply to the current engagement master.",
      400
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  let movementStatus = action.toUpperCase();
  let movementRemarks = remarks;

  switch (action) {
    case "start_final_pay": {
      if (current.status === "inactive") {
        return jsonError("Person is already inactive. Use Rehire to return.", 400);
      }
      patch.status = "for_release";
      patch.resign_date = resignDate ?? current.resign_date ?? today;
      movementStatus = "FOR_RELEASE";
      movementRemarks =
        remarks ??
        "Started final pay / for release — may still appear on one last payroll.";
      break;
    }
    case "complete_final_pay": {
      if (current.status !== "for_release" && current.status !== "active") {
        return jsonError(
          "Complete final pay from for_release (or active if already processed).",
          400
        );
      }
      patch.status = "inactive";
      patch.resign_date = resignDate ?? current.resign_date ?? today;
      movementStatus = "FINAL_PAY_COMPLETED";
      movementRemarks = remarks ?? "Final pay completed — marked inactive.";
      break;
    }
    case "mark_inactive": {
      patch.status = "inactive";
      patch.resign_date = resignDate ?? today;
      movementStatus = "INACTIVE";
      movementRemarks = remarks ?? "Marked inactive (separated / not engaged).";
      break;
    }
    case "set_float": {
      patch.status = "float";
      movementStatus = "FLOAT";
      movementRemarks = remarks ?? "Moved to float pool (between assignments).";
      break;
    }
    case "set_barred": {
      patch.status = "barred";
      movementStatus = "BARRED";
      movementRemarks = remarks ?? "Barred from deployment / payroll.";
      break;
    }
    case "set_for_verification": {
      patch.status = "for_verification";
      movementStatus = "FOR_VERIFICATION";
      movementRemarks = remarks ?? "Pending HR verification.";
      break;
    }
    case "activate": {
      if (current.status === "inactive") {
        return jsonError(
          "Use Rehire to return an inactive person (keeps employee code).",
          400
        );
      }
      if (
        current.status !== "float" &&
        current.status !== "for_verification" &&
        current.status !== "barred" &&
        current.status !== "for_release"
      ) {
        return jsonError(
          "Activate is for float / verification / barred / for_release clearance.",
          400
        );
      }
      patch.status = "active";
      if (current.status === "for_release") {
        patch.resign_date = null;
      }
      movementStatus = "ACTIVATED";
      movementRemarks = remarks ?? `Cleared from ${current.status} → active.`;
      break;
    }
  }

  if (!isEmployeeStatus(String(patch.status))) {
    return jsonError("Invalid resulting status", 500);
  }

  const { data, error } = await auth.supabase
    .from("employees")
    .update(patch)
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .select(
      "id, status, resign_date, hire_date, employee_code, client_id, updated_at"
    )
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Employee not found", 404);

  await auth.supabase.from("employee_movements").insert({
    organization_id: orgId,
    employee_id: params.id,
    date_from: today,
    date_to: null,
    status: movementStatus,
    department: null,
    position: null,
    remarks: movementRemarks,
  });

  await emitDirectoryEvent("employee.status_changed", {
    organization_id: orgId,
    employee_id: params.id,
    action,
    from_status: current.status,
    to_status: data.status,
    employee: data,
  });

  return jsonOk({ data, action });
}
