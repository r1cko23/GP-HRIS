import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBenefitsCutoffLabel,
  isBenefitsCutoffEditable,
  listEditableBenefitsCutoffs,
  pickDefaultBenefitsCutoff,
} from "../cutoff-picker";

describe("isBenefitsCutoffEditable", () => {
  it("hides posted and closed", () => {
    assert.equal(isBenefitsCutoffEditable({ status: "posted" }), false);
    assert.equal(isBenefitsCutoffEditable({ status: "closed" }), false);
    assert.equal(isBenefitsCutoffEditable({ status: "draft" }), true);
    assert.equal(isBenefitsCutoffEditable({ status: "pending_audit" }), true);
    assert.equal(isBenefitsCutoffEditable({ status: "approved" }), true);
  });
});

describe("listEditableBenefitsCutoffs", () => {
  it("drops posted rows from the picker list", () => {
    const rows = listEditableBenefitsCutoffs([
      {
        id: "draft",
        period_start: "2026-09-01",
        period_end: "2026-09-15",
        status: "draft",
      },
      {
        id: "posted",
        period_start: "2026-08-01",
        period_end: "2026-08-15",
        status: "posted",
      },
    ]);
    assert.deepEqual(
      rows.map((r) => r.id),
      ["draft"]
    );
  });
});

describe("pickDefaultBenefitsCutoff", () => {
  it("returns null for empty", () => {
    assert.equal(pickDefaultBenefitsCutoff([]), null);
  });

  it("returns null when only posted cutoffs exist", () => {
    assert.equal(
      pickDefaultBenefitsCutoff([
        {
          id: "posted",
          period_start: "2026-09-01",
          period_end: "2026-09-15",
          status: "posted",
        },
      ]),
      null
    );
  });

  it("prefers non-posted and latest period_end", () => {
    const pick = pickDefaultBenefitsCutoff([
      {
        id: "old",
        period_start: "2026-08-01",
        period_end: "2026-08-15",
        status: "open",
      },
      {
        id: "new",
        period_start: "2026-08-16",
        period_end: "2026-08-31",
        status: "draft",
      },
      {
        id: "posted",
        period_start: "2026-09-01",
        period_end: "2026-09-15",
        status: "posted",
      },
    ]);
    assert.equal(pick?.id, "new");
    assert.equal(
      formatBenefitsCutoffLabel(pick!),
      "2026-08-16 → 2026-08-31 (draft)"
    );
  });
});
