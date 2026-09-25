import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildClientActiveSummary } from "../client-active-summary";

describe("buildClientActiveSummary", () => {
  it("counts zero when there are no clients", () => {
    assert.deepEqual(buildClientActiveSummary([], new Map()), {
      active_clients: 0,
      active_employees: 0,
    });
  });

  it("sums active employees only across active clients", () => {
    const life = new Map([
      ["a", { active_count: 10 }],
      ["b", { active_count: 5 }],
      ["c", { active_count: 99 }],
    ]);
    const summary = buildClientActiveSummary(
      [
        { id: "a", status: "active" },
        { id: "b", status: "active" },
        { id: "c", status: "inactive" },
      ],
      life
    );
    assert.deepEqual(summary, {
      active_clients: 2,
      active_employees: 15,
    });
  });

  it("treats missing lifecycle rows as zero active employees", () => {
    const summary = buildClientActiveSummary(
      [{ id: "solo", status: "active" }],
      new Map()
    );
    assert.deepEqual(summary, {
      active_clients: 1,
      active_employees: 0,
    });
  });

  it("coerces string active_count values from RPC rows", () => {
    const life = new Map([["a", { active_count: "7" }]]);
    const summary = buildClientActiveSummary(
      [{ id: "a", status: "active" }],
      life
    );
    assert.equal(summary.active_employees, 7);
  });
});
