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

async function authorize(request: NextRequest, employeeId: string) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return { error: auth } as const;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return { error: orgId } as const;
  const gate = await requireEmployeeSection(auth, "documents");
  if ("error" in gate) return { error: gate.error } as const;
  const employee = await requireDirectoryEmployee(auth.supabase, orgId, employeeId);
  if (!isEmployeeRef(employee)) return { error: employee } as const;
  return { auth, orgId } as const;
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request, params.id);
  if ("error" in access) return access.error;
  const { data, error } = await access.auth.supabase
    .from("employee_onboarding_packets")
    .select(
      "id,placement_id,status,assigned_at,completed_at,template:packet_templates(id,code,name,version),tasks:employee_onboarding_tasks(id,title,description,sort_order,is_required,owner_type,owner_id,due_at,evidence_status,status,completed_at,completion_notes)"
    )
    .eq("organization_id", access.orgId)
    .eq("employee_id", params.id)
    .order("assigned_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk({ data: data ?? [] });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const access = await authorize(request, params.id);
  if ("error" in access) return access.error;
  const body = (await request.json().catch(() => null)) as {
    packet_template_id?: string;
    placement_id?: string | null;
  } | null;
  const templateId = body?.packet_template_id?.trim();
  const placementId = body?.placement_id?.trim() || null;
  if (!templateId) return jsonError("packet_template_id is required", 400);

  const { data, error } = await access.auth.supabase.rpc(
    "assign_onboarding_packet",
    {
      p_employee_id: params.id,
      p_packet_template_id: templateId,
      p_placement_id: placementId,
    }
  );
  if (error) return jsonError(error.message, 400);
  return jsonOk({ data: { id: data } }, 201);
}
