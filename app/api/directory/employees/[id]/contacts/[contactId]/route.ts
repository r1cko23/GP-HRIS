import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireOrganizationId,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  isEmployeeRef,
  requireDirectoryEmployee,
} from "@/lib/directory/employee-access";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; contactId: string } };

type ContactPatchFields = Partial<
  Record<
    "name" | "relationship" | "phone" | "mobile" | "email" | "address" | "city",
    string | null
  >
>;

function contactPatch(
  body: Record<string, unknown>
): ContactPatchFields | { error: string } {
  const out: ContactPatchFields = {};
  const keys = [
    "name",
    "relationship",
    "phone",
    "mobile",
    "email",
    "address",
    "city",
  ] as const;

  for (const key of keys) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value === null || value === "") {
      out[key] = null;
      continue;
    }
    if (typeof value !== "string") {
      return { error: `${key} must be a string` as const };
    }
    const trimmed = value.trim();
    if (key === "name" && !trimmed) {
      return { error: "name is required" as const };
    }
    out[key] = trimmed || null;
  }

  if (Object.keys(out).length === 0) {
    return { error: "No contact fields to update" as const };
  }
  return out;
}

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const body = (await request.json()) as Record<string, unknown>;
  const fields = contactPatch(body);
  if ("error" in fields) return jsonError(fields.error, 400);

  const { data, error } = await auth.supabase
    .from("employee_contacts")
    .update(fields)
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", params.contactId)
    .select()
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Contact not found", 404);
  return jsonOk({ data });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(_request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const { data, error } = await auth.supabase
    .from("employee_contacts")
    .delete()
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", params.contactId)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Contact not found", 404);
  return jsonOk({ data: { id: data.id } });
}
