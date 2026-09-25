import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEmployeeWorkCounts } from "../work-queues";

describe("mapEmployeeWorkCounts", () => {
  it("includes for_verification for the People hub queue badge", () => {
    const mapped = mapEmployeeWorkCounts({
      needs_review: 2,
      missing_statutory: 3,
      missing_documents: 4,
      incomplete_201: 5,
      for_verification: 7,
    });
    assert.equal(mapped.for_verification, 7);
    assert.equal(mapped.needs_review, 2);
  });

  it("defaults missing for_verification to zero (older RPC rows)", () => {
    const mapped = mapEmployeeWorkCounts({
      needs_review: 1,
      missing_statutory: 0,
      missing_documents: 0,
      incomplete_201: 0,
    });
    assert.equal(mapped.for_verification, 0);
  });
});
