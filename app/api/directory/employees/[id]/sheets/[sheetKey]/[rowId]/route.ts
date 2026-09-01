import { NextRequest } from "next/server";
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
  DIRECTORY_CHILD_SHEETS,
  isChildSheetKey,
  parseChildSheetBody,
} from "@/lib/directory/child-sheets";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; sheetKey: string; rowId: string } };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  if (!isChildSheetKey(params.sheetKey)) {
    return jsonError("Unknown sheet", 404);
  }

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const config = DIRECTORY_CHILD_SHEETS[params.sheetKey];
  const body = (await request.json()) as Record<string, unknown>;
  const fields = parseChildSheetBody(config, body);
  if ("error" in fields) return jsonError(String(fields.error), 400);

  const { data, error } = await auth.supabase
    .from(config.table)
    .update(fields)
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", params.rowId)
    .select()
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Row not found", 404);
  return jsonOk({ data });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(_request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  if (!isChildSheetKey(params.sheetKey)) {
    return jsonError("Unknown sheet", 404);
  }

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const config = DIRECTORY_CHILD_SHEETS[params.sheetKey];
  const { data, error } = await auth.supabase
    .from(config.table)
    .delete()
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", params.rowId)
    .select("id")
    .maybeSingle();

  if (error) return jsonError(error.message, 400);
  if (!data) return jsonError("Row not found", 404);
  return jsonOk({ data: { id: data.id } });
}
