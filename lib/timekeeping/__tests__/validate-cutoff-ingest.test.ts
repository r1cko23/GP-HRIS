import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectEmployeeIds,
  directoryIngestEmployeeFilters,
  missingIngestEmployeeIds,
} from "../validate-cutoff-ingest";

describe("directoryIngestEmployeeFilters", () => {
  it("scopes eligibility to the Directory employer, not the live Branch", () => {
    assert.deepEqual(
      directoryIngestEmployeeFilters({
        organizationId: "org-1",
        clientId: "nabati",
        branchId: "batangas",
      }),
      {
        organization_id: "org-1",
        client_id: "nabati",
        is_current_engagement: true,
      }
    );
  });

  it("still ignores branch when the cutoff period has no site", () => {
    assert.deepEqual(
      directoryIngestEmployeeFilters({
        organizationId: "org-1",
        clientId: "nabati",
        branchId: null,
      }),
      {
        organization_id: "org-1",
        client_id: "nabati",
        is_current_engagement: true,
      }
    );
  });
});

describe("missingIngestEmployeeIds", () => {
  it("allows a mid-cutoff Transfer when the person is still on the same employer", () => {
    assert.deepEqual(
      missingIngestEmployeeIds(
        ["morales"],
        [{ id: "morales", status: "active" }]
      ),
      []
    );
  });

  it("rejects people whose current Engagement is on another employer", () => {
    assert.deepEqual(
      missingIngestEmployeeIds(["morales", "other"], [{ id: "morales", status: "active" }]),
      ["other"]
    );
  });

  it("handles zero requested ids", () => {
    assert.deepEqual(missingIngestEmployeeIds([], []), []);
  });

  it("dedupes requested ids", () => {
    assert.deepEqual(
      missingIngestEmployeeIds(["a", "a", "b"], [{ id: "a", status: "active" }]),
      ["b"]
    );
  });
});

describe("collectEmployeeIds", () => {
  it("collects from hours and punches", () => {
    assert.deepEqual(
      collectEmployeeIds(
        [{ directory_employee_id: "a" } as never],
        [{ directory_employee_id: "b" } as never]
      ),
      ["a", "b"]
    );
  });
});
