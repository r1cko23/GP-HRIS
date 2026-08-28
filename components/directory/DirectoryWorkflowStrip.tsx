"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type WorkflowStep = {
  label: string;
  href?: string;
  onClick?: () => void;
  current?: boolean;
  done?: boolean;
};

type Props = {
  steps: WorkflowStep[];
  /** e.g. "Client management" or "Employee management" */
  heading?: string;
  className?: string;
};

/** Compact numbered trail for Directory workflows. */
export function DirectoryWorkflowStrip({ steps, heading, className }: Props) {
  if (!steps.length) return null;
  return (
    <nav
      aria-label={heading ? `${heading} workflow` : "Workflow"}
      className={cn(
        "rounded-md border border-border bg-card px-3 py-2 shadow-card",
        className
      )}
    >
      {heading ? (
        <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {heading}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const body = (
          <>
            <span
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-[11px] font-semibold tabular-nums",
                step.current
                  ? "bg-primary text-primary-foreground"
                  : step.done
                    ? "bg-muted text-muted-foreground"
                    : "border border-border bg-background text-muted-foreground"
              )}
            >
              {index + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                step.current
                  ? "font-medium text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </>
        );

        return (
          <span key={`${step.label}-${index}`} className="inline-flex items-center gap-1.5">
            {index > 0 ? (
              <span className="text-muted-foreground/50" aria-hidden>
                →
              </span>
            ) : null}
            {step.href && !step.current ? (
              <Link
                href={step.href}
                className="inline-flex items-center gap-1.5 rounded-md hover:text-primary"
              >
                {body}
              </Link>
            ) : step.onClick && !step.current ? (
              <button
                type="button"
                onClick={step.onClick}
                className="inline-flex items-center gap-1.5 rounded-md hover:text-primary"
              >
                {body}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">{body}</span>
            )}
          </span>
        );
      })}
      </div>
    </nav>
  );
}
