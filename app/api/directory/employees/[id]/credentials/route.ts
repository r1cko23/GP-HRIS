import { NextRequest } from "next/server";
import { requireEmployeeSection } from "@/lib/access/require-employee-section";
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

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

const STATUSES = new Set(["pending", "verified", "rejected", "revoked"]);

function dateValue(value: unknown): string | null | undefined {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  return value;
}

async function authorize(request: NextRequest, employeeId: string) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return { error: auth } as const;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return { error: orgId } as const;
  const sectionGate = await requireEmployeeSection(auth, "documents");
  if ("error" in sectionGate) return { error: sectionGate.error } as const;
  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    employeeId
  );
  if (!isEmployeeRef(employee)) return { error: employee } as const;
  return { auth, orgId } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request, params.id);
  if ("error" in access) return access.error;

  const { data, error } = await access.auth.supabase
    .from("employee_credentials")
    .select(
      "id, credential_definition_id, credential_number, status, issued_on, expires_on, verified_at, verified_by, verification_notes, created_at, updated_at, definition:credential_definitions(id, code, name, description, default_validity_days)"
    )
    .eq("organization_id", access.orgId)
    .eq("employee_id", params.id)
    .order("created_at");
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request, params.id);
  if ("error" in access) return access.error;

  const body = (await request.json()) as Record<string, unknown>;
  const definitionId =
    typeof body.credential_definition_id === "string"
      ? body.credential_definition_id.trim()
      : "";
  const status = typeof body.status === "string" ? body.status : "";
  const issuedOn = dateValue(body.issued_on);
  const expiresOn = dateValue(body.expires_on);
  if (!definitionId) {
    return jsonError("credential_definition_id is required", 400);
  }
  if (!STATUSES.has(status)) return jsonError("Invalid credential status", 400);
  if (issuedOn === undefined || expiresOn === undefined) {
    return jsonError("issued_on and expires_on must be YYYY-MM-DD or null", 400);
  }
  if (issuedOn && expiresOn && expiresOn < issuedOn) {
    return jsonError("expires_on cannot be before issued_on", 400);
  }

  const { data: definition, error: definitionError } =
    await access.auth.supabase
      .from("credential_definitions")
      .select("id")
      .eq("organization_id", access.orgId)
      .eq("id", definitionId)
      .eq("is_active", true)
      .maybeSingle();
  if (definitionError) return jsonError(definitionError.message, 500);
  if (!definition) return jsonError("Credential definition not found", 404);

  const now = new Date().toISOString();
  const credentialNumber =
    typeof body.credential_number === "string" &&
    body.credential_number.trim()
      ? body.credential_number.trim()
      : null;
  const verificationNotes =
    typeof body.verification_notes === "string" &&
    body.verification_notes.trim()
      ? body.verification_notes.trim()
      : null;
  const { data, error } = await access.auth.supabase
    .from("employee_credentials")
    .upsert(
      {
        organization_id: access.orgId,
        employee_id: params.id,
        credential_definition_id: definitionId,
        credential_number: credentialNumber,
        status,
        issued_on: issuedOn,
        expires_on: expiresOn,
        verified_at: status === "verified" ? now : null,
        verified_by: status === "verified" ? access.auth.userId : null,
        verification_notes: verificationNotes,
        updated_at: now,
      },
      { onConflict: "employee_id,credential_definition_id" }
    )
    .select(
      "id, credential_definition_id, credential_number, status, issued_on, expires_on, verified_at, verified_by, verification_notes, created_at, updated_at"
    )
    .single();
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
