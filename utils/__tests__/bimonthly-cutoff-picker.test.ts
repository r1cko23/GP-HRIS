import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatBiMonthlyCutoffRange,
  listRecentBiMonthlyCutoffs,
  parseBiMonthlyCutoffValue,
} from "../bimonthly";

describe("bi-monthly cutoff range picker", () => {
  it("formats a first and second cutoff as one range label", () => {
    assert.equal(
      formatBiMonthlyCutoffRange(new Date(2026, 8, 1)),
      "Sep 1–15, 2026"
    );
    assert.equal(
      formatBiMonthlyCutoffRange(new Date(2026, 8, 16)),
      "Sep 16–30, 2026"
    );
  });

  it("lists recent cutoffs newest first for a single selector", () => {
    const options = listRecentBiMonthlyCutoffs(new Date(2026, 8, 21), 3);
    assert.deepEqual(
      options.map((option) => option.value),
      ["2026-09-second", "2026-09-first", "2026-08-second"]
    );
    assert.equal(options[0]?.label, "Sep 16–30, 2026");
    assert.equal(options[1]?.label, "Sep 1–15, 2026");
    assert.equal(options[0]?.cutoff, "second");
  });

  it("parses a cutoff value back into month and half", () => {
    assert.deepEqual(parseBiMonthlyCutoffValue("2026-09-first"), {
      month: new Date(2026, 8, 1),
      cutoff: "first",
    });
    assert.equal(parseBiMonthlyCutoffValue("bad"), null);
  });
});
