import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUSES = new Set([
  "Resolve",
  "Unresolve",
  "Under Investigation",
  "Escalated",
]);

const DATE_FIELDS = [
  "incident_on",
  "ir_submitted_on",
  "nte_issued_on",
  "nte_returned_on",
  "nte_to_hr_on",
  "nod_to_supervisor_on",
  "nod_issued_on",
] as const;

function textField(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function dateField(value: unknown): string | null | "invalid" {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return "invalid";
  }
  return value;
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.viaServiceKey) return jsonError("Forbidden", 403);
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) return jsonError("Missing case", 400);

  const csmCaseId = textField(body.csm_case_id);
  const caseReference = textField(body.case_reference);
  const caseStatus = textField(body.case_status);
  if (!csmCaseId || !/^[0-9a-f-]{36}$/i.test(csmCaseId)) {
    return jsonError("Missing case id", 400);
  }
  if (!caseReference) return jsonError("Missing case reference", 400);
  if (!caseStatus || !STATUSES.has(caseStatus)) {
    return jsonError("Unknown case status", 400);
  }

  const dates: Record<string, string | null> = {};
  for (const field of DATE_FIELDS) {
    const value = dateField(body[field]);
    if (value === "invalid") return jsonError("Dates must be YYYY-MM-DD", 400);
    dates[field] = value;
  }

  const { data: employee, error: employeeError } = await auth.supabase
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();
  if (employeeError) return jsonError(employeeError.message, 500);
  if (!employee) return jsonError("Employee not found", 404);

  const row = {
    organization_id: orgId,
    employee_id: params.id,
    csm_case_id: csmCaseId,
    case_reference: caseReference,
    incident_text: textField(body.incident_text),
    alleged_offense: textField(body.alleged_offense),
    rule_number: textField(body.rule_number),
    section_label: textField(body.section_label),
    violation: textField(body.violation),
    case_status: caseStatus,
    remarks: textField(body.remarks),
    notes: textField(body.notes),
    client_name: textField(body.client_name),
    updated_at: new Date().toISOString(),
    ...dates,
  };

  const { data, error } = await auth.supabase
    .from("employee_disciplinary_cases")
    .upsert(row, { onConflict: "csm_case_id" })
    .select("id, employee_id, csm_case_id, case_reference")
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data });
}
