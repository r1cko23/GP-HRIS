import { NextRequest } from "next/server";
import { sectionForChildSheet } from "@/lib/access/employee-sections";
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
import {
  DIRECTORY_CHILD_SHEETS,
  isChildSheetKey,
  parseChildSheetBody,
} from "@/lib/directory/child-sheets";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string; sheetKey: string } };

async function gateSheet(
  auth: Awaited<ReturnType<typeof resolveDirectoryAuth>>,
  sheetKey: string
) {
  if (isAuthResponse(auth)) return auth;
  if (!isChildSheetKey(sheetKey)) {
    return jsonError("Unknown sheet", 404);
  }
  const section = sectionForChildSheet(sheetKey);
  if (!section) return jsonError("Unknown sheet", 404);
  const sectionGate = await requireEmployeeSection(auth, section);
  if ("error" in sectionGate) return sectionGate.error;
  return null;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const denied = await gateSheet(auth, params.sheetKey);
  if (denied) return denied;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id,
    request.nextUrl.searchParams.get("client_id")
  );
  if (!isEmployeeRef(employee)) return employee;

  const config = DIRECTORY_CHILD_SHEETS[params.sheetKey as keyof typeof DIRECTORY_CHILD_SHEETS];
  const { data, error } = await auth.supabase
    .from(config.table)
    .select("*")
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const denied = await gateSheet(auth, params.sheetKey);
  if (denied) return denied;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const config = DIRECTORY_CHILD_SHEETS[params.sheetKey as keyof typeof DIRECTORY_CHILD_SHEETS];
  const body = (await request.json()) as Record<string, unknown>;
  const fields = parseChildSheetBody(config, body);
  if ("error" in fields) return jsonError(String(fields.error), 400);

  const { data, error } = await auth.supabase
    .from(config.table)
    .insert({
      organization_id: orgId,
      employee_id: params.id,
      ...fields,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 400);
  return jsonOk({ data }, 201);
}
