/** April Nina Gammad's login was removed; her inserts remain on the audit row. */
export const APRIL_LOAN_CREATOR_ID = "f5b911d5-b6e8-4563-b693-ede30bfbcf5e";

const REMOVED_LOAN_CREATOR_NAMES: Record<string, string> = {
  [APRIL_LOAN_CREATOR_ID]: "April Nina Gammad",
};

export type LoanInsertAttribution = {
  loanId: string;
  createdBy: string | null;
};

export type LoanCreator = {
  id: string;
  name: string;
};

export function loanCreatorChoices(
  attributions: LoanInsertAttribution[],
  knownUsers: Array<{ id: string; name: string | null }>
): { creators: LoanCreator[]; creatorByLoanId: Map<string, string> } {
  const names = new Map<string, string>();
  for (const user of knownUsers) {
    const name = (user.name ?? "").trim();
    if (name) names.set(user.id, name);
  }

  const creatorByLoanId = new Map<string, string>();
  const ids = new Set<string>();
  for (const row of attributions) {
    const id = (row.createdBy ?? "").trim();
    if (!id) continue;
    creatorByLoanId.set(row.loanId, id);
    ids.add(id);
  }

  const creators = [...ids]
    .map((id) => ({
      id,
      name: names.get(id) ?? REMOVED_LOAN_CREATOR_NAMES[id] ?? "Removed user",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  return { creators, creatorByLoanId };
}

export function filterLoansByCreator<T extends { id: string }>(
  loans: T[],
  creatorByLoanId: ReadonlyMap<string, string>,
  createdBy: string | null
): T[] {
  if (!createdBy) return loans;
  return loans.filter((loan) => creatorByLoanId.get(loan.id) === createdBy);
}
