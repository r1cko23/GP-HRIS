/**
 * Pure Engagement transition planners — the test surface for status/movement rules.
 * DB orchestration lives in engagement.ts.
 */

import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";
import { isEmployeeStatus, type EmployeeStatus } from "./employees";

export type EngagementRow = {
  id: string;
  status: string;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  hire_date: string | null;
  first_hire_date: string | null;
  resign_date: string | null;
  employee_code: string | null;
  is_current_engagement: boolean | null;
  superseded_by: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
};

export type EngagementFailure = { ok: false; error: string; status: 400 | 404 };

export type PlannedMovement = {
  status: string;
  remarks: string;
  date_from: string;
};

export type PlannedUpdate = {
  patch: Record<string, unknown>;
  movement: PlannedMovement;
  from_status: string;
  action: string;
};

export type PlanResult = { ok: true; plan: PlannedUpdate } | EngagementFailure;

export const LIFECYCLE_ACTIONS = [
  "start_final_pay",
  "complete_final_pay",
  "mark_inactive",
  "set_float",
  "set_barred",
  "set_for_verification",
  "activate",
] as const;

export type LifecycleAction = (typeof LIFECYCLE_ACTIONS)[number];

export function isLifecycleAction(value: string): value is LifecycleAction {
  return (LIFECYCLE_ACTIONS as readonly string[]).includes(value);
}

function requireCurrentMaster(current: EngagementRow): EngagementFailure | null {
  if (current.is_current_engagement === false) {
    return {
      ok: false,
      error: current.superseded_by
        ? `This is a superseded engagement. Open the current master (${current.superseded_by}).`
        : "Lifecycle actions only apply to the current engagement master.",
      status: 400,
    };
  }
  return null;
}

export function planLifecycle(input: {
  current: EngagementRow;
  action: LifecycleAction;
  remarks?: string | null;
  resign_date?: string | null;
  today?: string;
}): PlanResult {
  const today = input.today ?? new Date().toISOString().slice(0, 10);
  const masterErr = requireCurrentMaster(input.current);
  if (masterErr) return masterErr;

  const remarks = input.remarks?.trim() || null;
  const resignDate = input.resign_date?.trim() || null;
  const current = input.current;
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  let movementStatus = input.action.toUpperCase();
  let movementRemarks = remarks;

  switch (input.action) {
    case "start_final_pay": {
      if (current.status === "inactive") {
        return {
          ok: false,
          error: "Person is already inactive. Use Rehire to return.",
          status: 400,
        };
      }
      patch.status = "for_release";
      patch.resign_date = resignDate ?? current.resign_date ?? today;
      movementStatus = "FOR_RELEASE";
      movementRemarks =
        remarks ??
        "Started final pay / for release — off the regular cutoff; final pay is a separate run.";
      break;
    }
    case "complete_final_pay": {
      if (current.status !== "for_release" && current.status !== "active") {
        return {
          ok: false,
          error:
            "Complete final pay from for_release (or active if already processed).",
          status: 400,
        };
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
        return {
          ok: false,
          error:
            "Use Rehire to return an inactive person (keeps employee code).",
          status: 400,
        };
      }
      if (
        current.status !== "float" &&
        current.status !== "for_verification" &&
        current.status !== "barred" &&
        current.status !== "for_release"
      ) {
        return {
          ok: false,
          error:
            "Activate is for float / verification / barred / for_release clearance.",
          status: 400,
        };
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
    return { ok: false, error: "Invalid resulting status", status: 400 };
  }

  return {
    ok: true,
    plan: {
      patch,
      movement: {
        status: movementStatus,
        remarks: movementRemarks ?? input.action,
        date_from: today,
      },
      from_status: current.status,
      action: input.action,
    },
  };
}

export function planRehire(input: {
  current: EngagementRow;
  hire_date: string;
  client_id: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate?: number | null;
  billing_daily_rate?: number | null;
  remarks?: string | null;
  force?: boolean;
  /** Admin-only when force is true */
  actorIsAdmin?: boolean;
}): PlanResult {
  const masterErr = requireCurrentMaster(input.current);
  if (masterErr) return masterErr;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.hire_date)) {
    return {
      ok: false,
      error: "hire_date is required (YYYY-MM-DD)",
      status: 400,
    };
  }

  const force = Boolean(input.force);
  if (force && !input.actorIsAdmin) {
    return {
      ok: false,
      error: "force rehire is Admin-only",
      status: 400,
    };
  }
  if (input.current.status !== "inactive" && !force) {
    return {
      ok: false,
      error:
        "Rehire is only for inactive people. Use Activate for float / barred / verification, or Complete / Cancel release for for_release.",
      status: 400,
    };
  }

  const nextClientId = input.client_id ?? input.current.client_id;
  if (!nextClientId) {
    return { ok: false, error: "client_id is required for rehire", status: 400 };
  }

  const firstHire =
    input.current.first_hire_date ??
    input.current.hire_date ??
    input.hire_date;

  const patch: Record<string, unknown> = {
    status: "active" satisfies EmployeeStatus,
    hire_date: input.hire_date,
    first_hire_date: firstHire,
    resign_date: null,
    client_id: nextClientId,
    branch_id:
      input.branch_id !== undefined
        ? input.branch_id
        : input.current.branch_id,
    position_id:
      input.position_id !== undefined
        ? input.position_id
        : input.current.position_id,
    is_current_engagement: true,
    legacy_final_pay_status: null,
    updated_at: new Date().toISOString(),
  };

  if (input.daily_rate !== undefined) {
    patch.daily_rate =
      input.daily_rate == null ? null : roundDailyRate4(Number(input.daily_rate));
  }
  if (input.billing_daily_rate !== undefined) {
    patch.billing_daily_rate =
      input.billing_daily_rate == null
        ? null
        : roundDailyRate4(Number(input.billing_daily_rate));
  }

  const movementRemarks = [
    "REHIRED — updated existing person master (no new employee_code).",
    input.current.employee_code ? `code=${input.current.employee_code}` : null,
    `from_status=${input.current.status}`,
    input.remarks?.trim() || null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    ok: true,
    plan: {
      patch,
      movement: {
        status: "REHIRED",
        remarks: movementRemarks,
        date_from: input.hire_date,
      },
      from_status: input.current.status,
      action: "rehire",
    },
  };
}

