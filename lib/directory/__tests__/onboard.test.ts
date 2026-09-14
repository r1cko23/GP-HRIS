import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { firstIncompleteOnboardStep } from "../onboard";
import {
  clientWizardSteps,
  isOrganicOrganizationName,
} from "../client-wizard";

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

  it("returns null when the 201 is complete enough to skip the wizard", () => {
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
        gcash: "0917",
      }),
      null
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
