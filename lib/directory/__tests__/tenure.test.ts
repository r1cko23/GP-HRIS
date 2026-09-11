import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  foldTenureRehire,
  inferBarredReason,
  inferFinalPayStatus,
  isRehireEligible,
  seedCurrentTenure,
  type LiveEmployment,
} from "../tenure";

const AS_OF = new Date("2026-09-11T00:00:00Z");
const CLOSED_AT = "2026-09-11T00:00:00.000Z";

const firstHire: LiveEmployment = {
  hire_date: "2021-04-01",
  resign_date: "2022-06-30",
  client_id: "c1",
  branch_id: "b1",
  position_id: "p1",
  daily_rate: 520,
  billing_daily_rate: 580,
  status: "inactive",
  last_payroll_end: "2022-07-25",
};

function currentOnly(live: LiveEmployment) {
  return [seedCurrentTenure(live, AS_OF)];
}

describe("tenure inference", () => {
  it("marks aged barred as final-pay barred", () => {
    assert.equal(
      inferFinalPayStatus({ ...firstHire, status: "barred" }, AS_OF),
      "barred"
    );
    assert.equal(
      inferBarredReason({ ...firstHire, status: "barred" }, AS_OF),
      "unclaimed_final_pay"
    );
  });

  it("marks recent barred as a deployment hold", () => {
    const live: LiveEmployment = {
      ...firstHire,
      status: "barred",
      last_payroll_end: "2026-08-15",
    };
    assert.equal(inferFinalPayStatus(live, AS_OF), "none");
    assert.equal(inferBarredReason(live, AS_OF), "deployment_block");
  });

  it("allows rehire for inactive and final-pay barred only", () => {
    assert.equal(isRehireEligible(firstHire, AS_OF), true);
    assert.equal(
      isRehireEligible({ ...firstHire, status: "barred" }, AS_OF),
      true
    );
    assert.equal(
      isRehireEligible(
        { ...firstHire, status: "barred", last_payroll_end: "2026-08-15" },
        AS_OF
      ),
      false
    );
    assert.equal(
      isRehireEligible({ ...firstHire, status: "float" }, AS_OF),
      false
    );
    assert.equal(
      isRehireEligible(
        { ...firstHire, is_current_engagement: false },
        AS_OF
      ),
      false
    );
  });
});

describe("foldTenureRehire", () => {
  it("seeds one current tenure before any rehire", () => {
    const tenures = currentOnly(firstHire);
    assert.equal(tenures.length, 1);
    assert.equal(tenures[0]?.is_current, true);
    assert.equal(tenures[0]?.sequence, 1);
    assert.equal(tenures[0]?.closed_at, null);
    assert.equal(tenures[0]?.status, "inactive");
  });

  it("freezes prior tenure on inactive rehire and opens a current one", () => {
    const afterFirst = foldTenureRehire(
      currentOnly(firstHire),
      firstHire,
      {
        hire_date: "2026-09-01",
        client_id: "c2",
        branch_id: "b2",
        position_id: "p2",
        daily_rate: 610,
        billing_daily_rate: 690,
      },
      CLOSED_AT,
      AS_OF
    );
    assert.equal(afterFirst.length, 2);
    const closed = afterFirst.find((row) => !row.is_current);
    const current = afterFirst.find((row) => row.is_current);
    assert.equal(closed?.status, "inactive");
    assert.equal(closed?.hire_date, "2021-04-01");
    assert.equal(closed?.resign_date, "2022-06-30");
    assert.equal(closed?.daily_rate, 520);
    assert.equal(closed?.closed_at, CLOSED_AT);
    assert.equal(current?.hire_date, "2026-09-01");
    assert.equal(current?.status, "active");
    assert.equal(current?.resign_date, null);
    assert.equal(current?.daily_rate, 610);
    assert.equal(current?.client_id, "c2");
    assert.equal(current?.closed_at, null);
    assert.equal(afterFirst.filter((row) => row.is_current).length, 1);
  });

  it("keeps final-pay barred frozen after rehire", () => {
    const live: LiveEmployment = { ...firstHire, status: "barred" };
    const after = foldTenureRehire(
      currentOnly(live),
      live,
      { hire_date: "2026-09-01", client_id: "c2", daily_rate: 610 },
      CLOSED_AT,
      AS_OF
    );
    const closed = after.find((row) => !row.is_current);
    assert.equal(closed?.status, "barred");
    assert.equal(closed?.final_pay_status, "barred");
    assert.equal(closed?.barred_reason, "unclaimed_final_pay");
    assert.equal(closed?.daily_rate, 520);
    assert.equal(closed?.resign_date, "2022-06-30");
    const current = after.find((row) => row.is_current);
    assert.equal(current?.status, "active");
    assert.equal(current?.hire_date, "2026-09-01");
    assert.equal(current?.final_pay_status, "none");
    assert.equal(current?.barred_reason, null);
  });

  it("does not mutate a closed tenure on a second rehire", () => {
    const firstReturn: LiveEmployment = {
      hire_date: "2026-09-01",
      resign_date: "2026-12-15",
      client_id: "c2",
      branch_id: "b2",
      position_id: "p2",
      daily_rate: 610,
      billing_daily_rate: 690,
      status: "inactive",
      last_payroll_end: "2026-12-15",
    };
    const two = foldTenureRehire(
      currentOnly(firstHire),
      firstHire,
      {
        hire_date: "2026-09-01",
        client_id: "c2",
        daily_rate: 610,
      },
      CLOSED_AT,
      AS_OF
    );
    const three = foldTenureRehire(
      two,
      firstReturn,
      { hire_date: "2027-03-01", client_id: "c3", daily_rate: 700 },
      "2027-03-01T00:00:00.000Z",
      new Date("2027-03-01T00:00:00Z")
    );
    assert.equal(three.length, 3);
    assert.equal(three.filter((row) => row.is_current).length, 1);
    const original = three.find((row) => row.sequence === 1);
    assert.equal(original?.is_current, false);
    assert.equal(original?.daily_rate, 520);
    assert.equal(original?.hire_date, "2021-04-01");
    assert.equal(original?.resign_date, "2022-06-30");
    assert.equal(original?.closed_at, CLOSED_AT);
    const second = three.find((row) => row.sequence === 2);
    assert.equal(second?.is_current, false);
    assert.equal(second?.daily_rate, 610);
    assert.equal(second?.hire_date, "2026-09-01");
    const latest = three.find((row) => row.is_current);
    assert.equal(latest?.sequence, 3);
    assert.equal(latest?.hire_date, "2027-03-01");
    assert.equal(latest?.daily_rate, 700);
    assert.equal(latest?.status, "active");
  });
});
