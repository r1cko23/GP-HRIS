import type { SupabaseClient } from "@supabase/supabase-js";
import { emitDirectoryEvent } from "@/lib/directory/events";
import {
  type EngagementRow,
  type LifecycleAction,
  planLifecycle,
  planRehire,
  planTransfer,
} from "@/lib/directory/engagement-transitions";
import {
  maybeAutoEnrollAfterEngagement,
  type EnrollmentResult,
} from "@/lib/directory/bundy-enrollment";
import { planImportedEmployeeIdentity } from "@/lib/directory/employee-code";
import {
  collapseFromRequestedMaster,
  hireConflictMessage,
  isUsableSss,
  matchExistingPersonForHire,
  type DedupPersonRow,
} from "@/lib/directory/person-dedup";
import { applyCollapsePlans } from "@/lib/directory/person-dedup-apply";
import { isEmployeeStatus } from "@/lib/directory/employees";
import {
  ensureHireTenure,
  freezeCurrentTenure,
  insertOpenedTenure,
  liveFromEmployeeAndPatch,
  liveFromRow,
  syncLiveTenure,
} from "@/lib/directory/tenure-apply";

export type EngagementDeps = {
  directory: SupabaseClient;
  organizationId: string;
  userId?: string | null;
  actorIsAdmin?: boolean;
  /** When false, skip bundy auto-enroll (default true). */
  autoEnroll?: boolean;
};

export type EngagementOutcome<T = unknown> =
  | {
      ok: true;
      data: T;
      enrollment?: EnrollmentResult;
    }
  | {
      ok: false;
      error: string;
      status: number;
      existing_id?: string;
      existing_code?: string | null;
      existing_client_id?: string | null;
      keep_id?: string;
      keep_employee_code?: string | null;
    };

const EMPLOYEE_SELECT = `
  id, status, client_id, branch_id, position_id, hire_date, first_hire_date,
  resign_date, employee_code, is_current_engagement, superseded_by,
  daily_rate, billing_daily_rate, last_payroll_end, current_tenure_id
`;

const EMPLOYEE_DETAIL_SELECT = `
  *,
  client:clients(id, name, bundy_enabled),
  branch:client_branches(id, name, location),
  department:client_departments(id, name),
  position:positions(id, job_title, department, payroll_daily_rate, billing_daily_rate)
`;

async function loadEmployee(
  deps: EngagementDeps,
  employeeId: string
): Promise<EngagementOutcome<EngagementRow>> {
  const { data, error } = await deps.directory
    .from("employees")
    .select(EMPLOYEE_SELECT)
    .eq("organization_id", deps.organizationId)
    .eq("id", employeeId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) return { ok: false, error: "Employee not found", status: 404 };
  return { ok: true, data: data as EngagementRow };
}

async function assertClientInOrg(
  deps: EngagementDeps,
  clientId: string
): Promise<EngagementOutcome<{ id: string; name: string; bundy_enabled?: boolean }>> {
  const { data, error } = await deps.directory
    .from("clients")
    .select("id, name, bundy_enabled")
    .eq("organization_id", deps.organizationId)
    .eq("id", clientId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message, status: 500 };
  if (!data) {
    return { ok: false, error: "Client not found in this organization", status: 400 };
  }
  return {
    ok: true,
    data: data as { id: string; name: string; bundy_enabled?: boolean },
  };
}

async function assertBranchInClient(
  deps: EngagementDeps,
  clientId: string,
  branchId: string
): Promise<EngagementOutcome<true>> {
  const { data } = await deps.directory
    .from("client_branches")
    .select("id")
    .eq("organization_id", deps.organizationId)
    .eq("client_id", clientId)
    .eq("id", branchId)
    .maybeSingle();
  if (!data) return { ok: false, error: "branch_id not in this client", status: 400 };
  return { ok: true, data: true };
}

async function assertPositionInClient(
  deps: EngagementDeps,
  clientId: string,
  positionId: string
): Promise<EngagementOutcome<true>> {
  const { data } = await deps.directory
    .from("positions")
    .select("id")
    .eq("organization_id", deps.organizationId)
    .eq("client_id", clientId)
    .eq("id", positionId)
    .maybeSingle();
  if (!data) {
    return { ok: false, error: "position_id not in this client", status: 400 };
  }
  return { ok: true, data: true };
}

