import { employeeNameSimilarity } from "@/lib/payroll-summary/employee-name-match";
import { normalizeEmployeeName } from "@/lib/payroll-summary/normalize-name";
import type {
  AuditedIncentiveRow,
  HistoricalIncentiveRecipient,
  IncentiveAuditSummary,
  IncentiveCandidateRow,
  IncentiveSheet,
} from "./types";
import { INCENTIVE_NAME_MATCH_THRESHOLD } from "./types";

interface MatchHit {
  recipient: HistoricalIncentiveRecipient;
  score: number;
  fuzzy: boolean;
}

function isApprovedWithIncentive(row: {
  status: string | null;
  incentiveAmount: number;
}): boolean {
  return (
    String(row.status ?? "").toUpperCase() === "APPROVED" &&
    Number(row.incentiveAmount) > 0
  );
}

function findBestHistoricalMatch(
  candidate: IncentiveCandidateRow,
  history: HistoricalIncentiveRecipient[]
): MatchHit | null {
  let best: MatchHit | null = null;

  for (const recipient of history) {
    if (!recipient.normalizedName) continue;

    if (recipient.normalizedName === candidate.normalizedName) {
      return { recipient, score: 1, fuzzy: false };
    }

    const score = employeeNameSimilarity(
      candidate.candidateName,
      recipient.candidateName
    );
    if (score < INCENTIVE_NAME_MATCH_THRESHOLD) continue;
    if (!best || score > best.score) {
      best = { recipient, score, fuzzy: true };
    }
  }

  return best;
}

/**
 * Flag within-file duplicates (exact + fuzzy) and already-received matches
 * against historical APPROVED incentive recipients.
 */
export function auditIncentiveCandidates(
  candidates: IncentiveCandidateRow[],
  history: HistoricalIncentiveRecipient[]
): { rows: AuditedIncentiveRow[]; summary: IncentiveAuditSummary } {
  const duplicatePeerNames = new Map<number, string[]>();
  const duplicateIndexes = new Set<number>();

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i];
      const b = candidates[j];
      const exact = a.normalizedName === b.normalizedName;
      const score = exact
        ? 1
        : employeeNameSimilarity(a.candidateName, b.candidateName);
      if (!exact && score < INCENTIVE_NAME_MATCH_THRESHOLD) continue;

      duplicateIndexes.add(i);
      duplicateIndexes.add(j);
      const peersA = duplicatePeerNames.get(i) ?? [];
      const peersB = duplicatePeerNames.get(j) ?? [];
      peersA.push(b.candidateName);
      peersB.push(a.candidateName);
      duplicatePeerNames.set(i, peersA);
      duplicatePeerNames.set(j, peersB);
    }
  }

  const rows: AuditedIncentiveRow[] = candidates.map((candidate, index) => {
    const historical = findBestHistoricalMatch(candidate, history);
    const isDuplicateInFile = duplicateIndexes.has(index);

    return {
      ...candidate,
      isDuplicateInFile,
      isAlreadyReceived: Boolean(historical),
      isFuzzyMatch: Boolean(historical?.fuzzy) || false,
      matchScore: historical?.score ?? null,
      matchedName: historical?.recipient.candidateName ?? null,
      matchedUploadId: historical?.recipient.uploadId ?? null,
      matchedRowId: historical?.recipient.id ?? null,
      duplicatePeers: duplicatePeerNames.get(index) ?? [],
    };
  });

  // Within-file fuzzy duplicates should also count as fuzzy matches for UX
  for (const row of rows) {
    if (row.isDuplicateInFile && !row.isAlreadyReceived) {
      const selfNorm = row.normalizedName;
      const peerExact = row.duplicatePeers.some(
        (name) => normalizeEmployeeName(name) === selfNorm
      );
      if (!peerExact) {
        row.isFuzzyMatch = true;
      }
    }
  }

  const bySheet: Record<IncentiveSheet, number> = {
    "NON-HOTEL": 0,
    HOTEL: 0,
  };
  let approvedCount = 0;
  let disapprovedCount = 0;
  let totalIncentiveAmount = 0;
  let duplicateCount = 0;
  let alreadyReceivedCount = 0;
  let fuzzyMatchCount = 0;

  for (const row of rows) {
    bySheet[row.sheet] += 1;
    if (String(row.status ?? "").toUpperCase() === "APPROVED") approvedCount += 1;
    if (String(row.status ?? "").toUpperCase() === "DISAPPROVED") {
      disapprovedCount += 1;
    }
    totalIncentiveAmount += Number(row.incentiveAmount) || 0;
    if (row.isDuplicateInFile) duplicateCount += 1;
    if (row.isAlreadyReceived) alreadyReceivedCount += 1;
    if (row.isFuzzyMatch) fuzzyMatchCount += 1;
  }

  return {
    rows,
    summary: {
      totalCandidates: rows.length,
      duplicateCount,
      alreadyReceivedCount,
      fuzzyMatchCount,
      approvedCount,
      disapprovedCount,
      totalIncentiveAmount: Math.round(totalIncentiveAmount * 100) / 100,
      bySheet,
    },
  };
}

export function isPaidIncentiveRecipient(row: {
  status: string | null;
  incentiveAmount: number;
}): boolean {
  return isApprovedWithIncentive(row);
}
