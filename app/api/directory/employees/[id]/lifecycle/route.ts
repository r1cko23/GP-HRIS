import { NextRequest } from "next/server";
import { requireEmployeeSection } from "@/lib/access/require-employee-section";
import { requirePeopleEmployeesPage } from "@/lib/access/require-capability";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementLifecycle } from "@/lib/directory/engagement";
import {
  isLifecycleAction,
  LIFECYCLE_ACTIONS,
  type ActivatePayFields,
} from "@/lib/directory/engagement-transitions";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function optionalPayText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  return value;
}

function readActivatePay(body: Record<string, unknown>): ActivatePayFields | null {
  const pay_through = optionalPayText(body.pay_through);
  const bank_name = optionalPayText(body.bank_name);
  const bank_account_no = optionalPayText(body.bank_account_no);
  const gcash = optionalPayText(body.gcash);
  if (
    pay_through === undefined &&
    bank_name === undefined &&
    bank_account_no === undefined &&
    gcash === undefined
  ) {
    return null;
  }
  return {
    pay_through: pay_through ?? null,
    bank_name: bank_name ?? null,
    bank_account_no: bank_account_no ?? null,
    gcash: gcash ?? null,
  };
}

/**
 * Explicit lifecycle transitions for the person master (ADR 0006 / 0008).
 * Inactive → active must use /rehire.
 * Activate from for_verification also writes paythrough in the same request.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;
  const pageGate = await requirePeopleEmployeesPage(auth);
  if ("error" in pageGate) return pageGate.error;
  const sectionGate = await requireEmployeeSection(auth, "lifecycle");
  if ("error" in sectionGate) return sectionGate.error;

  const body = (await request.json()) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action.trim() : "";
  if (!action || !isLifecycleAction(action)) {
    return jsonError(
      `action required. Allowed: ${LIFECYCLE_ACTIONS.join(", ")}`,
      400
    );
  }

  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;
  const resignDate =
    typeof body.resign_date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.resign_date.trim())
      ? body.resign_date.trim()
      : null;
  const clientLatest =
    typeof body.client_latest_payroll_end === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.client_latest_payroll_end.trim())
      ? body.client_latest_payroll_end.trim()
      : null;
  const pay = action === "activate" ? readActivatePay(body) : null;

  if (action === "activate" && pay) {
    const payGate = await requireEmployeeSection(auth, "pay_channel");
    if ("error" in payGate) return payGate.error;
  }

  const result = await engagementLifecycle(
    engagementDepsFromAuth(auth, orgId),
    params.id,
    {
      action,
      remarks,
      resign_date: resignDate,
      client_latest_payroll_end: clientLatest,
      pay,
    }
  );
  if (!result.ok) return jsonError(result.error, result.status);
  return jsonOk({ data: result.data, action });
}
