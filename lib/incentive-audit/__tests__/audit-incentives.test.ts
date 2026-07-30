import { describe, expect, it } from "vitest";
import { auditIncentiveCandidates } from "../audit-incentives";
import type { IncentiveCandidateRow } from "../types";

function row(
  overrides: Partial<IncentiveCandidateRow> & { candidateName: string }
): IncentiveCandidateRow {
  return {
    sheet: "NON-HOTEL",
    rowIndex: 2,
    industry: "NON-HOTEL",
    normalizedName: overrides.candidateName.toUpperCase().replace(/\s+/g, " "),
    branchClient: "KR",
    position: "Team Member",
    recruiter: "Recruiter",
    endorsementDate: null,
    deploymentDate: null,
    hrisVerification: "IN HRIS",
    status: "APPROVED",
    totalHours: 40,
    totalDays: 5,
    incentiveAmount: 500,
    notes: null,
    ...overrides,
  };
}

describe("auditIncentiveCandidates", () => {
  it("flags exact duplicates within the file", () => {
    const { rows, summary } = auditIncentiveCandidates(
      [
        row({ candidateName: "Jane Doe", rowIndex: 2 }),
        row({ candidateName: "Jane Doe", rowIndex: 3 }),
        row({ candidateName: "John Smith", rowIndex: 4 }),
      ],
      []
    );
    expect(summary.duplicateCount).toBe(2);
    expect(rows.filter((r) => r.isDuplicateInFile).map((r) => r.rowIndex)).toEqual([
      2, 3,
    ]);
  });

  it("flags near-spelling duplicates within the file", () => {
    const { rows, summary } = auditIncentiveCandidates(
      [
        row({ candidateName: "Christian Lontayao", rowIndex: 2 }),
        row({ candidateName: "Christien Lontayao", rowIndex: 3 }),
      ],
      []
    );
    expect(summary.duplicateCount).toBe(2);
    expect(rows.every((r) => r.isDuplicateInFile)).toBe(true);
  });

  it("flags already-received against historical APPROVED payouts", () => {
    const { rows, summary } = auditIncentiveCandidates(
      [row({ candidateName: "Mary Camille Rivas", incentiveAmount: 2000 })],
      [
        {
          id: "hist-1",
          uploadId: "up-1",
          candidateName: "Mary Camille Rivas",
          normalizedName: "MARY CAMILLE RIVAS",
          incentiveAmount: 2000,
          status: "APPROVED",
          sheet: "NON-HOTEL",
        },
      ]
    );
    expect(summary.alreadyReceivedCount).toBe(1);
    expect(rows[0].isAlreadyReceived).toBe(true);
    expect(rows[0].matchedName).toBe("Mary Camille Rivas");
  });

  it("fuzzy-matches misspelled names against history", () => {
    const { rows } = auditIncentiveCandidates(
      [row({ candidateName: "Mearl Celene Sinlao" })],
      [
        {
          id: "hist-2",
          uploadId: "up-1",
          candidateName: "Mearl Cellene Sinlao",
          normalizedName: "MEARL CELLENE SINLAO",
          incentiveAmount: 2000,
          status: "APPROVED",
          sheet: "NON-HOTEL",
        },
      ]
    );
    expect(rows[0].isAlreadyReceived).toBe(true);
    expect(rows[0].isFuzzyMatch).toBe(true);
    expect((rows[0].matchScore ?? 0) >= 0.78).toBe(true);
  });
});
