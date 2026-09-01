import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildOrganicAuditChecklist,
  deriveOrganicCutoffPrimaryAction,
  deriveOrganicCutoffSteps,
  summarizeHoursReadiness,
} from "../organic-cutoff-workflow";

describe("deriveOrganicCutoffSteps", () => {
  it("starts at aggregate when draft with no hours", () => {
    const steps = deriveOrganicCutoffSteps({
      periodStatus: "draft",
      hoursRows: 0,
      hasRegister: false,
      registerStatus: null,
    });
    assert.equal(
      steps.find((s) => s.id === "aggregate")?.status,
      "attention"
    );
    assert.equal(
      steps.find((s) => s.id === "downloads")?.status,
      "upcoming"
    );
    assert.equal(
      steps.find((s) => s.id === "audit")?.sectionId,
      "cutoff-readiness"
    );
  });

  it("flags audit when readiness issues remain", () => {
    const steps = deriveOrganicCutoffSteps({
      periodStatus: "pending_audit",
      hoursRows: 10,
      hasRegister: false,
      registerStatus: null,
      missingRate: 2,
      zeroHours: 0,
    });
    assert.equal(steps.find((s) => s.id === "audit")?.status, "attention");
    assert.equal(steps.find((s) => s.id === "approve")?.status, "upcoming");
  });

  it("moves to build after approve without register", () => {
    const steps = deriveOrganicCutoffSteps({
      periodStatus: "approved",
      hoursRows: 10,
      hasRegister: false,
      registerStatus: null,
    });
    assert.equal(steps.find((s) => s.id === "build")?.status, "current");
    assert.equal(steps.find((s) => s.id === "approve")?.status, "complete");
  });

  it("lands on downloads when posted", () => {
    const steps = deriveOrganicCutoffSteps({
      periodStatus: "posted",
      hoursRows: 10,
      hasRegister: true,
      registerStatus: "posted",
    });
    assert.equal(steps.find((s) => s.id === "downloads")?.status, "current");
    assert.equal(steps.find((s) => s.id === "post")?.status, "complete");
  });
});

describe("deriveOrganicCutoffPrimaryAction", () => {
  it("asks to aggregate first", () => {
    const action = deriveOrganicCutoffPrimaryAction({
      periodStatus: "draft",
      hoursRows: 0,
      hasRegister: false,
      registerStatus: null,
    });
    assert.equal(action.id, "aggregate");
    assert.equal(action.mutates, true);
  });

  it("asks to clear flags before approve", () => {
    const action = deriveOrganicCutoffPrimaryAction({
      periodStatus: "pending_audit",
      hoursRows: 12,
      hasRegister: false,
      registerStatus: null,
      missingRate: 1,
    });
    assert.equal(action.id, "review_hours");
    assert.equal(action.blockedByReadiness, true);
  });

  it("requires confirm before post", () => {
    const action = deriveOrganicCutoffPrimaryAction({
      periodStatus: "approved",
      hoursRows: 12,
      hasRegister: true,
      registerStatus: "draft",
    });
    assert.equal(action.id, "post");
    assert.equal(action.requiresConfirm, true);
  });
});

describe("buildOrganicAuditChecklist", () => {
  it("warns on missing rates and zero hours", () => {
    const checks = buildOrganicAuditChecklist({
      periodStatus: "draft",
      hoursRows: 5,
      punchRows: 40,
      missingRate: 1,
      zeroHours: 2,
      hasRegister: false,
      registerStatus: null,
    });
    assert.equal(checks.find((c) => c.id === "rates")?.status, "warn");
    assert.equal(checks.find((c) => c.id === "hours")?.status, "warn");
    assert.equal(checks.find((c) => c.id === "aggregated")?.status, "pass");
  });
});

describe("summarizeHoursReadiness", () => {
  it("counts missing rates and zero-hour rows", () => {
    const result = summarizeHoursReadiness([
      {
        daily_rate_payroll: 500,
        actual_regular_hours: 8,
      },
      {
        daily_rate_payroll: 0,
        actual_regular_hours: 8,
      },
      {
        daily_rate_payroll: 500,
        actual_regular_hours: 0,
        overtime_hours: 0,
      },
    ]);
    assert.equal(result.hours_rows, 3);
    assert.equal(result.missing_rate, 1);
    assert.equal(result.zero_hours, 1);
  });
});
