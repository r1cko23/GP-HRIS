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

type Ctx = { params: { id: string } };

type ContactFields = {
  name: string;
  relationship: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
};

function contactFields(
  body: Record<string, unknown>
): ContactFields | { error: string } {
  const name =
    typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { error: "name is required" as const };

  const text = (key: string) => {
    const value = body[key];
    if (value === null || value === undefined || value === "") return null;
    return typeof value === "string" ? value.trim() || null : null;
  };

  return {
    name,
    relationship: text("relationship"),
    phone: text("phone"),
    mobile: text("mobile"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
  };
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id,
    request.nextUrl.searchParams.get("client_id")
  );
  if (!isEmployeeRef(employee)) return employee;

  const { data, error } = await auth.supabase
    .from("employee_contacts")
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
  const orgId = requireOrganizationId(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireDirectoryEmployee(
    auth.supabase,
    orgId,
    params.id
  );
  if (!isEmployeeRef(employee)) return employee;

  const body = (await request.json()) as Record<string, unknown>;
  const fields = contactFields(body);
  if ("error" in fields) return jsonError(fields.error, 400);

  const { data, error } = await auth.supabase
    .from("employee_contacts")
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
