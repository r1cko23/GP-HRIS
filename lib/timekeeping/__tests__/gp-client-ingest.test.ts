import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_PRODUCTION_GP_CLIENT_API_BASE,
  gpClientIngestBody,
  resolveGpClientApiBase,
} from "../gp-client-ingest";

describe("gpClientIngestBody", () => {
  it("sends Directory ids and dates so GP-Client can find the Validated period", () => {
    assert.deepEqual(
      gpClientIngestBody({
        id: "cut-1",
        client_id: "client-1",
        branch_id: "branch-1",
        period_start: "2026-09-01",
        period_end: "2026-09-15",
      }),
      {
        directory_cutoff_period_id: "cut-1",
        directory_client_id: "client-1",
        directory_branch_id: "branch-1",
        period_start: "2026-09-01",
        period_end: "2026-09-15",
      }
    );
  });
});

describe("resolveGpClientApiBase", () => {
  it("uses env when set", () => {
    assert.equal(
      resolveGpClientApiBase({
        GP_CLIENT_API_BASE_URL: "https://custom.example/",
        NODE_ENV: "production",
      }),
      "https://custom.example"
    );
  });

  it("defaults production to payroll.greenpasture.ph when env is unset", () => {
    assert.equal(
      resolveGpClientApiBase({ NODE_ENV: "production" }),
      DEFAULT_PRODUCTION_GP_CLIENT_API_BASE
    );
  });

  it("defaults local to localhost:3001", () => {
    assert.equal(
      resolveGpClientApiBase({ NODE_ENV: "development" }),
      "http://localhost:3001"
    );
  });
});
