import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  canApproveClientIndustry,
  canOpenEmployee201,
  nextStatusAfterPositionEdit,
  planReviewPosition,
  planSubmitPosition,
  positionHasRequiredRates,
} from "../position-approval";

describe("positionHasRequiredRates", () => {
  it("requires positive payroll and billing rates", () => {
    assert.equal(
      positionHasRequiredRates({
        payroll_daily_rate: 600,
        billing_daily_rate: 700,
      }),
      true
    );
    assert.equal(
      positionHasRequiredRates({
        payroll_daily_rate: 600,
        billing_daily_rate: null,
      }),
      false
    );
  });
});

describe("canApproveClientIndustry", () => {
  it("routes Hotel to hotel grant and Non-Hotel to non_hotel grant", () => {
    assert.equal(
      canApproveClientIndustry({
        capabilityKeys: ["fn:positions.approve.hotel"],
        industry: "HOTEL",
      }),
      true
    );
    assert.equal(
      canApproveClientIndustry({
        capabilityKeys: ["fn:positions.approve.hotel"],
        industry: "NON-HOTEL",
      }),
      false
    );
    assert.equal(
      canApproveClientIndustry({
        capabilityKeys: ["fn:positions.approve.non_hotel"],
        industry: "NON-HOTEL",
      }),
      true
    );
  });

  it("lets admin.system approve either industry", () => {
    assert.equal(
      canApproveClientIndustry({
        capabilityKeys: ["fn:admin.system"],
        industry: "HOTEL",
      }),
      true
    );
  });
});

describe("planSubmitPosition / planReviewPosition", () => {
  it("submits draft with rates to pending", () => {
    const r = planSubmitPosition({
      currentStatus: "draft",
      rates: { payroll_daily_rate: 500, billing_daily_rate: 550 },
    });
    assert.deepEqual(r, { ok: true, next: "pending" });
  });

  it("rejects submit without rates", () => {
    const r = planSubmitPosition({
      currentStatus: "draft",
      rates: { payroll_daily_rate: null, billing_daily_rate: 550 },
    });
    assert.equal(r.ok, false);
  });

  it("approves pending; reject needs reason", () => {
    assert.deepEqual(
      planReviewPosition({ currentStatus: "pending", decision: "approve" }),
      { ok: true, next: "approved", rejection_reason: null }
    );
    assert.equal(
      planReviewPosition({
        currentStatus: "pending",
        decision: "reject",
        rejection_reason: "",
      }).ok,
      false
    );
  });
});

describe("nextStatusAfterPositionEdit", () => {
  it("returns approved cards to pending when rates remain complete", () => {
    assert.equal(
      nextStatusAfterPositionEdit({
        currentStatus: "approved",
        titleOrRatesChanged: true,
        rates: { payroll_daily_rate: 600, billing_daily_rate: 700 },
      }),
      "pending"
    );
  });
});

describe("canOpenEmployee201", () => {
  it("blocks roster-only actors without 201 sections", () => {
    assert.equal(
      canOpenEmployee201({
        capabilityKeys: ["page:people.clients", "fn:clients.roster.view"],
        hasAnyEmployeeSection: false,
      }),
      false
    );
    assert.equal(
      canOpenEmployee201({
        capabilityKeys: [
          "page:people.employees",
          "fn:employees.section.core",
        ],
        hasAnyEmployeeSection: true,
      }),
      true
    );
  });
});