export function planTransfer(input: {
  current: EngagementRow;
  client_id: string;
  branch_id?: string | null;
  position_id?: string | null;
  effective_date?: string;
  remarks?: string | null;
  from_client_name?: string | null;
  to_client_name?: string | null;
}): PlanResult {
  const masterErr = requireCurrentMaster(input.current);
  if (masterErr) return masterErr;

  if (input.current.status === "inactive") {
    return {
      ok: false,
      error: "Inactive people must use Rehire (not Transfer) to return.",
      status: 400,
    };
  }

  if (input.current.client_id === input.client_id) {
    return {
      ok: false,
      error:
        "Person is already on this client. Change branch/position via Edit.",
      status: 400,
    };
  }

  const effectiveDate =
    input.effective_date && /^\d{4}-\d{2}-\d{2}$/.test(input.effective_date)
      ? input.effective_date
      : new Date().toISOString().slice(0, 10);

  const patch: Record<string, unknown> = {
    client_id: input.client_id,
    branch_id: input.branch_id ?? null,
    position_id: input.position_id ?? null,
    updated_at: new Date().toISOString(),
  };
  if (
    input.current.status === "float" ||
    input.current.status === "for_verification"
  ) {
    patch.status = "active";
  }

  const fromName = input.from_client_name ?? "previous client";
  const toName = input.to_client_name ?? "new client";

  return {
    ok: true,
    plan: {
      patch,
      movement: {
        status: "TRANSFERRED",
        remarks:
          input.remarks?.trim() ||
          `Transferred ${fromName} → ${toName}. Employee ID unchanged (${input.current.employee_code}).`,
        date_from: effectiveDate,
      },
      from_status: input.current.status,
      action: "transfer",
    },
  };
}
