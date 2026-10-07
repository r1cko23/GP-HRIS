"use client";

import type { ReactNode } from "react";
import { H1, PageSubtitle } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { dbPageHeaderRow } from "@/lib/dashboard-ui";

export type DashboardPageHeaderProps = {
  title: string;
  description?: ReactNode;
  /** Row above the title (e.g. back link) */
  above?: ReactNode;
  actions?: ReactNode;
  className?: string;
  titleClassName?: string;
};

/**
 * Attendance-style page chrome: title left, controls right, hairline rule.
 * No instructional subtitle under the title unless explicitly passed.
 */
export function DashboardPageHeader({
  title,
  description,
  above,
  actions,
  className,
  titleClassName,
}: DashboardPageHeaderProps) {
  return (
    <header
      className={cn(
        dbPageHeaderRow,
        "border-b border-border/60 pb-3",
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        {above ? <div>{above}</div> : null}
        <H1
          className={cn(
            "text-balance text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl",
            titleClassName
          )}
        >
          {title}
        </H1>
        {description != null && description !== "" ? (
          typeof description === "string" ? (
            <PageSubtitle className="max-w-2xl text-pretty">
              {description}
            </PageSubtitle>
          ) : (
            <div className="max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground">
              {description}
            </div>
          )
        ) : null}
      </div>
      {actions ? (
        <div className="w-full shrink-0 sm:w-auto">{actions}</div>
      ) : null}
    </header>
  );
}
