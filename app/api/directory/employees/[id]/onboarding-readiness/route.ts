import { NextRequest } from "next/server";
import { requireAnyEmployeeSection } from "@/lib/access/require-employee-section";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  isEmployeeRef,
  requireDirectoryEmployee,
} from "@/lib/directory/employee-access";
import {
  computeOnboardingReadiness,
  type CredentialStatus,
  type OnboardingTaskStatus,
} from "@/lib/directory/onboarding-readiness";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type PolicyRow = {
  id: string;
  credential_definition_id: string;
  scope_type: "organization" | "client" | "branch" | "position";
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  is_required: boolean;
  is_blocking: boolean;
  effective_from: string | null;
  effective_until: string | null;
  definition:
    | { id: string; code: string; name: string }
    | Array<{ id: string; code: string; name: string }>
    | null;
};

function definitionOf(row: PolicyRow) {
  return Array.isArray(row.definition) ? row.definition[0] : row.definition;
}

function scopeRank(scope: PolicyRow["scope_type"]): number {
  return { organization: 1, client: 2, branch: 3, position: 4 }[scope];
}

function applies(
  row: PolicyRow,
  employee: {
    client_id: string | null;
    branch_id: string | null;
    position_id: string | null;
  },
  asOf: string
): boolean {
  if (row.effective_from && row.effective_from > asOf) return false;
  if (row.effective_until && row.effective_until < asOf) return false;
  if (row.scope_type === "client") return row.client_id === employee.client_id;
  if (row.scope_type === "branch") return row.branch_id === employee.branch_id;
  if (row.scope_type === "position") {
    return row.position_id === employee.position_id;
  }
  return true;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const sectionGate = await requireAnyEmployeeSection(auth, [
    "core",
    "documents",
  ]);
  if ("error" in sectionGate) return sectionGate.error;

  const employeeRef = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id,
    request.nextUrl.searchParams.get("client_id")
  );
  if (!isEmployeeRef(employeeRef)) return employeeRef;

  const { data: employee, error: employeeError } = await auth.supabase
    .from("employees")
    .select("id, client_id, branch_id, position_id, current_placement_id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .single();
  if (employeeError) return jsonError(employeeError.message, 500);

  const [{ data: taskRows, error: taskError }, { data: policyRows, error: policyError }, { data: credentialRows, error: credentialError }] =
    await Promise.all([
      auth.supabase
        .from("employee_onboarding_tasks")
        .select("id, title, is_required, status, sort_order")
        .eq("organization_id", orgId)
        .eq("employee_id", params.id)
        .order("sort_order")
        .order("created_at"),
      auth.supabase
        .from("credential_requirement_policies")
        .select(
          "id, credential_definition_id, scope_type, client_id, branch_id, position_id, is_required, is_blocking, effective_from, effective_until, definition:credential_definitions(id, code, name)"
        )
        .eq("organization_id", orgId),
      auth.supabase
        .from("employee_credentials")
        .select(
          "id, credential_definition_id, status, issued_on, expires_on"
        )
        .eq("organization_id", orgId)
        .eq("employee_id", params.id),
    ]);

  const firstError = taskError ?? policyError ?? credentialError;
  if (firstError) return jsonError(firstError.message, 500);

  const asOf = new Date().toISOString().slice(0, 10);
  const contextual = ((policyRows ?? []) as unknown as PolicyRow[])
    .filter((row) => applies(row, employee, asOf))
    .sort((a, b) => scopeRank(b.scope_type) - scopeRank(a.scope_type));
  const selectedPolicies = Array.from(
    contextual
      .reduce((map, row) => {
        if (!map.has(row.credential_definition_id)) {
          map.set(row.credential_definition_id, row);
        }
        return map;
      }, new Map<string, PolicyRow>())
      .values()
  );

  const readiness = computeOnboardingReadiness({
    tasks: (taskRows ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title),
      required: Boolean(row.is_required),
      status: row.status as OnboardingTaskStatus,
    })),
    requirements: selectedPolicies.flatMap((row) => {
      const definition = definitionOf(row);
      return definition
        ? [
            {
              definition_id: row.credential_definition_id,
              code: definition.code,
              name: definition.name,
              required: row.is_required,
              blocking: row.is_blocking,
            },
          ]
        : [];
    }),
    credentials: (credentialRows ?? []).map((row) => ({
      id: String(row.id),
      definition_id: String(row.credential_definition_id),
      status: row.status as CredentialStatus,
      issued_on: (row.issued_on as string | null) ?? null,
      expires_on: (row.expires_on as string | null) ?? null,
    })),
    asOf,
  });

  if (employee.current_placement_id && selectedPolicies.length > 0) {
    const evaluations = readiness.credentials.flatMap((evaluation) => {
      const policy = selectedPolicies.find(
        (row) =>
          row.credential_definition_id === evaluation.definition_id
      );
      return policy
        ? [
            {
              organization_id: orgId,
              placement_id: employee.current_placement_id,
              employee_id: params.id,
              policy_id: policy.id,
              credential_definition_id: evaluation.definition_id,
              employee_credential_id: evaluation.employee_credential_id,
              status: evaluation.status,
              is_blocking: evaluation.blocking,
              evaluated_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ]
        : [];
    });
    const { error: evaluationError } = await auth.supabase
      .from("placement_credential_evaluations")
      .upsert(evaluations, { onConflict: "placement_id,policy_id" });
    if (evaluationError) return jsonError(evaluationError.message, 500);
  }

  return jsonOk({ data: readiness });
}
