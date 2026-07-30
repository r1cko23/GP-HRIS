export type IncentiveSheet = "NON-HOTEL" | "HOTEL";

export interface IncentiveCandidateRow {
  sheet: IncentiveSheet;
  rowIndex: number;
  industry: string | null;
  candidateName: string;
  normalizedName: string;
  branchClient: string | null;
  position: string | null;
  recruiter: string | null;
  endorsementDate: string | null;
  deploymentDate: string | null;
  hrisVerification: string | null;
  status: string | null;
  totalHours: number | null;
  totalDays: number | null;
  incentiveAmount: number;
  notes: string | null;
}

export interface IncentiveRowAuditFlags {
  isDuplicateInFile: boolean;
  isAlreadyReceived: boolean;
  isFuzzyMatch: boolean;
  matchScore: number | null;
  matchedName: string | null;
  matchedUploadId: string | null;
  matchedRowId: string | null;
  duplicatePeers: string[];
}

export interface AuditedIncentiveRow extends IncentiveCandidateRow, IncentiveRowAuditFlags {}

export interface IncentiveAuditSummary {
  totalCandidates: number;
  duplicateCount: number;
  alreadyReceivedCount: number;
  fuzzyMatchCount: number;
  approvedCount: number;
  disapprovedCount: number;
  totalIncentiveAmount: number;
  bySheet: Record<IncentiveSheet, number>;
}

export interface IncentiveAuditUploadRecord {
  id: string;
  uploadedAt: string;
  uploadedBy: string;
  sourceFileName: string | null;
  status: "ready" | "failed";
  errorMessage: string | null;
  totalCandidates: number;
  duplicateCount: number;
  alreadyReceivedCount: number;
  fuzzyMatchCount: number;
  approvedCount: number;
  disapprovedCount: number;
  totalIncentiveAmount: number;
  auditSummary: IncentiveAuditSummary | Record<string, unknown>;
}

export interface HistoricalIncentiveRecipient {
  id: string;
  uploadId: string;
  candidateName: string;
  normalizedName: string;
  incentiveAmount: number;
  status: string | null;
  sheet: IncentiveSheet;
  uploadedAt?: string;
}

/** Minimum similarity to treat two names as the same person (spelling variants). */
export const INCENTIVE_NAME_MATCH_THRESHOLD = 0.78;
