"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: ReactNode;
  value: ReactNode;
  meta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

/**
 * Compact KPI tile. Label above value — no horizontal stretch gap in wide grid cells.
 */
export function MetricCard({
  label,
  value,
  meta,
  icon,
  className,
}: MetricCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start gap-2 rounded-md border border-border/70 bg-card px-3 py-2",
        className
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-xs font-medium leading-snug text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-semibold leading-none tracking-tight tabular-nums text-foreground">
          {value}
        </div>
        {meta ? (
          <p className="truncate text-[11px] leading-snug text-muted-foreground">
            {meta}
          </p>
        ) : null}
      </div>
      {icon ? (
        <span className="mt-0.5 shrink-0 text-muted-foreground/70 [&_svg]:h-3.5 [&_svg]:w-3.5">
          {icon}
        </span>
      ) : null}
    </div>
  );
}
