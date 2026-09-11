import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gpClientIngestBody } from "../gp-client-ingest";

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
