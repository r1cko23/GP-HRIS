import { describe, expect, it } from "vitest";
import { buildIncentiveRiskGroups, filterRiskGroups } from "../build-risk-groups";
import type { AuditedIncentiveRow } from "../types";

function row(
  overrides: Partial<AuditedIncentiveRow> & { candidateName: string }
): AuditedIncentiveRow {
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
    isDuplicateInFile: false,
    isAlreadyReceived: false,
    isFuzzyMatch: false,
    matchScore: null,
    matchedName: null,
    matchedUploadId: null,
    matchedRowId: null,
    duplicatePeers: [],
    ...overrides,
  };
}

describe("buildIncentiveRiskGroups", () => {
  it("collapses within-file duplicates into one risk group", () => {
    const groups = buildIncentiveRiskGroups([
      row({
        candidateName: "Neil Catchillar Chavez",
        rowIndex: 10,
        branchClient: "KR BACOOR JUNCTION",
        isDuplicateInFile: true,
        duplicatePeers: ["Neil Catchillar Chavez"],
      }),
      row({
        candidateName: "Neil Catchillar Chavez",
        rowIndex: 22,
        branchClient: "KR NUVALI",
        isDuplicateInFile: true,
        duplicatePeers: ["Neil Catchillar Chavez"],
      }),
      row({
        candidateName: "Clean Person",
        rowIndex: 3,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].occurrenceCount).toBe(2);
    expect(groups[0].branches).toEqual([
      "KR BACOOR JUNCTION",
      "KR NUVALI",
    ]);
    expect(groups[0].risk).toBe("duplicate");
  });

  it("keeps already-paid singles as their own group", () => {
    const groups = buildIncentiveRiskGroups([
      row({
        candidateName: "Mary Camille Rivas",
        isAlreadyReceived: true,
        matchedName: "Mary Camille Rivas",
        matchedUploadId: "up-1",
        matchScore: 1,
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].risk).toBe("already_paid");
    expect(groups[0].matchedName).toBe("Mary Camille Rivas");
  });

  it("ranks duplicate+paid ahead of duplicate-only", () => {
    const groups = buildIncentiveRiskGroups([
      row({
        candidateName: "Dup Only",
        rowIndex: 2,
        isDuplicateInFile: true,
        duplicatePeers: ["Dup Only"],
      }),
      row({
        candidateName: "Dup Only",
        rowIndex: 3,
        isDuplicateInFile: true,
        duplicatePeers: ["Dup Only"],
      }),
      row({
        candidateName: "Both Risks",
        rowIndex: 4,
        isDuplicateInFile: true,
        isAlreadyReceived: true,
        matchedName: "Both Risks",
        duplicatePeers: ["Both Risks"],
      }),
      row({
        candidateName: "Both Risks",
        rowIndex: 5,
        isDuplicateInFile: true,
        duplicatePeers: ["Both Risks"],
      }),
    ]);

    expect(groups[0].displayName).toBe("Both Risks");
    expect(groups[0].risk).toBe("duplicate_and_paid");
    expect(groups[1].risk).toBe("duplicate");
  });
});

describe("filterRiskGroups", () => {
  it("filters by query and risk type", () => {
    const groups = buildIncentiveRiskGroups([
      row({
        candidateName: "Neil Catchillar Chavez",
        rowIndex: 10,
        branchClient: "KR BACOOR JUNCTION",
        isDuplicateInFile: true,
        duplicatePeers: ["Neil Catchillar Chavez"],
      }),
      row({
        candidateName: "Neil Catchillar Chavez",
        rowIndex: 22,
        branchClient: "KR NUVALI",
        isDuplicateInFile: true,
        duplicatePeers: ["Neil Catchillar Chavez"],
      }),
      row({
        candidateName: "Mary Camille Rivas",
        isAlreadyReceived: true,
        matchedName: "Mary Camille Rivas",
      }),
    ]);

    expect(filterRiskGroups(groups, { riskFilter: "already" })).toHaveLength(1);
    expect(
      filterRiskGroups(groups, { query: "nuvali" })[0].displayName
    ).toBe("Neil Catchillar Chavez");
  });
});
