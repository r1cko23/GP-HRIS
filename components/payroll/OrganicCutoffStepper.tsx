"use client";

import { cn } from "@/lib/utils";
import { Caption } from "@/components/ui/typography";
import type { OrganicCutoffStep } from "@/lib/payroll-register/organic-cutoff-workflow";

const statusStyles: Record<
  OrganicCutoffStep["status"],
  { ring: string; dot: string; text: string }
> = {
  complete: {
    ring: "border-primary/30 bg-primary/5",
    dot: "bg-primary text-primary-foreground",
    text: "text-foreground",
  },
  current: {
    ring: "border-primary ring-2 ring-primary/20 bg-primary/10",
    dot: "bg-primary text-primary-foreground",
    text: "text-foreground",
  },
  attention: {
    ring: "border-amber-400/60 ring-2 ring-amber-400/25 bg-amber-50",
    dot: "bg-amber-500 text-white",
    text: "text-foreground",
  },
  upcoming: {
    ring: "border-border bg-muted/30",
    dot: "bg-muted text-muted-foreground",
    text: "text-muted-foreground",
  },
};

type Props = {
  steps: OrganicCutoffStep[];
  onStepSelect?: (sectionId: string) => void;
};

export function OrganicCutoffStepper({ steps, onStepSelect }: Props) {
  return (
    <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {steps.map((step) => {
        const styles = statusStyles[step.status];
        const interactive =
          !!onStepSelect &&
          (step.status === "complete" ||
            step.status === "current" ||
            step.status === "attention");

        return (
          <li key={step.id} className="min-w-0">
            <button
              type="button"
              disabled={!interactive}
              onClick={() => onStepSelect?.(step.sectionId)}
              className={cn(
                "flex h-full w-full flex-col rounded-md border p-3 text-left transition-colors",
                styles.ring,
                interactive
                  ? "cursor-pointer hover:bg-muted/30"
                  : "cursor-default opacity-90"
              )}
              aria-current={
                step.status === "current" || step.status === "attention"
                  ? "step"
                  : undefined
              }
            >
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                    styles.dot
                  )}
                >
                  {step.status === "complete" ? "✓" : step.number}
                </span>
                <span
                  className={cn(
                    "min-w-0 text-pretty text-sm font-semibold leading-snug",
                    styles.text
                  )}
                >
                  {step.title}
                </span>
              </div>
              <Caption className="text-muted-foreground">
                {step.description}
              </Caption>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
