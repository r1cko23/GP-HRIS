import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  approvalQueueWeekParam,
  buildApprovalQueueSearch,
  parseApprovalQueueStatus,
  parseApprovalQueueWeek,
} from "../approval-queue-url";

const OT_STATUSES = ["all", "pending", "approved", "rejected"] as const;

describe("approval-queue-url", () => {
  it("defaults status to pending when missing or unknown", () => {
    assert.equal(parseApprovalQueueStatus(null, OT_STATUSES), "pending");
    assert.equal(parseApprovalQueueStatus("nope", OT_STATUSES), "pending");
    assert.equal(parseApprovalQueueStatus("approved", OT_STATUSES), "approved");
  });

  it("parses week Monday and builds round-trip params", () => {
    const week = parseApprovalQueueWeek("2026-10-15"); // Wednesday
    assert.equal(approvalQueueWeekParam(week), "2026-10-12"); // Monday
    const qs = buildApprovalQueueSearch("pending", week);
    assert.equal(qs, "status=pending&week=2026-10-12");
  });
});
