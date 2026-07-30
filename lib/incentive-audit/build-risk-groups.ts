import type { AuditedIncentiveRow, IncentiveSheet } from "./types";

export type IncentiveRiskKind =
  | "duplicate_and_paid"
  | "duplicate"
  | "already_paid";

export interface IncentiveRiskGroup {
  id: string;
  displayName: string;
  normalizedName: string;
  rows: AuditedIncentiveRow[];
  occurrenceCount: number;
  branches: string[];
  sheets: IncentiveSheet[];
  statuses: string[];
  incentiveTotal: number;
  isDuplicateInFile: boolean;
  isAlreadyReceived: boolean;
  isFuzzyMatch: boolean;
  matchedName: string | null;
  matchedUploadId: string | null;
  matchScore: number | null;
  risk: IncentiveRiskKind;
  riskRank: number;
}

function rowKey(row: AuditedIncentiveRow): string {
  return `${row.sheet}::${row.rowIndex}::${row.candidateName}`;
}

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return Array.from(
    new Set(values.map((v) => (v ?? "").trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));
}

function riskMeta(groupRows: AuditedIncentiveRow[]): {
  risk: IncentiveRiskKind;
  riskRank: number;
  isDuplicateInFile: boolean;
  isAlreadyReceived: boolean;
  isFuzzyMatch: boolean;
  matchedName: string | null;
  matchedUploadId: string | null;
  matchScore: number | null;
} {
  const isDuplicateInFile = groupRows.some((r) => r.isDuplicateInFile);
  const isAlreadyReceived = groupRows.some((r) => r.isAlreadyReceived);
  const isFuzzyMatch = groupRows.some((r) => r.isFuzzyMatch);
  const paid = groupRows.find((r) => r.isAlreadyReceived && r.matchedName);

  let risk: IncentiveRiskKind = "already_paid";
  let riskRank = 3;
  if (isDuplicateInFile && isAlreadyReceived) {
    risk = "duplicate_and_paid";
    riskRank = 1;
  } else if (isDuplicateInFile) {
    risk = "duplicate";
    riskRank = 2;
  }

  return {
    risk,
    riskRank,
    isDuplicateInFile,
    isAlreadyReceived,
    isFuzzyMatch,
    matchedName: paid?.matchedName ?? null,
    matchedUploadId: paid?.matchedUploadId ?? null,
    matchScore: paid?.matchScore ?? null,
  };
}

function toGroup(rows: AuditedIncentiveRow[]): IncentiveRiskGroup {
  const sorted = [...rows].sort((a, b) => {
    if (a.sheet !== b.sheet) return a.sheet.localeCompare(b.sheet);
    return a.rowIndex - b.rowIndex;
  });
  const displayName = sorted[0]?.candidateName ?? "Unknown";
  const normalizedName = sorted[0]?.normalizedName ?? displayName.toUpperCase();
  const meta = riskMeta(sorted);
  const incentiveTotal = sorted.reduce(
    (sum, row) => sum + (Number(row.incentiveAmount) || 0),
    0
  );

  return {
    id: `${normalizedName}::${sorted.map(rowKey).join("|")}`,
    displayName,
    normalizedName,
    rows: sorted,
    occurrenceCount: sorted.length,
    branches: uniqueSorted(sorted.map((r) => r.branchClient)),
    sheets: uniqueSorted(sorted.map((r) => r.sheet)) as IncentiveSheet[],
    statuses: uniqueSorted(sorted.map((r) => r.status)),
    incentiveTotal: Math.round(incentiveTotal * 100) / 100,
    ...meta,
  };
}

/**
 * Collapse flagged Excel rows into person-level risk groups for the scan map.
 * Duplicate peers become one group; already-paid singles stay one group each.
 */
export function buildIncentiveRiskGroups(
  rows: AuditedIncentiveRow[]
): IncentiveRiskGroup[] {
  const flagged = rows.filter(
    (row) => row.isDuplicateInFile || row.isAlreadyReceived
  );
  if (flagged.length === 0) return [];

  const keyToIndex = new Map<string, number>();
  flagged.forEach((row, index) => keyToIndex.set(rowKey(row), index));

  const parent = flagged.map((_, i) => i);
  const find = (i: number): number => {
    if (parent[i] !== i) parent[i] = find(parent[i]);
    return parent[i];
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < flagged.length; i++) {
    const row = flagged[i];
    if (!row.isDuplicateInFile) continue;

    const peerNames = new Set(
      [row.candidateName, ...row.duplicatePeers].map((n) => n.toLowerCase())
    );

    for (let j = 0; j < flagged.length; j++) {
      if (i === j) continue;
      const other = flagged[j];
      if (!other.isDuplicateInFile) continue;

      const related =
        peerNames.has(other.candidateName.toLowerCase()) ||
        other.normalizedName === row.normalizedName ||
        other.duplicatePeers.some((p) => peerNames.has(p.toLowerCase()));

      if (related) union(i, j);
    }
  }

  const clusters = new Map<number, AuditedIncentiveRow[]>();
  for (let i = 0; i < flagged.length; i++) {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(flagged[i]);
    clusters.set(root, list);
  }

  return Array.from(clusters.values())
    .map(toGroup)
    .sort((a, b) => {
      if (a.riskRank !== b.riskRank) return a.riskRank - b.riskRank;
      if (b.occurrenceCount !== a.occurrenceCount) {
        return b.occurrenceCount - a.occurrenceCount;
      }
      return a.displayName.localeCompare(b.displayName);
    });
}

export function filterRiskGroups(
  groups: IncentiveRiskGroup[],
  opts: {
    query?: string;
    riskFilter?: "all" | "duplicates" | "already";
  }
): IncentiveRiskGroup[] {
  const q = (opts.query ?? "").trim().toLowerCase();
  const riskFilter = opts.riskFilter ?? "all";

  return groups.filter((group) => {
    if (riskFilter === "duplicates" && !group.isDuplicateInFile) return false;
    if (riskFilter === "already" && !group.isAlreadyReceived) return false;

    if (!q) return true;
    const haystack = [
      group.displayName,
      group.normalizedName,
      group.matchedName,
      ...group.branches,
      ...group.sheets,
      ...group.statuses,
      ...group.rows.flatMap((r) => [
        r.recruiter,
        r.position,
        r.candidateName,
        ...r.duplicatePeers,
      ]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
