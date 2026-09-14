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

  it("shows Ingest as step 1 when hours come from GP-Client", () => {
    const steps = deriveOrganicCutoffSteps({
      periodStatus: "draft",
      hoursRows: 0,
      hasRegister: false,
      registerStatus: null,
      skipOfficeAggregate: true,
    });
    const ingest = steps.find((s) => s.id === "aggregate");
    assert.equal(ingest?.title, "Ingest");
    assert.equal(ingest?.status, "attention");
    assert.equal(steps[0]?.id, "aggregate");
    assert.equal(steps[0]?.number, 1);
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

  it("asks to ingest GP-Client hours by button, not wait or auto-run", () => {
    const action = deriveOrganicCutoffPrimaryAction({
      periodStatus: "draft",
      hoursRows: 0,
      hasRegister: false,
      registerStatus: null,
      skipOfficeAggregate: true,
    });
    assert.equal(action.id, "ingest");
    assert.equal(action.mutates, true);
    assert.match(action.label, /ingest/i);
    assert.equal(action.label.includes("Waiting"), false);
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

  it("points posted downloads at the Register tab, not a separate Payslips page", () => {
    const action = deriveOrganicCutoffPrimaryAction({
      periodStatus: "posted",
      hoursRows: 12,
      hasRegister: true,
      registerStatus: "posted",
    });
    assert.equal(action.id, "downloads");
    assert.equal(action.sectionId, "cutoff-downloads");
    assert.match(action.description, /Register tab/);
    assert.equal(action.description.includes("Payslips tab"), false);
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

  it("warns when hour rows are missing statutory numbers", () => {
    const checks = buildOrganicAuditChecklist({
      periodStatus: "approved",
      hoursRows: 5,
      punchRows: 40,
      missingRate: 0,
      zeroHours: 0,
      hasRegister: false,
      registerStatus: null,
      missingStatutory: 2,
    });
    const statutory = checks.find((c) => c.id === "statutory");
    assert.equal(statutory?.status, "warn");
    assert.match(statutory?.detail ?? "", /2 person/);
  });

  it("passes statutory when nobody is missing IDs", () => {
    const checks = buildOrganicAuditChecklist({
      periodStatus: "approved",
      hoursRows: 5,
      punchRows: 40,
      missingRate: 0,
      zeroHours: 0,
      hasRegister: false,
      registerStatus: null,
      missingStatutory: 0,
    });
    assert.equal(checks.find((c) => c.id === "statutory")?.status, "pass");
  });

  it("does not tell a GP-Client cutoff to run Aggregate", () => {
    const checks = buildOrganicAuditChecklist({
      periodStatus: "draft",
      hoursRows: 0,
      punchRows: 0,
      missingRate: 0,
      zeroHours: 0,
      hasRegister: false,
      registerStatus: null,
      skipOfficeAggregate: true,
    });
    const hoursIn = checks.find((c) => c.id === "aggregated");
    assert.equal(hoursIn?.label, "Hours ingested");
    assert.match(hoursIn?.detail ?? "", /Ingest/);
    assert.equal(hoursIn?.detail.includes("wait"), false);
    assert.equal(hoursIn?.detail.includes("Aggregate"), false);
    assert.equal(
      checks.find((c) => c.id === "rates")?.detail,
      "Available after ingest"
    );
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
