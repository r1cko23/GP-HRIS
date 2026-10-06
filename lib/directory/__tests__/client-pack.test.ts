import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientPackForIndustry,
  clientPackStatus,
  normalizeClientIndustry,
} from "../client-pack";

describe("clientPackForIndustry", () => {
  it("maps HOTEL and everything else to Non-Hotel", () => {
    assert.equal(normalizeClientIndustry("HOTEL"), "HOTEL");
    assert.equal(normalizeClientIndustry("hotel"), "HOTEL");
    assert.equal(normalizeClientIndustry("NON-HOTEL"), "NON-HOTEL");
    assert.equal(normalizeClientIndustry(null), "NON-HOTEL");
    assert.deepEqual(
      clientPackForIndustry("HOTEL").map((item) => item.key),
      ["employment_contract", "government_id", "police_clearance"]
    );
    assert.deepEqual(
      clientPackForIndustry("NON-HOTEL").map((item) => item.key),
      ["employment_contract", "barangay_clearance", "government_id"]
    );
  });
});

describe("clientPackStatus", () => {
  it("marks present covering docs ok and never blocks", () => {
    const status = clientPackStatus({
      industry: "HOTEL",
      asOfDate: "2026-10-06",
      documents: [
        {
          doc_type: "employment_contract",
          expires_on: null,
          uploaded_at: "2026-01-01T00:00:00Z",
          superseded_at: null,
        },
        {
          doc_type: "police_clearance",
          expires_on: "2026-09-01",
          uploaded_at: "2026-01-01T00:00:00Z",
          superseded_at: null,
        },
      ],
    });
    assert.equal(status.blocks, false);
    assert.equal(status.industryLabel, "Hotel");
    assert.equal(
      status.items.find((item) => item.key === "employment_contract")?.ok,
      true
    );
    assert.equal(
      status.items.find((item) => item.key === "government_id")?.ok,
      false
    );
    assert.equal(
      status.items.find((item) => item.key === "police_clearance")?.ok,
      false
    );
    assert.equal(
      status.items.every((item) => item.required === false),
      true
    );
  });
});
