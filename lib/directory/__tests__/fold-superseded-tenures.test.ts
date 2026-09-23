import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  planFoldSupersededTenures,
  type SupersededEmployeeEpisode,
} from "../fold-superseded-tenures";
import type { TenureRecord } from "../tenure";

function loser(
  partial: Partial<SupersededEmployeeEpisode> &
    Pick<SupersededEmployeeEpisode, "id" | "superseded_by">
): SupersededEmployeeEpisode {
  return {
    organization_id: "org-d",
    hire_date: "2024-01-15",
    resign_date: "2024-06-30",
    client_id: "client-a",
    branch_id: "branch-a",
    position_id: "pos-a",
    daily_rate: 500,
    status: "inactive",
    ...partial,
  };
}

function tenure(partial: Partial<TenureRecord> & Pick<TenureRecord, "sequence">): TenureRecord {
  return {
    hire_date: "2025-01-01",
    resign_date: null,
    client_id: "client-a",
    branch_id: null,
    position_id: null,
    daily_rate: 600,
    billing_daily_rate: null,
    status: "active",
    final_pay_status: "none",
    barred_reason: null,
    is_current: true,
    closed_at: null,
    ...partial,
  };
}

describe("planFoldSupersededTenures", () => {
  it("inserts a closed tenure on the master for each parked episode", () => {
    const existing = new Map<string, TenureRecord[]>([
      ["master", [tenure({ sequence: 1, is_current: true })]],
    ]);
    const inserts = planFoldSupersededTenures(
      [
        loser({
          id: "extra-1",
          superseded_by: "master",
          hire_date: "2023-03-01",
          resign_date: "2023-12-01",
          status: "inactive",
        }),
      ],
      existing,
      { closedAt: "2026-09-23T00:00:00.000Z" }
    );
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.employee_id, "master");
    assert.equal(inserts[0]?.sequence, 2);
    assert.equal(inserts[0]?.is_current, false);
    assert.equal(inserts[0]?.hire_date, "2023-03-01");
    assert.equal(inserts[0]?.final_pay_status, "claimed");
    assert.equal(inserts[0]?.source_employee_id, "extra-1");
    assert.equal(inserts[0]?.closed_at, "2026-09-23T00:00:00.000Z");
  });

  it("skips an episode that already exists on the master (same hire + client)", () => {
    const existing = new Map<string, TenureRecord[]>([
      [
        "master",
        [
          tenure({
            sequence: 1,
            hire_date: "2023-03-01",
            client_id: "client-a",
            is_current: false,
            closed_at: "2024-01-01T00:00:00.000Z",
          }),
          tenure({ sequence: 2, is_current: true }),
        ],
      ],
    ]);
    const inserts = planFoldSupersededTenures(
      [
        loser({
          id: "extra-1",
          superseded_by: "master",
          hire_date: "2023-03-01",
          client_id: "client-a",
        }),
      ],
      existing
    );
    assert.equal(inserts.length, 0);
  });

  it("orders multiple losers by hire date and increments sequence", () => {
    const existing = new Map<string, TenureRecord[]>([
      ["master", [tenure({ sequence: 1, is_current: true })]],
    ]);
    const inserts = planFoldSupersededTenures(
      [
        loser({
          id: "later",
          superseded_by: "master",
          hire_date: "2024-06-01",
          client_id: "client-b",
        }),
        loser({
          id: "earlier",
          superseded_by: "master",
          hire_date: "2022-01-01",
          client_id: "client-c",
        }),
      ],
      existing
    );
    assert.equal(inserts.length, 2);
    assert.equal(inserts[0]?.source_employee_id, "earlier");
    assert.equal(inserts[0]?.sequence, 2);
    assert.equal(inserts[1]?.source_employee_id, "later");
    assert.equal(inserts[1]?.sequence, 3);
  });

  it("handles a master with no existing tenures", () => {
    const inserts = planFoldSupersededTenures(
      [loser({ id: "extra", superseded_by: "master", hire_date: "2021-05-01" })],
      new Map()
    );
    assert.equal(inserts.length, 1);
    assert.equal(inserts[0]?.sequence, 1);
    assert.equal(inserts[0]?.is_current, false);
  });
});
