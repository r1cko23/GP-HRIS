"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Stepper, type StepperItem } from "@/components/ui/stepper";
import { cn } from "@/lib/utils";

export type WizardStep = StepperItem;

type Props = {
  steps: WizardStep[];
  currentId: string;
  children: ReactNode;
  onBack?: () => void;
  onCancel?: () => void;
  onSkip?: () => void;
  onContinue: () => void;
  onFinishLater?: () => void;
  continueLabel?: string;
  cancelLabel?: string;
  saving?: boolean;
  error?: string | null;
  disableContinue?: boolean;
  className?: string;
  orientation?: "horizontal" | "vertical";
};

export function WizardChrome({
  steps,
  currentId,
  children,
  onBack,
  onCancel,
  onSkip,
  onContinue,
  onFinishLater,
  continueLabel = "Continue",
  cancelLabel = "Cancel",
  saving,
  error,
  disableContinue,
  className,
  orientation = "horizontal",
}: Props) {
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId)
  );
  const current = steps[index];
  const isLast = index === steps.length - 1;

  return (
    <div className={cn("space-y-5", className)}>
      <div className="border-b border-border/80 pb-4">
        <Stepper
          steps={steps}
          currentId={currentId}
          orientation={orientation}
          compact
        />
      </div>

      <div key={currentId} className="gp-wizard-step space-y-4">
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            Step {index + 1} of {steps.length}
          </p>
          <h2 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
            {current?.label}
          </h2>
        </div>
        {children}
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="sticky bottom-0 z-20 border-t border-border/80 bg-background/95 py-3 backdrop-blur-sm">
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
            {onCancel ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={saving}
              >
                {cancelLabel}
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
