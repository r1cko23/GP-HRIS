import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EMPLOYEE_ONBOARD_STEPS,
  employeeOnboardStepsVisible,
  firstIncompleteOnboardStep,
  pathAfterEmployeeHireIdentity,
} from "../onboard";
import {
  clientWizardSteps,
  isOrganicOrganizationName,
} from "../client-wizard";

describe("EMPLOYEE_ONBOARD_STEPS", () => {
  it("keeps assignment in the full catalog for incomplete placement resume", () => {
    assert.deepEqual(
      EMPLOYEE_ONBOARD_STEPS.map((step) => step.id),
      ["identity", "assignment", "government", "documents"]
    );
  });

  it("hub hire with placement already saved is three steps only", () => {
    const steps = employeeOnboardStepsVisible({ placementComplete: true });
    assert.deepEqual(
      steps.map((step) => step.id),
      ["identity", "government", "documents"]
    );
    assert.deepEqual(
      steps.map((step) => step.number),
      [1, 2, 3]
    );
  });

  it("does not invite skipping documents for later backfill", () => {
    const documents = EMPLOYEE_ONBOARD_STEPS.find(
      (step) => step.id === "documents"
    );
    assert.ok(documents);
    assert.match(documents.description, /before finishing hire/i);
    assert.doesNotMatch(documents.description, /skip|backfill/i);
  });
});

describe("firstIncompleteOnboardStep", () => {
  it("starts at identity when birth date is missing", () => {
    assert.equal(
      firstIncompleteOnboardStep({
        last_name: "Santos",
        first_name: "Ana",
      }),
      "identity"
    );
  });

  it("resumes at government after identity and assignment are filled", () => {
    assert.equal(
      firstIncompleteOnboardStep({
        last_name: "Santos",
        first_name: "Ana",
        birth_date: "1990-01-01",
        sex: "F",
        mobile: "0917",
        hire_date: "2026-01-01",
        client_id: "c1",
        position_id: "p1",
        daily_rate: 500,
      }),
      "government"
    );
  });

  it("returns null when hire fields are filled even with empty pay channel", () => {
    assert.equal(
      firstIncompleteOnboardStep({
        last_name: "Santos",
        first_name: "Ana",
        birth_date: "1990-01-01",
        sex: "F",
        mobile: "0917",
        hire_date: "2026-01-01",
        tin: "1",
        sss_number: "2",
        philhealth_number: "3",
        pagibig_number: "4",
        client_id: "c1",
        position_id: "p1",
        daily_rate: 500,
      }),
      null
    );
  });

  it("after hire identity, continues the wizard instead of opening the 201", () => {
    assert.equal(
      pathAfterEmployeeHireIdentity("c1", "e1"),
      "/people/c/c1/e1/onboard?step=assignment"
    );
  });

  it("skips assignment when hub placement already saved branch and position", () => {
    assert.equal(
      pathAfterEmployeeHireIdentity("c1", "e1", { placementSaved: true }),
      "/people/c/c1/e1/onboard?step=government"
    );
  });

  it("stays on identity when hub hire left birth/sex/mobile blank", () => {
    assert.equal(
      pathAfterEmployeeHireIdentity("c1", "e1", {
        placementSaved: true,
        identity: {
          last_name: "Reyes",
          first_name: "Ana",
          birth_date: null,
          sex: null,
          mobile: null,
        },
      }),
      "/people/c/c1/e1/onboard?step=identity"
    );
  });

  it("advances to government when identity and placement are both filled", () => {
    assert.equal(
      pathAfterEmployeeHireIdentity("c1", "e1", {
        placementSaved: true,
        identity: {
          last_name: "Reyes",
          first_name: "Ana",
          birth_date: "1990-01-01",
          sex: "F",
          mobile: "0917",
        },
      }),
      "/people/c/c1/e1/onboard?step=government"
    );
  });
});

describe("clientWizardSteps", () => {
  it("skips billing for Organic house", () => {
    const steps = clientWizardSteps(
      !isOrganicOrganizationName("Organic")
    );
    assert.deepEqual(
      steps.map((step) => step.id),
      ["identity", "contact", "calendar", "statutory"]
    );
  });

  it("keeps billing for Deployed", () => {
    const steps = clientWizardSteps(
      !isOrganicOrganizationName("Deployed")
    );
    assert.equal(steps.at(-1)?.id, "billing");
  });
});
