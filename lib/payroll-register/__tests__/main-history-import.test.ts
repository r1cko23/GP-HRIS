import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { latestAccrualOpenings } from "../main-ytd-opening";
import { planLoanUnpostRestore } from "../unpost-trial";

describe("planLoanUnpostRestore", () => {
  it("restores the oldest balance_before when reversing several posts on one loan", () => {
    const plan = planLoanUnpostRestore([
      {
        loan_id: "loan-1",
        created_at: "2026-09-16T00:00:00Z",
        balance_before: 4000,
        schedule_id: "s3",
      },
      {
        loan_id: "loan-1",
        created_at: "2026-08-01T00:00:00Z",
        balance_before: 5000,
        schedule_id: "s1",
      },
      {
        loan_id: "loan-1",
        created_at: "2026-08-16T00:00:00Z",
        balance_before: 4500,
        schedule_id: "s2",
      },
    ]);
    assert.equal(plan.length, 1);
    assert.equal(plan[0]?.restore_balance, 5000);
    assert.deepEqual(plan[0]?.schedule_ids.sort(), ["s1", "s2", "s3"]);
  });

  it("returns empty when there are no posts", () => {
    assert.deepEqual(planLoanUnpostRestore([]), []);
  });
});

describe("latestAccrualOpenings", () => {
  it("keeps Claire's Aug 16–31 YTD 12200 over the earlier kinsena", () => {
    const openings = latestAccrualOpenings([
      {
        legacyEmployeeId: 1,
        legacyClientId: 130,
        periodStart: "2026-08-01",
        periodEnd: "2026-08-15",
        basic: 7800,
        thirteenthMonth: 650,
        thirteenthMonthYtd: 11550,
        silCutoff: 124.6,
        year: 2026,
        lastName: "Aban",
        firstName: "Claire",
      },
      {
        legacyEmployeeId: 1,
        legacyClientId: 130,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
        basic: 7800,
        thirteenthMonth: 650,
        thirteenthMonthYtd: 12200,
        silCutoff: 124.6,
        year: 2026,
        lastName: "Aban",
        firstName: "Claire",
      },
    ]);
    assert.equal(openings.length, 1);
    assert.equal(openings[0]?.thirteenthMonthYtd, 12200);
    assert.equal(openings[0]?.periodEnd, "2026-08-31");
  });

  it("keeps two people and drops a zero-person set", () => {
    assert.deepEqual(latestAccrualOpenings([]), []);
    const two = latestAccrualOpenings([
      {
        legacyEmployeeId: 1,
        legacyClientId: 130,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
        basic: 7800,
        thirteenthMonth: 650,
        thirteenthMonthYtd: 12200,
        silCutoff: 124.6,
        year: 2026,
        lastName: "Aban",
        firstName: "Claire",
      },
      {
        legacyEmployeeId: 2,
        legacyClientId: 130,
        periodStart: "2026-08-16",
        periodEnd: "2026-08-31",
        basic: 7800,
        thirteenthMonth: 650,
        thirteenthMonthYtd: 8000,
        silCutoff: 124.6,
        year: 2026,
        lastName: "Perez",
        firstName: "Christian",
      },
    ]);
    assert.equal(two.length, 2);
  });

  it("does not let a later adjustment with YTD 0 wipe Tambuyat's prior YTD", () => {
    // MAIN often leaves ytdthirteenmonth at 0 on adjustment runs.
    const openings = latestAccrualOpenings([
      {
        legacyEmployeeId: 99,
        legacyClientId: 130,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-15",
        basic: 4858.92,
        thirteenthMonth: 404.91,
        thirteenthMonthYtd: 2715.4,
        silCutoff: 77.5,
        year: 2026,
        lastName: "Tambuyat",
        firstName: "Ace Christian",
      },
      {
        legacyEmployeeId: 99,
        legacyClientId: 130,
        periodStart: "2026-09-16",
        periodEnd: "2026-09-25",
        basic: 4858.92,
        thirteenthMonth: 404.91,
        thirteenthMonthYtd: 0,
        silCutoff: 0,
        year: 2026,
        lastName: "Tambuyat",
        firstName: "Ace Christian",
      },
    ]);
    assert.equal(openings.length, 1);
    assert.equal(openings[0]?.periodEnd, "2026-09-25");
    assert.equal(
      openings[0]?.thirteenthMonthYtd,
      2715.4 + 404.91,
      "carry prior YTD and add this adjustment's 13th cutoff"
    );
  });

  it("still carries Tambuyat YTD when the zero-YTD adjustment is seen first", () => {
    const openings = latestAccrualOpenings([
      {
        legacyEmployeeId: 99,
        legacyClientId: 130,
        periodStart: "2026-09-16",
        periodEnd: "2026-09-25",
        basic: 4858.92,
        thirteenthMonth: 404.91,
        thirteenthMonthYtd: 0,
        silCutoff: 0,
        year: 2026,
        lastName: "Tambuyat",
        firstName: "Ace Christian",
      },
      {
        legacyEmployeeId: 99,
        legacyClientId: 130,
        periodStart: "2026-09-01",
        periodEnd: "2026-09-15",
        basic: 4858.92,
        thirteenthMonth: 404.91,
        thirteenthMonthYtd: 2715.4,
        silCutoff: 77.5,
        year: 2026,
        lastName: "Tambuyat",
        firstName: "Ace Christian",
      },
    ]);
    assert.equal(openings[0]?.periodEnd, "2026-09-25");
    assert.equal(openings[0]?.thirteenthMonthYtd, 2715.4 + 404.91);
  });
});
