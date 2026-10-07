/**
 * Employment is the stable legal link; Tenure is one episode under it.
 * After platform identity, every employment_tenures row needs employment_id.
 */

export function employmentStatusForTenureStatus(
  tenureStatus: string
): "pending" | "active" | "inactive" | "ended" {
  if (tenureStatus === "for_verification") return "pending";
  if (tenureStatus === "inactive" || tenureStatus === "barred") {
    return "inactive";
  }
  return "active";
}

export function tenureInsertPayload(input: {
  organizationId: string;
  employeeId: string;
  employmentId: string;
  sequence: number;
  hire_date: string | null;
  resign_date: string | null;
  client_id: string | null;
  branch_id: string | null;
  position_id: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  status: string;
  final_pay_status: string;
  barred_reason: string | null;
  is_current: boolean;
  closed_at: string | null;
}) {
  return {
    organization_id: input.organizationId,
    employee_id: input.employeeId,
    employment_id: input.employmentId,
    sequence: input.sequence,
    hire_date: input.hire_date,
    resign_date: input.resign_date,
    client_id: input.client_id,
    branch_id: input.branch_id,
    position_id: input.position_id,
    daily_rate: input.daily_rate,
    billing_daily_rate: input.billing_daily_rate,
    status: input.status,
    final_pay_status: input.final_pay_status,
    barred_reason: input.barred_reason,
    is_current: input.is_current,
    closed_at: input.closed_at,
  };
}
