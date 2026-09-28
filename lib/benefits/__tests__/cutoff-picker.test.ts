import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBenefitsCutoffLabel,
  pickDefaultBenefitsCutoff,
} from "../cutoff-picker";

describe("pickDefaultBenefitsCutoff", () => {
  it("returns null for empty", () => {
    assert.equal(pickDefaultBenefitsCutoff([]), null);
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
