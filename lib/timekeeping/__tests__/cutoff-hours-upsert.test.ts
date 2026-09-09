import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CUTOFF_HOURS_UPSERT_ON_CONFLICT,
  dedupeCutoffHoursRowsByPersonPosition,
} from "../cutoff-hours-upsert";

describe("CUTOFF_HOURS_UPSERT_ON_CONFLICT", () => {
  it("matches ADR 0014 / migration 222 unique key (period + person + position)", () => {
    // Independent of implementation: constraint name in 222_cutoff_branch_and_position_assignment.sql
    assert.equal(
      CUTOFF_HOURS_UPSERT_ON_CONFLICT,
      "cutoff_period_id,directory_employee_id,position_id"
    );
  });
});

describe("dedupeCutoffHoursRowsByPersonPosition", () => {
  it("keeps two positions for the same person as separate rows", () => {
    const rows = dedupeCutoffHoursRowsByPersonPosition([
      {
        directory_employee_id: "emp-1",
        position_id: "pos-a",
        hours_work: 40,
        overtime_hours: 2,
      },
      {
        directory_employee_id: "emp-1",
        position_id: "pos-b",
        hours_work: 16,
        overtime_hours: 0,
      },
    ]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0]?.hours_work, 40);
    assert.equal(rows[1]?.hours_work, 16);
  });

  it("sums duplicate office links for the same person+position (cardinality many)", () => {
    const rows = dedupeCutoffHoursRowsByPersonPosition([
      {
        directory_employee_id: "emp-1",
        position_id: "pos-a",
        hours_work: 20,
        overtime_hours: 1,
      },
      {
        directory_employee_id: "emp-1",
        position_id: "pos-a",
        hours_work: 20,
        overtime_hours: 3,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.hours_work, 40);
    assert.equal(rows[0]?.overtime_hours, 4);
  });

  it("treats null position as its own key (Organic single engagement)", () => {
    const rows = dedupeCutoffHoursRowsByPersonPosition([
      {
        directory_employee_id: "emp-1",
        position_id: null,
        hours_work: 8,
      },
      {
        directory_employee_id: "emp-1",
        position_id: null,
        hours_work: 8,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0]?.hours_work, 16);
  });
});
