"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  label: string;
  description?: string;
};

type Props = {
  steps: WizardStep[];
  currentId: string;
  children: React.ReactNode;
  onBack?: () => void;
  onSkip?: () => void;
  onContinue: () => void;
  onFinishLater?: () => void;
  continueLabel?: string;
  saving?: boolean;
  error?: string | null;
  disableContinue?: boolean;
};

export function DirectoryWizardChrome({
  steps,
  currentId,
  children,
  onBack,
  onSkip,
  onContinue,
  onFinishLater,
  continueLabel = "Continue",
  saving,
  error,
  disableContinue,
}: Props) {
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId)
  );
  const current = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className="space-y-4">
      <ol
        className="flex w-fit max-w-full flex-wrap gap-0.5 rounded-md bg-muted p-1"
        aria-label="Onboarding steps"
      >
        {steps.map((step, i) => {
          const currentStep = i === index;
          return (
            <li key={step.id}>
              <span
                className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-[0.375rem] px-2.5 text-sm font-medium",
                  currentStep
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground"
                )}
                aria-current={currentStep ? "step" : undefined}
              >
                <span className="tabular-nums">{i + 1}</span>
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      <div
        key={currentId}
        className="gp-wizard-step rounded-md border border-border bg-card p-4 shadow-card sm:p-6"
      >
        {current?.description ? (
          <p className="mb-4 text-sm text-muted-foreground">
            {current.description}
          </p>
        ) : null}
        {children}
        {error ? (
          <p className="mt-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 -mx-1 border-t border-border bg-background/95 px-1 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onBack}
                disabled={saving}
              >
                Back
              </Button>
            ) : null}
            {onFinishLater ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onFinishLater}
                disabled={saving}
              >
                Finish later
              </Button>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {onSkip && !isLast ? (
              <Button
                type="button"
                variant="ghost"
                onClick={onSkip}
                disabled={saving}
              >
                Skip
              </Button>
            ) : null}
            <Button
              type="button"
              className="gp-pressable"
              onClick={onContinue}
              disabled={saving || disableContinue}
            >
              {saving ? "Saving…" : isLast ? "Complete" : continueLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
