"use client";

import { Check } from "phosphor-react";
import { cn } from "@/lib/utils";

export type StepperItem = {
  id: string;
  label: string;
  description?: string;
};

type Orientation = "horizontal" | "vertical";

type Props = {
  steps: StepperItem[];
  currentId: string;
  orientation?: Orientation;
  className?: string;
  onStepClick?: (id: string) => void;
  allowCompletedNavigation?: boolean;
  /** Labels only — no step subtexts */
  compact?: boolean;
};

export function Stepper({
  steps,
  currentId,
  orientation = "horizontal",
  className,
  onStepClick,
  allowCompletedNavigation = false,
  compact = true,
}: Props) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === currentId)
  );
  const vertical = orientation === "vertical";

  if (vertical) {
    return (
      <ol
        className={cn("flex flex-col", className)}
        aria-label="Progress"
      >
        {steps.map((step, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;
          const upcoming = index > currentIndex;
          const clickable =
            Boolean(onStepClick) &&
            (current || (allowCompletedNavigation && completed));

          return (
            <li key={step.id} className="relative flex gap-3 pb-6 last:pb-0">
              {index < steps.length - 1 ? (
                <span
                  aria-hidden
                  className={cn(
                    "absolute left-[13px] top-7 bottom-0 w-px",
                    completed ? "bg-primary" : "bg-border"
                  )}
                />
              ) : null}
              <StepMarker
                index={index}
                completed={completed}
                current={current}
                upcoming={upcoming}
                clickable={clickable}
                onClick={() => clickable && onStepClick?.(step.id)}
                label={step.label}
                description={
                  compact || !step.description?.trim()
                    ? undefined
                    : step.description
                }
                layout="vertical"
              />
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <ol
      className={cn("flex w-full items-start", className)}
      aria-label="Progress"
    >
      {steps.map((step, index) => {
        const completed = index < currentIndex;
        const current = index === currentIndex;
        const upcoming = index > currentIndex;
        const clickable =
          Boolean(onStepClick) &&
          (current || (allowCompletedNavigation && completed));
        const connectorDone = index < currentIndex;

        return (
          <li
            key={step.id}
            className={cn(
              "relative flex min-w-0 flex-1 flex-col items-center text-center",
              index === 0 && "items-start text-left",
              index === steps.length - 1 && "items-end text-right"
            )}
          >
            {index < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute left-[calc(50%+16px)] right-[calc(-50%+16px)] top-[13px] h-px",
                  index === 0 && "left-[28px]",
                  index === steps.length - 2 && "right-[28px]",
                  connectorDone ? "bg-primary" : "bg-border"
                )}
              />
            ) : null}
            <StepMarker
              index={index}
              completed={completed}
              current={current}
              upcoming={upcoming}
              clickable={clickable}
              onClick={() => clickable && onStepClick?.(step.id)}
              label={step.label}
              description={
                compact || !step.description?.trim()
                  ? undefined
                  : step.description
              }
              layout="horizontal"
              align={
                index === 0
                  ? "start"
                  : index === steps.length - 1
                    ? "end"
                    : "center"
              }
            />
          </li>
        );
      })}
    </ol>
  );
}

function StepMarker({
  index,
  completed,
  current,
  upcoming,
  clickable,
  onClick,
  label,
  description,
  layout,
  align = "center",
}: {
  index: number;
  completed: boolean;
  current: boolean;
  upcoming: boolean;
  clickable: boolean;
  onClick: () => void;
  label: string;
  description?: string;
  layout: "horizontal" | "vertical";
  align?: "start" | "center" | "end";
}) {
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={onClick}
      className={cn(
        "group relative z-[1] flex gap-2 text-left",
        layout === "horizontal" && "flex-col gap-1.5",
        layout === "horizontal" && align === "center" && "items-center",
        layout === "horizontal" && align === "start" && "items-start",
        layout === "horizontal" && align === "end" && "items-end",
        layout === "vertical" && "items-start",
        clickable ? "cursor-pointer" : "cursor-default disabled:opacity-100"
      )}
      aria-current={current ? "step" : undefined}
    >
      <span
        className={cn(
          "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors",
          completed && "bg-primary text-primary-foreground",
          current && "bg-primary text-primary-foreground",
          upcoming && "border border-border bg-card text-muted-foreground"
        )}
      >
        {completed ? <Check className="h-3.5 w-3.5" weight="bold" /> : index + 1}
      </span>
      <span
        className={cn(
          "min-w-0",
          layout === "horizontal" && align === "center" && "text-center",
          layout === "horizontal" && align === "end" && "text-right"
        )}
      >
        <span
          className={cn(
            "block text-sm font-medium leading-tight tracking-tight",
            current || completed ? "text-foreground" : "text-muted-foreground"
          )}
        >
          {label}
        </span>
        {description ? (
          <span className="mt-0.5 block max-w-[10rem] text-xs leading-snug text-muted-foreground sm:max-w-[12rem]">
            {description}
          </span>
        ) : null}
      </span>
    </button>
  );
}
