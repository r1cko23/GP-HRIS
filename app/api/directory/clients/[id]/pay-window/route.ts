import { NextRequest } from "next/server";
import { requirePeopleClientsOrEmployeesPage } from "@/lib/access/require-capability";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  nextCutoffFromCalendar,
  todayYmdManila,
  type ClientPayCalendar,
} from "@/lib/directory/client-pay-calendar";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleClientsOrEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;

  const { data, error } = await auth.supabase
    .from("clients")
    .select("cut1_start, cut1_end, cut2_start, cut2_end, pay_frequency")
    .eq("organization_id", orgId)
    .eq("id", params.id)
    .maybeSingle();

  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Client not found", 404);

  const next = nextCutoffFromCalendar(
    data as ClientPayCalendar,
    [],
    todayYmdManila(),
  );
  if (!next) return jsonError("This employer has no pay window for today.", 409);

  return jsonOk({
    data: {
      cutoff_start: next.period_start,
      cutoff_end: next.period_end,
      payout_date: next.payroll_date,
    },
  });
}
