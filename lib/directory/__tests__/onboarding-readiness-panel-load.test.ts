import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveOnboardingReadinessPanelLoad } from "../onboarding-readiness-panel-load";
import type { OnboardingReadiness } from "../onboarding-readiness";

const ready: OnboardingReadiness = {
  ready: true,
  blocker_count: 0,
  required_task_count: 0,
  completed_required_task_count: 0,
  required_credential_count: 0,
  valid_required_credential_count: 0,
  tasks: [],
  credentials: [],
  next_action: null,
};

describe("resolveOnboardingReadinessPanelLoad", () => {
  it("does not blank readiness when packet_templates schema-cache fails", () => {
    const result = resolveOnboardingReadinessPanelLoad({
      readiness: ready,
      readinessError: null,
      templates: [],
      templatesError:
        "Could not find the table 'directory.packet_templates' in the schema cache",
    });

    assert.equal(result.error, null);
    assert.equal(result.readiness?.ready, true);
    assert.deepEqual(result.templates, []);
    assert.match(
      result.templatesError ?? "",
      /packet_templates.*schema cache/
    );
  });

  it("still surfaces a hard error when readiness itself fails", () => {
    const result = resolveOnboardingReadinessPanelLoad({
      readiness: null,
      readinessError: "Forbidden: People Directory access required",
      templates: [{ id: "t1", name: "Standard", version: 1 }],
      templatesError: null,
    });

    assert.equal(result.readiness, null);
    assert.equal(
      result.error,
      "Forbidden: People Directory access required"
    );
  });

  it("keeps templates when both fetches succeed", () => {
    const templates = [{ id: "t1", name: "Standard", version: 1 }];
    const result = resolveOnboardingReadinessPanelLoad({
      readiness: ready,
      readinessError: null,
      templates,
      templatesError: null,
    });

    assert.equal(result.error, null);
    assert.equal(result.templatesError, null);
    assert.deepEqual(result.templates, templates);
  });
});
