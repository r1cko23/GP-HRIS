import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aggregateGpClientIngestResults,
  collectClaimedBranchIds,
  findConflictingSiteClaims,
  formatCutoffSitesLabel,
  normalizeCutoffBranchIds,
  periodBranchIdForInsert,
  resolveCutoffSiteIds,
  type ExistingCutoffSiteRow,
} from "../cutoff-period-sites";

describe("normalizeCutoffBranchIds", () => {
  it("prefers branch_ids when provided", () => {
    assert.deepEqual(
      normalizeCutoffBranchIds({
        branch_id: "a",
        branch_ids: ["b", "c", "b", ""],
      }),
      ["b", "c"]
    );
  });

  it("falls back to single branch_id", () => {
    assert.deepEqual(
      normalizeCutoffBranchIds({ branch_id: "a", branch_ids: [] }),
      ["a"]
    );
    assert.deepEqual(normalizeCutoffBranchIds({ branch_id: "a" }), ["a"]);
  });

  it("returns empty when neither is set", () => {
    assert.deepEqual(normalizeCutoffBranchIds({}), []);
    assert.deepEqual(
      normalizeCutoffBranchIds({ branch_id: null, branch_ids: null }),
      []
    );
  });
});

describe("periodBranchIdForInsert", () => {
  it("stores the single site on the period; multi-site leaves branch_id null", () => {
    assert.equal(periodBranchIdForInsert(["a"]), "a");
    assert.equal(periodBranchIdForInsert(["a", "b"]), null);
    assert.equal(periodBranchIdForInsert([]), null);
  });
});

describe("findConflictingSiteClaims", () => {
  const existing: ExistingCutoffSiteRow[] = [
    {
      cutoff_period_id: "cut-a",
      branch_id: "site-a",
      period_kind: "regular",
      status: "posted",
    },
    {
      cutoff_period_id: "cut-bc",
      branch_id: "site-b",
      period_kind: "regular",
      status: "draft",
    },
    {
      cutoff_period_id: "cut-bc",
      branch_id: "site-c",
      period_kind: "regular",
      status: "draft",
    },
    {
      cutoff_period_id: "cut-adj",
      branch_id: "site-a",
      period_kind: "adjustment",
      status: "draft",
    },
    {
      cutoff_period_id: "cut-cancel",
      branch_id: "site-d",
      period_kind: "regular",
      status: "cancelled",
    },
  ];

  it("allows a new site when another site already paid the same dates", () => {
    assert.deepEqual(
      findConflictingSiteClaims(["site-b", "site-c"], existing),
      [
        { branch_id: "site-b", cutoff_period_id: "cut-bc" },
        { branch_id: "site-c", cutoff_period_id: "cut-bc" },
      ]
    );
    assert.deepEqual(findConflictingSiteClaims(["site-e"], existing), []);
  });

  it("blocks reusing a site already on a regular cutoff for those dates", () => {
    assert.deepEqual(findConflictingSiteClaims(["site-a"], existing), [
      { branch_id: "site-a", cutoff_period_id: "cut-a" },
    ]);
  });

  it("ignores adjustment and cancelled claims", () => {
    assert.deepEqual(findConflictingSiteClaims(["site-d"], existing), []);
    // site-a on adjustment only would still conflict via cut-a regular
    assert.equal(
      findConflictingSiteClaims(["site-a"], existing).length,
      1
    );
  });

  it("can exclude the period being updated", () => {
    assert.deepEqual(
      findConflictingSiteClaims(["site-b"], existing, {
        excludeCutoffPeriodId: "cut-bc",
      }),
      []
    );
  });
});

describe("collectClaimedBranchIds", () => {
  it("unions period.branch_id with junction rows", () => {
    assert.deepEqual(
      collectClaimedBranchIds({
        periodBranchId: "a",
        junctionBranchIds: ["b", "a"],
      }).sort(),
      ["a", "b"]
    );
    assert.deepEqual(
      collectClaimedBranchIds({
        periodBranchId: null,
        junctionBranchIds: ["b", "c"],
      }).sort(),
      ["b", "c"]
    );
  });
});

describe("resolveCutoffSiteIds", () => {
  it("prefers junction sites; falls back to period.branch_id", () => {
    assert.deepEqual(
      resolveCutoffSiteIds({
        branch_id: "legacy",
        site_branch_ids: ["a", "b"],
      }),
      ["a", "b"]
    );
    assert.deepEqual(
      resolveCutoffSiteIds({ branch_id: "legacy", site_branch_ids: [] }),
      ["legacy"]
    );
    assert.deepEqual(
      resolveCutoffSiteIds({ branch_id: null, site_branch_ids: [] }),
      []
    );
  });
});

describe("formatCutoffSitesLabel", () => {
  it("shows one name or an N sites summary", () => {
    const names = { a: "Manila", b: "Breadplant", c: "Back Office" };
    assert.equal(formatCutoffSitesLabel(["a"], names), "Manila");
    assert.equal(formatCutoffSitesLabel(["a", "b"], names), "2 sites");
    assert.equal(formatCutoffSitesLabel([], names), "—");
  });
});

describe("aggregateGpClientIngestResults", () => {
  it("sums hours and concatenates skipped across sites", () => {
    assert.deepEqual(
      aggregateGpClientIngestResults([
        {
          cutoff_period_id: "cut-1",
          hours_upserted: 3,
          skipped: [{ full_name: "A", missing: ["id"] }],
        },
        {
          cutoff_period_id: "cut-1",
          hours_upserted: 5,
          skipped: [{ full_name: "B", missing: ["id"] }],
        },
      ]),
      {
        cutoff_period_id: "cut-1",
        hours_upserted: 8,
        skipped: [
          { full_name: "A", missing: ["id"] },
          { full_name: "B", missing: ["id"] },
        ],
        sites_ingested: 2,
      }
    );
  });
});
