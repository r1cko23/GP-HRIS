import { NextRequest } from "next/server";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

/**
 * Post draft register: update loan balances, mark run + cutoff posted.
 */
export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const publicDb = publicDbClient();

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);
  if (period.status !== "approved") {
    return jsonError("Cutoff must be approved before posting payroll", 409);
  }

  const { data: run, error: runError } = await publicDb
    .from("payroll_register_runs")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (runError) return jsonError(runError.message, 500);
  if (!run) return jsonError("Build the payroll register first", 404);
  if (run.status === "posted") {
    return jsonError("Register already posted", 409);
  }

  const { data: lines, error: linesError } = await publicDb
    .from("payroll_register_lines")
    .select("id, office_employee_id, directory_employee_id, loan_lines")
    .eq("run_id", run.id);
  if (linesError) return jsonError(linesError.message, 500);

  const loanPosts: Array<{
    run_id: string;
    loan_id: string;
    office_employee_id: string;
    directory_employee_id: string | null;
    schedule_id: string | null;
    amount: number;
    balance_before: number;
    balance_after: number;
  }> = [];

  for (const line of lines ?? []) {
    const officeId = line.office_employee_id as string | null;
    const directoryId = (line.directory_employee_id as string | null) ?? null;
    const loanLines = (line.loan_lines as Array<{
      loan_id: string;
      amount: number;
      schedule_id?: string | null;
    }> | null) ?? [];
    if (!loanLines.length) continue;

    for (const loanLine of loanLines) {
      if (!loanLine.loan_id || !(loanLine.amount > 0)) continue;
      let loanQuery = publicDb
        .from("employee_loans")
        .select(
          "id, employee_id, directory_employee_id, current_balance, remaining_terms, is_active"
        )
        .eq("id", loanLine.loan_id);
      if (officeId) loanQuery = loanQuery.eq("employee_id", officeId);
      const { data: loan, error: loanError } = await loanQuery.maybeSingle();
      if (loanError) return jsonError(loanError.message, 500);
      if (!loan || !loan.is_active) continue;

      const before = Number(loan.current_balance) || 0;
      const amount = Math.min(loanLine.amount, before);
      if (amount <= 0) continue;
      const after = Math.round((before - amount) * 100) / 100;

      let scheduleId = loanLine.schedule_id ?? null;
      if (scheduleId) {
        const { data: schedule, error: schedError } = await publicDb
          .from("employee_loan_schedules")
          .select("id, status")
          .eq("id", scheduleId)
          .eq("loan_id", loan.id)
          .maybeSingle();
        if (schedError) return jsonError(schedError.message, 500);
        if (!schedule || schedule.status === "paid") continue;
      }

      const { error: updLoanError } = await publicDb
        .from("employee_loans")
        .update({
          current_balance: after,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loan.id);
      if (updLoanError) return jsonError(updLoanError.message, 400);

      if (scheduleId) {
        const { error: schedUpdError } = await publicDb
          .from("employee_loan_schedules")
          .update({
            status: "paid",
            amount_paid: amount,
            posted_run_id: run.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", scheduleId);
        if (schedUpdError) return jsonError(schedUpdError.message, 400);
      }

      const { count: pendingCount, error: pendingError } = await publicDb
        .from("employee_loan_schedules")
        .select("id", { count: "exact", head: true })
        .eq("loan_id", loan.id)
        .eq("status", "pending");
      if (pendingError) return jsonError(pendingError.message, 500);

      const remainingTerms =
        pendingCount == null
          ? Math.max(0, (Number(loan.remaining_terms) || 0) - 1)
          : pendingCount;
      const { error: termsError } = await publicDb
        .from("employee_loans")
        .update({
          remaining_terms: remainingTerms,
          is_active: after > 0 && remainingTerms > 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", loan.id);
      if (termsError) return jsonError(termsError.message, 400);

      loanPosts.push({
        run_id: run.id as string,
        loan_id: loan.id as string,
        office_employee_id:
          officeId ?? (loan.employee_id as string),
        directory_employee_id:
          directoryId ?? (loan.directory_employee_id as string | null),
        schedule_id: scheduleId,
        amount,
        balance_before: before,
        balance_after: after,
      });
    }
  }

  if (loanPosts.length) {
    const { error: postError } = await publicDb
      .from("payroll_register_loan_posts")
      .insert(loanPosts);
    if (postError) return jsonError(postError.message, 400);
  }

  const now = new Date().toISOString();
  const { error: runUpdError } = await publicDb
    .from("payroll_register_runs")
    .update({
      status: "posted",
      posted_by: auth.userId,
      posted_at: now,
      updated_at: now,
    })
    .eq("id", run.id);
  if (runUpdError) return jsonError(runUpdError.message, 400);

  const { error: periodUpdError } = await publicDb
    .from("cutoff_periods")
    .update({
      status: "posted",
      updated_at: now,
    })
    .eq("id", params.id);
  if (periodUpdError) return jsonError(periodUpdError.message, 400);

  const { data: appliedCatchup, error: catchupError } = await publicDb
    .from("payroll_catchup_corrections")
    .update({
      status: "applied",
      applied_run_id: run.id,
      applied_at: now,
      updated_at: now,
    })
    .eq("apply_cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .eq("status", "pending")
    .select("id");
  if (catchupError) return jsonError(catchupError.message, 400);

  return jsonOk({
    data: {
      run_id: run.id,
      loans_posted: loanPosts.length,
      catchup_applied: appliedCatchup?.length ?? 0,
      status: "posted",
    },
  });
}
