import type { OnboardingReadiness } from "@/lib/directory/onboarding-readiness";

export type OnboardingPacketTemplateOption = {
  id: string;
  name: string;
  version: number;
};

export type OnboardingReadinessPanelLoadResult = {
  readiness: OnboardingReadiness | null;
  templates: OnboardingPacketTemplateOption[];
  /** Hard error that blanks the readiness card. Templates-only failures stay soft. */
  error: string | null;
  templatesError: string | null;
};

/**
 * Combines readiness + packet-template fetch outcomes for the Onboard panel.
 * A templates failure must not hide readiness — packet templates are optional UI
 * for assign, while readiness drives the blocker summary.
 */
export function resolveOnboardingReadinessPanelLoad(input: {
  readiness: OnboardingReadiness | null;
  readinessError: string | null;
  templates: OnboardingPacketTemplateOption[];
  templatesError: string | null;
}): OnboardingReadinessPanelLoadResult {
  if (input.readinessError || !input.readiness) {
    return {
      readiness: null,
      templates: [],
      error:
        input.readinessError ?? "Readiness could not be loaded",
      templatesError: input.templatesError,
    };
  }
  return {
    readiness: input.readiness,
    templates: input.templatesError ? [] : input.templates,
    error: null,
    templatesError: input.templatesError,
  };
}
