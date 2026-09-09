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
});
