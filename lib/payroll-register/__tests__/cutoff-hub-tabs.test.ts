import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cutoffHubTabForSection } from "../cutoff-hub-tabs";

describe("cutoffHubTabForSection", () => {
  it("maps hours workflow anchors to the Hours tab", () => {
    assert.equal(cutoffHubTabForSection("cutoff-hours"), "hours");
    assert.equal(cutoffHubTabForSection("cutoff-readiness"), "hours");
  });

  it("leaves the always-visible guide on the current tab", () => {
    assert.equal(cutoffHubTabForSection("cutoff-guide"), null);
  });

  it("maps register and pre-post review to the Register tab", () => {
    assert.equal(cutoffHubTabForSection("payroll-register"), "register");
    assert.equal(cutoffHubTabForSection("pre-post-review"), "register");
  });

  it("maps downloads and billing to their own tabs", () => {
    assert.equal(cutoffHubTabForSection("cutoff-downloads"), "downloads");
    assert.equal(cutoffHubTabForSection("client-billing"), "billing");
  });

  it("falls back to Hours for an unknown section", () => {
    assert.equal(cutoffHubTabForSection(""), "hours");
    assert.equal(cutoffHubTabForSection("missing"), "hours");
  });
});