async function applyPlan(
  deps: EngagementDeps,
  employeeId: string,
  plan: {
    patch: Record<string, unknown>;
    movement: { status: string; remarks: string; date_from: string };
  },
  select = EMPLOYEE_DETAIL_SELECT
): Promise<EngagementOutcome<Record<string, unknown>>> {
  const { data, error } = await deps.directory
    .from("employees")
    .update(plan.patch)
    .eq("organization_id", deps.organizationId)
    .eq("id", employeeId)
    .select(select)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, status: 400 };
  if (!data) return { ok: false, error: "Employee not found", status: 404 };

  await deps.directory.from("employee_movements").insert({
    organization_id: deps.organizationId,
    employee_id: employeeId,
    date_from: plan.movement.date_from,
    date_to: null,
    status: plan.movement.status,
    department: null,
    position: null,
    remarks: plan.movement.remarks,
  });

  return { ok: true, data: data as unknown as Record<string, unknown> };
}

async function withAutoEnroll(
  deps: EngagementDeps,
  employee: Record<string, unknown>,
  clientId: string | null
): Promise<EnrollmentResult | undefined> {
  if (deps.autoEnroll === false) return undefined;
  return maybeAutoEnrollAfterEngagement({
    directoryEmployeeId: String(employee.id),
    organizationId: deps.organizationId,
    clientId,
    updatedBy: deps.userId ?? null,
  });
}

