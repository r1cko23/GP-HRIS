import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planPositionFromCsmTitle } from "../position-from-csm-title";

const BATANGAS_JR = {
  id: "d03c6107-2a2a-4e0f-8bc6-39f3b7f268e1",
  job_title: "Extruck Salesman Jr. (Batangas)",
  payroll_daily_rate: 695,
};
const BATANGAS_SR = {
  id: "786f336e-49a7-401b-a919-a9aa82301b86",
  job_title: "Extruck Salesman Sr. (Batangas)",
  payroll_daily_rate: 695,
};
const BAESA_SR = {
  id: "08586a6c-289e-4526-a981-4070dd1b7bea",
  job_title: "Extruck Salesman Sr. (Baesa)",
  payroll_daily_rate: 695,
};

const CARDS = [BATANGAS_JR, BATANGAS_SR, BAESA_SR];

describe("planPositionFromCsmTitle", () => {
  it("assigns the destination-site Sr card for CSM SR Extruck (Dayto / Babadilla / Umali)", () => {
    const plan = planPositionFromCsmTitle({
      employeeId: "dayto",
      employee_code: "202209-00148",
      current_position_id: null,
      daily_rate: 677.25,
      csm_position: "SR Extruck Salesman",
      destination_site: "Batangas",
      cards: CARDS,
    });
    assert.equal(plan.action, "assign");
    if (plan.action !== "assign") return;
    assert.equal(plan.position_id, BATANGAS_SR.id);
    assert.equal(plan.job_title, BATANGAS_SR.job_title);
    assert.equal(plan.daily_rate, 695);
    assert.equal(plan.keep_employee_code, "202209-00148");
  });

  it("assigns the destination-site Jr card for CSM JR Extruck (Mazo)", () => {
    const plan = planPositionFromCsmTitle({
      employeeId: "mazo",
      employee_code: "202604-00028",
      current_position_id: null,
      daily_rate: 695,
      csm_position: "JR Extruck Salesman",
      destination_site: "Batangas",
      cards: CARDS,
    });
    assert.equal(plan.action, "assign");
    if (plan.action !== "assign") return;
    assert.equal(plan.position_id, BATANGAS_JR.id);
    assert.equal(plan.daily_rate, 695);
  });

  it("does not pick another plant's card even when rank matches", () => {
    const plan = planPositionFromCsmTitle({
      employeeId: "dayto",
      employee_code: "202209-00148",
      current_position_id: null,
      daily_rate: 677.25,
      csm_position: "SR Extruck Salesman",
      destination_site: "Batangas",
      cards: [BAESA_SR],
    });
    assert.deepEqual(plan, { action: "skip", reason: "no_match" });
  });

  it("is a no-op when the person already has that destination card", () => {
    const plan = planPositionFromCsmTitle({
      employeeId: "dayto",
      employee_code: "202209-00148",
      current_position_id: BATANGAS_SR.id,
      daily_rate: 695,
      csm_position: "SR Extruck Salesman",
      destination_site: "Batangas",
      cards: CARDS,
    });
    assert.deepEqual(plan, { action: "noop" });
  });

  it("skips when CSM has no position text", () => {
    const plan = planPositionFromCsmTitle({
      employeeId: "x",
      employee_code: "1",
      current_position_id: null,
      daily_rate: 0,
      csm_position: "",
      destination_site: "Batangas",
      cards: CARDS,
    });
    assert.deepEqual(plan, { action: "skip", reason: "no_csm_title" });
  });
});
