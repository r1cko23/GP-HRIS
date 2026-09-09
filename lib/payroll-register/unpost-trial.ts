/**
 * Reverse trial payroll loan posts so a catalog re-import can mirror MAIN.
 */

export type LoanPostToUnpost = {
  loan_id: string;
  created_at: string;
  balance_before: number;
  schedule_id?: string | null;
};

export type LoanUnpostRestore = {
  loan_id: string;
  restore_balance: number;
  schedule_ids: string[];
};

function n(value: unknown): number {
  const x = Number(value ?? 0);
  return Number.isFinite(x) ? x : 0;
}

/** Restore each loan to the balance from before the earliest post we are reversing. */
export function planLoanUnpostRestore(posts: LoanPostToUnpost[]): LoanUnpostRestore[] {
  const byLoan = new Map<string, LoanPostToUnpost[]>();
  for (const post of posts) {
    const list = byLoan.get(post.loan_id) ?? [];
    list.push(post);
    byLoan.set(post.loan_id, list);
  }
  const out: LoanUnpostRestore[] = [];
  for (const [loanId, list] of byLoan) {
    const ordered = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const oldest = ordered[0];
    if (!oldest) continue;
    out.push({
      loan_id: loanId,
      restore_balance: n(oldest.balance_before),
      schedule_ids: [
        ...new Set(
          list
            .map((row) => row.schedule_id)
            .filter((id): id is string => Boolean(id))
        ),
      ],
    });
  }
  return out;
}