export async function engagementLifecycle(
  deps: EngagementDeps,
  employeeId: string,
  input: {
    action: LifecycleAction;
    remarks?: string | null;
    resign_date?: string | null;
    client_latest_payroll_end?: string | null;
  }
): Promise<EngagementOutcome> {
  const loaded = await loadEmployee(deps, employeeId);
  if (!loaded.ok) return loaded;

  let clientLatest = input.client_latest_payroll_end ?? null;
  if (
    input.action === "confirm_still_working" &&
    !clientLatest &&
    loaded.data.client_id
  ) {
    const { data: latestRow } = await deps.directory
      .from("employees")
      .select("last_payroll_end")
      .eq("organization_id", deps.organizationId)
      .eq("client_id", loaded.data.client_id)
      .eq("is_current_engagement", true)
      .not("last_payroll_end", "is", null)
      .gte("last_payroll_end", "2000-01-01")
      .order("last_payroll_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    clientLatest = (latestRow?.last_payroll_end as string | null) ?? null;
  }

  const planned = planLifecycle({
    current: loaded.data,
    action: input.action,
    remarks: input.remarks,
    resign_date: input.resign_date,
    client_latest_payroll_end: clientLatest,
  });
  if (!planned.ok) return planned;

  const applied = await applyPlan(
    deps,
    employeeId,
    planned.plan,
    "id, status, resign_date, hire_date, employee_code, client_id, branch_id, position_id, daily_rate, billing_daily_rate, last_payroll_end, updated_at"
  );
  if (!applied.ok) return applied;

  try {
    await syncLiveTenure({
      deps,
      employeeId,
      live: liveFromEmployeeAndPatch(loaded.data, applied.data),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sync tenure",
      status: 500,
    };
  }

  await emitDirectoryEvent("employee.status_changed", {
    organization_id: deps.organizationId,
    employee_id: employeeId,
    action: input.action,
    from_status: planned.plan.from_status,
    to_status: applied.data.status,
    employee: applied.data,
  });

  return { ok: true, data: applied.data };
}

export async function engagementRehire(
  deps: EngagementDeps,
  employeeId: string,
  input: {
    hire_date: string;
    client_id?: string | null;
    branch_id?: string | null;
    position_id?: string | null;
    daily_rate?: number | null;
    billing_daily_rate?: number | null;
    remarks?: string | null;
    force?: boolean;
  }
): Promise<EngagementOutcome> {
  const loaded = await loadEmployee(deps, employeeId);
  if (!loaded.ok) return loaded;

  const nextClientId = input.client_id ?? loaded.data.client_id;
  if (!nextClientId) {
    return { ok: false, error: "client_id is required for rehire", status: 400 };
  }

  const client = await assertClientInOrg(deps, nextClientId);
  if (!client.ok) return client;

  const nextBranchId =
    input.branch_id !== undefined ? input.branch_id : loaded.data.branch_id;
  const nextPositionId =
    input.position_id !== undefined
      ? input.position_id
      : loaded.data.position_id;

  if (nextBranchId) {
    const branch = await assertBranchInClient(deps, nextClientId, nextBranchId);
    if (!branch.ok) return branch;
  }
  if (nextPositionId) {
    const position = await assertPositionInClient(
      deps,
      nextClientId,
      nextPositionId
    );
    if (!position.ok) return position;
  }

  const planned = planRehire({
    current: loaded.data,
    hire_date: input.hire_date,
    client_id: nextClientId,
    branch_id: nextBranchId,
    position_id: nextPositionId,
    daily_rate: input.daily_rate,
    billing_daily_rate: input.billing_daily_rate,
    remarks: input.remarks,
    force: input.force,
    actorIsAdmin: deps.actorIsAdmin,
  });
  if (!planned.ok) return planned;

  // Only apply rate patches when explicitly provided
  if (input.daily_rate === undefined) delete planned.plan.patch.daily_rate;
  if (input.billing_daily_rate === undefined) {
    delete planned.plan.patch.billing_daily_rate;
  }

  let openedTenure;
  try {
    openedTenure = await freezeCurrentTenure({
      deps,
      employeeId,
      live: loaded.data,
      next: {
        hire_date: input.hire_date,
        client_id: nextClientId,
        branch_id: nextBranchId,
        position_id: nextPositionId,
        daily_rate:
          input.daily_rate !== undefined
            ? input.daily_rate
            : loaded.data.daily_rate ?? null,
        billing_daily_rate:
          input.billing_daily_rate !== undefined
            ? input.billing_daily_rate
            : loaded.data.billing_daily_rate ?? null,
      },
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to freeze prior tenure",
      status: 500,
    };
  }

  const applied = await applyPlan(deps, employeeId, planned.plan);
  if (!applied.ok) return applied;

  try {
    const currentTenureId = await insertOpenedTenure({
      deps,
      employeeId,
      opened: openedTenure,
    });
    const { error: tenureLinkError } = await deps.directory
      .from("employees")
      .update({ current_tenure_id: currentTenureId })
      .eq("id", employeeId)
      .eq("organization_id", deps.organizationId);
    if (tenureLinkError) throw new Error(tenureLinkError.message);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Rehired the 201 but failed to open the new tenure",
      status: 500,
    };
  }

  const enrollment = await withAutoEnroll(
    deps,
    applied.data,
    nextClientId
  );

  await emitDirectoryEvent("employee.upserted", {
    organization_id: deps.organizationId,
    employee: applied.data,
  });
  await emitDirectoryEvent("employee.status_changed", {
    organization_id: deps.organizationId,
    employee_id: employeeId,
    from: planned.plan.from_status,
    to: "active",
  });
  await emitDirectoryEvent("employee.rehired", {
    organization_id: deps.organizationId,
    employee_id: employeeId,
    hire_date: input.hire_date,
    employee_code: loaded.data.employee_code,
    enrollment,
  });

  return { ok: true, data: applied.data, enrollment };
}

export async function engagementTransfer(
  deps: EngagementDeps,
  employeeId: string,
  input: {
    client_id: string;
    branch_id?: string | null;
    position_id?: string | null;
    effective_date?: string;
    remarks?: string | null;
  }
): Promise<EngagementOutcome> {
  const loaded = await loadEmployee(deps, employeeId);
  if (!loaded.ok) return loaded;

  const client = await assertClientInOrg(deps, input.client_id);
  if (!client.ok) return client;

  if (input.branch_id) {
    const branch = await assertBranchInClient(
      deps,
      input.client_id,
      input.branch_id
    );
    if (!branch.ok) return branch;
  }
  if (input.position_id) {
    const position = await assertPositionInClient(
      deps,
      input.client_id,
      input.position_id
    );
    if (!position.ok) return position;
  }

  let fromName: string | null = null;
  if (loaded.data.client_id) {
    const { data: fromClient } = await deps.directory
      .from("clients")
      .select("name")
      .eq("id", loaded.data.client_id)
      .maybeSingle();
    fromName = (fromClient as { name?: string } | null)?.name ?? null;
  }

  const planned = planTransfer({
    current: loaded.data,
    client_id: input.client_id,
    branch_id: input.branch_id,
    position_id: input.position_id,
    effective_date: input.effective_date,
    remarks: input.remarks,
    from_client_name: fromName,
    to_client_name: client.data.name,
  });
  if (!planned.ok) return planned;

  const applied = await applyPlan(
    deps,
    employeeId,
    planned.plan,
    `
      id, status, employee_code, client_id, branch_id, position_id, hire_date,
      client:clients(id, name),
      branch:client_branches(id, name),
      position:positions(id, job_title)
    `
  );
  if (!applied.ok) return applied;

  try {
    await syncLiveTenure({
      deps,
      employeeId,
      live: liveFromEmployeeAndPatch(loaded.data, applied.data),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to sync tenure",
      status: 500,
    };
  }

  await emitDirectoryEvent("employee.transferred", {
    organization_id: deps.organizationId,
    employee_id: employeeId,
    from_client_id: loaded.data.client_id,
    to_client_id: input.client_id,
    employee_code: loaded.data.employee_code,
    employee: applied.data,
  });

  return { ok: true, data: applied.data };
}

export type HireInput = {
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  client_id?: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  employee_code?: string | null;
  hire_date?: string | null;
  status?: string;
  daily_rate?: number | null;
  billing_daily_rate?: number | null;
  sex?: string | null;
  birth_date?: string | null;
  tin?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  email?: string | null;
  mobile?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  force_create?: boolean;
};

export async function engagementHire(
  deps: EngagementDeps,
  input: HireInput
): Promise<EngagementOutcome> {
  if (!input.last_name?.trim() || !input.first_name?.trim()) {
    return {
      ok: false,
      error: "last_name and first_name are required",
      status: 400,
    };
  }
  if (input.status && !isEmployeeStatus(input.status)) {
    return { ok: false, error: "Invalid status", status: 400 };
  }

  const clientId = input.client_id?.trim() || null;
  if (clientId) {
    const client = await assertClientInOrg(deps, clientId);
    if (!client.ok) return client;
  }

  if (isUsableSss(input.sss_number) && !input.force_create) {
    const { data: hits, error: sssError } = await deps.directory.rpc(
      "find_employees_by_sss",
      {
        p_org: deps.organizationId,
        p_sss: input.sss_number,
      }
    );
    if (sssError) {
      return { ok: false, error: sssError.message, status: 500 };
    }
    const match = matchExistingPersonForHire(input, (hits ?? []) as DedupPersonRow[]);
    if (match.action === "conflict") {
      return {
        ok: false,
        error: hireConflictMessage(match),
        status: 409,
        existing_id: match.existing.id,
        existing_code: match.existing.employee_code ?? null,
        existing_client_id: match.existing.client_id ?? null,
      };
    }
  }

  const hireDate = input.hire_date?.trim() || null;
  const identity = planImportedEmployeeIdentity({
    empCode: input.employee_code,
    legacyId: null,
  });
  let employeeCode = identity.liveCode;
  let employeeCodeSource: "legacy" | "directory" = "directory";

  if (!employeeCode) {
    const { data: allocated, error: allocError } = await deps.directory.rpc(
      "allocate_employee_code",
      {
        p_org: deps.organizationId,
        p_hire_date: hireDate ?? new Date().toISOString().slice(0, 10),
      }
    );
    if (allocError) return { ok: false, error: allocError.message, status: 500 };
    if (typeof allocated !== "string" || !allocated) {
      return { ok: false, error: "Failed to allocate employee_code", status: 500 };
    }
    employeeCode = allocated;
  }

  const { data, error } = await deps.directory
    .from("employees")
    .insert({
      organization_id: deps.organizationId,
      client_id: clientId,
      branch_id: input.branch_id ?? null,
      position_id: input.position_id ?? null,
      employee_code: employeeCode,
      employee_code_source: employeeCodeSource,
      last_name: input.last_name,
      first_name: input.first_name,
      middle_name: input.middle_name ?? null,
      sex: input.sex ?? null,
      birth_date: input.birth_date ?? null,
      hire_date: hireDate,
      first_hire_date: hireDate,
      status: input.status ?? "active",
      daily_rate: input.daily_rate ?? null,
      billing_daily_rate: input.billing_daily_rate ?? null,
      tin: input.tin ?? null,
      sss_number: input.sss_number ?? null,
      philhealth_number: input.philhealth_number ?? null,
      pagibig_number: input.pagibig_number ?? null,
      email: input.email ?? null,
      mobile: input.mobile ?? null,
      address: input.address ?? null,
      bank_name: input.bank_name ?? null,
      bank_account_no: input.bank_account_no ?? null,
      gcash: input.gcash ?? null,
      is_current_engagement: true,
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message, status: 400 };

  const createdId = String((data as { id: string }).id);
  for (const alias of identity.aliasCodes) {
    const { error: aliasError } = await deps.directory
      .from("employee_code_aliases")
      .insert({
        organization_id: deps.organizationId,
        employee_id: createdId,
        alias_code: alias,
        source_employee_id: createdId,
        note: "Former typed / MAIN code before YYYYMM-##### allocate",
      });
    if (
      aliasError &&
      aliasError.code !== "23505" &&
      !/unique|duplicate/i.test(aliasError.message)
    ) {
      return { ok: false, error: aliasError.message, status: 500 };
    }
  }

  try {
    await ensureHireTenure({
      deps,
      employeeId: createdId,
      live: liveFromRow({
        hire_date: hireDate,
        resign_date: null,
        client_id: clientId,
        branch_id: input.branch_id ?? null,
        position_id: input.position_id ?? null,
        daily_rate: input.daily_rate ?? null,
        billing_daily_rate: input.billing_daily_rate ?? null,
        status: input.status ?? "active",
        is_current_engagement: true,
      }),
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to seed tenure",
      status: 500,
    };
  }

  const enrollment = await withAutoEnroll(
    deps,
    data as Record<string, unknown>,
    clientId
  );

  await emitDirectoryEvent("employee.upserted", {
    organization_id: deps.organizationId,
    employee: data,
  });

  return { ok: true, data, enrollment };
}

const DEDUP_SELECT =
  "id, organization_id, person_key, employee_code, last_name, first_name, middle_name, birth_date, sss_number, tin, status, hire_date, first_hire_date, resign_date, last_payroll_end, legacy_id, is_current_engagement, superseded_by, client_id, branch_id, position_id, daily_rate";

/**
 * HR-confirmed: park extra 201s under this person. Does not delete.
 */
export async function engagementCollapseDuplicate(
  deps: EngagementDeps,
  masterId: string,
  extraIds: string[]
): Promise<EngagementOutcome> {
  const ids = [...new Set([masterId, ...extraIds.filter(Boolean)])];
  if (ids.length < 2) {
    return { ok: false, error: "extra_id is required", status: 400 };
  }

  const { data, error } = await deps.directory
    .from("employees")
    .select(DEDUP_SELECT)
    .eq("organization_id", deps.organizationId)
    .in("id", ids);
  if (error) return { ok: false, error: error.message, status: 500 };

  const rows = (data ?? []) as DedupPersonRow[];
  if (rows.length !== ids.length) {
    return { ok: false, error: "Employee not found in this organization", status: 404 };
  }

  const requested = collapseFromRequestedMaster(rows, masterId);
  if (!requested.ok) {
    return {
      ok: false,
      error: requested.error,
      status: requested.status,
      keep_id: requested.keep_id,
      keep_employee_code: requested.keep_employee_code,
    };
  }

  await applyCollapsePlans(deps.directory, [requested.plan]);
  const { data: master } = await deps.directory
    .from("employees")
    .select(EMPLOYEE_DETAIL_SELECT)
    .eq("id", masterId)
    .maybeSingle();

  await emitDirectoryEvent("employee.upserted", {
    organization_id: deps.organizationId,
    employee: master,
  });

  return { ok: true, data: master ?? { id: masterId } };
}
