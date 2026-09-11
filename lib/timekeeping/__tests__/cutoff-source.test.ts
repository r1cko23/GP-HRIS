import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  cutoffCreateRequiresBranch,
  cutoffSourceAppForOrganizationName,
  GP_CLIENT_CUTOFF_SOURCE_APP,
  canIngestFromGpClient,
  usesOfficeClockAggregate,
} from "../cutoff-types";

describe("cutoffSourceAppForOrganizationName", () => {
  it("keeps Organic house on the office clock path", () => {
    assert.equal(
      cutoffSourceAppForOrganizationName("Organic"),
      "gp-hris-organic"
    );
    assert.equal(
      cutoffSourceAppForOrganizationName("Organic · GP house"),
      "gp-hris-organic"
    );
  });

  it("marks Deployed cutoffs as GP-Client ingest (no office aggregate)", () => {
    assert.equal(
      cutoffSourceAppForOrganizationName("Deployed"),
      GP_CLIENT_CUTOFF_SOURCE_APP
    );
    assert.equal(
      cutoffSourceAppForOrganizationName("Deployed · clients"),
      "gp-payroll-timekeeping-attendance"
    );
  });
});

describe("cutoffCreateRequiresBranch", () => {
  it("is required on Deployed and not on Organic house", () => {
    assert.equal(cutoffCreateRequiresBranch("Deployed"), true);
    assert.equal(cutoffCreateRequiresBranch("Organic"), false);
    assert.equal(cutoffCreateRequiresBranch(null), true);
  });
});

describe("usesOfficeClockAggregate", () => {
  it("is true for Organic house cutoffs", () => {
    assert.equal(usesOfficeClockAggregate("gp-hris-organic"), true);
    assert.equal(usesOfficeClockAggregate(null), true);
    assert.equal(usesOfficeClockAggregate(undefined), true);
  });

  it("is false when hours already come from GP-Client ingest", () => {
    assert.equal(
      usesOfficeClockAggregate(GP_CLIENT_CUTOFF_SOURCE_APP),
      false
    );
    assert.equal(
      usesOfficeClockAggregate("gp-payroll-timekeeping-attendance"),
      false
    );
  });
});

describe("canIngestFromGpClient", () => {
  it("is only for Deployed cutoffs that are still draft or pending audit", () => {
    assert.equal(
      canIngestFromGpClient(GP_CLIENT_CUTOFF_SOURCE_APP, "draft"),
      true
    );
    assert.equal(
      canIngestFromGpClient(GP_CLIENT_CUTOFF_SOURCE_APP, "pending_audit"),
      true
    );
    assert.equal(
      canIngestFromGpClient(GP_CLIENT_CUTOFF_SOURCE_APP, "posted"),
      false
    );
    assert.equal(canIngestFromGpClient("gp-hris-organic", "draft"), false);
    assert.equal(canIngestFromGpClient(null, "draft"), false);
  });
});
