import { NextRequest } from "next/server";
import {
  engagementDepsFromAuth,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { engagementRehire } from "@/lib/directory/engagement";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

function asOptionalUuid(
  value: unknown,
  field: string
): string | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") {
    return { error: `${field} must be a uuid string or null` };
  }
  return value;
}

function asOptionalNumber(
  value: unknown,
  field: string
): number | null | { error: string } {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return { error: `${field} must be a number` };
  return n;
}

/**
 * Rehire updates the existing person master (ADR 0006).
 * Does not create a new employee or change employee_code.
 * Bundy enrollment is best-effort when Client.bundy_enabled (ADR 0008).
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const body = (await request.json()) as Record<string, unknown>;
  const hireDate =
    typeof body.hire_date === "string" && body.hire_date.trim()
      ? body.hire_date.trim()
      : null;
  if (!hireDate || !/^\d{4}-\d{2}-\d{2}$/.test(hireDate)) {
    return jsonError("hire_date is required (YYYY-MM-DD)", 400);
  }

  const clientIdRaw = asOptionalUuid(body.client_id, "client_id");
  if (clientIdRaw && typeof clientIdRaw === "object" && "error" in clientIdRaw) {
    return jsonError(clientIdRaw.error, 400);
  }
  const branchIdRaw = asOptionalUuid(body.branch_id, "branch_id");
  if (branchIdRaw && typeof branchIdRaw === "object" && "error" in branchIdRaw) {
    return jsonError(branchIdRaw.error, 400);
  }
  const positionIdRaw = asOptionalUuid(body.position_id, "position_id");
  if (
    positionIdRaw &&
    typeof positionIdRaw === "object" &&
    "error" in positionIdRaw
  ) {
    return jsonError(positionIdRaw.error, 400);
  }
  const dailyRate = asOptionalNumber(body.daily_rate, "daily_rate");
  if (dailyRate && typeof dailyRate === "object" && "error" in dailyRate) {
    return jsonError(dailyRate.error, 400);
  }
  const billingRate = asOptionalNumber(
    body.billing_daily_rate,
    "billing_daily_rate"
  );
  if (billingRate && typeof billingRate === "object" && "error" in billingRate) {
    return jsonError(billingRate.error, 400);
  }
  const remarks =
    typeof body.remarks === "string" && body.remarks.trim()
      ? body.remarks.trim()
      : null;
  const force =
    body.force === true || body.force === "1" || body.force === "true";

  const result = await engagementRehire(
    engagementDepsFromAuth(auth, orgId),
    params.id,
    {
      hire_date: hireDate,
      client_id: clientIdRaw as string | null,
      branch_id:
        body.branch_id !== undefined
          ? (branchIdRaw as string | null)
          : undefined,
      position_id:
        body.position_id !== undefined
          ? (positionIdRaw as string | null)
          : undefined,
      daily_rate:
        body.daily_rate !== undefined
          ? (dailyRate as number | null)
          : undefined,
      billing_daily_rate:
        body.billing_daily_rate !== undefined
          ? (billingRate as number | null)
          : undefined,
      remarks,
      force,
    }
  );
  if (!result.ok) return jsonError(result.error, result.status);

  return jsonOk({
    data: result.data,
    enrollment: result.enrollment,
    office_sync: result.enrollment
      ? {
          updated: result.enrollment.action === "updated" ? 1 : 0,
          ...(result.enrollment.warning || result.enrollment.error
            ? {
                warning:
                  result.enrollment.warning || result.enrollment.error,
              }
            : {}),
        }
      : undefined,
  });
}
