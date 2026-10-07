import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeOnboardingReadiness } from "../onboarding-readiness";

describe("computeOnboardingReadiness", () => {
  it("is ready when no tasks or credentials are required", () => {
    const result = computeOnboardingReadiness({
      tasks: [],
      requirements: [],
      credentials: [],
      asOf: "2026-10-07",
    });

    assert.equal(result.ready, true);
    assert.equal(result.blocker_count, 0);
    assert.equal(result.next_action, null);
  });

  it("blocks on one required incomplete task and clears when completed", () => {
    const pending = computeOnboardingReadiness({
      tasks: [
        {
          id: "task-1",
          title: "Sign employment agreement",
          required: true,
          status: "pending",
        },
      ],
      requirements: [],
      credentials: [],
      asOf: "2026-10-07",
    });
    assert.equal(pending.ready, false);
    assert.equal(pending.blocker_count, 1);
    assert.deepEqual(pending.next_action, {
      kind: "task",
      id: "task-1",
      label: "Sign employment agreement",
      status: "pending",
    });

    const completed = computeOnboardingReadiness({
      tasks: [
        {
          id: "task-1",
          title: "Sign employment agreement",
          required: true,
          status: "completed",
        },
      ],
      requirements: [],
      credentials: [],
      asOf: "2026-10-07",
    });
    assert.equal(completed.ready, true);
  });

  it("handles many required tasks and credentials independently", () => {
    const result = computeOnboardingReadiness({
      tasks: [
        { id: "t1", title: "Orientation", required: true, status: "completed" },
        { id: "t2", title: "Safety briefing", required: true, status: "pending" },
        { id: "t3", title: "Uniform fitting", required: false, status: "pending" },
      ],
      requirements: [
        {
          definition_id: "c1",
          code: "nbi",
          name: "NBI clearance",
          required: true,
          blocking: true,
        },
        {
          definition_id: "c2",
          code: "health",
          name: "Health certificate",
          required: true,
          blocking: true,
        },
      ],
      credentials: [
        {
          id: "ec1",
          definition_id: "c1",
          status: "verified",
          issued_on: "2026-01-01",
          expires_on: "2027-01-01",
        },
      ],
      asOf: "2026-10-07",
    });

    assert.equal(result.ready, false);
    assert.equal(result.required_task_count, 2);
    assert.equal(result.completed_required_task_count, 1);
    assert.equal(result.required_credential_count, 2);
    assert.equal(result.valid_required_credential_count, 1);
    assert.equal(result.blocker_count, 2);
  });

  it("marks a verified credential expired after its expiry date", () => {
    const result = computeOnboardingReadiness({
      tasks: [],
      requirements: [
        {
          definition_id: "c1",
          code: "license",
          name: "Professional license",
          required: true,
          blocking: true,
        },
      ],
      credentials: [
        {
          id: "ec1",
          definition_id: "c1",
          status: "verified",
          issued_on: "2025-01-01",
          expires_on: "2026-10-06",
        },
      ],
      asOf: "2026-10-07",
    });

    assert.equal(result.credentials[0]?.status, "expired");
    assert.equal(result.credentials[0]?.blocking, true);
    assert.equal(result.ready, false);
  });

  it("does not block for optional requirements or non-blocking policies", () => {
    const result = computeOnboardingReadiness({
      tasks: [
        { id: "t1", title: "Welcome photo", required: false, status: "pending" },
      ],
      requirements: [
        {
          definition_id: "c1",
          code: "optional",
          name: "Optional certificate",
          required: false,
          blocking: true,
        },
        {
          definition_id: "c2",
          code: "follow-up",
          name: "Follow-up clearance",
          required: true,
          blocking: false,
        },
      ],
      credentials: [],
      asOf: "2026-10-07",
    });

    assert.equal(result.ready, true);
    assert.equal(result.blocker_count, 0);
    assert.deepEqual(
      result.credentials.map((row) => row.status),
      ["optional", "missing"]
    );
  });

  it("treats rejected required work and credentials as blockers", () => {
    const result = computeOnboardingReadiness({
      tasks: [
        { id: "t1", title: "Policy acknowledgement", required: true, status: "rejected" },
      ],
      requirements: [
        {
          definition_id: "c1",
          code: "clearance",
          name: "Client clearance",
          required: true,
          blocking: true,
        },
      ],
      credentials: [
        {
          id: "ec1",
          definition_id: "c1",
          status: "rejected",
          issued_on: null,
          expires_on: null,
        },
      ],
      asOf: "2026-10-07",
    });

    assert.equal(result.ready, false);
    assert.equal(result.blocker_count, 2);
    assert.equal(result.tasks[0]?.blocking, true);
    assert.equal(result.credentials[0]?.status, "rejected");
    assert.equal(result.credentials[0]?.blocking, true);
  });
});
