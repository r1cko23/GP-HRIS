"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Caption } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/utils/format";

export type CutoffSummaryStripProps = {
  statusLabel: string;
  hoursRows: number;
  punchRows: number;
  headcount?: number | null;
  gross?: number | null;
  statutory?: number | null;
  loans?: number | null;
  net?: number | null;
  hasRegister: boolean;
  className?: string;
};

function StatCell({
  label,
  children,
  emphasize,
  className,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 border-border/70 px-3 py-2 sm:px-3.5 sm:py-2.5",
        className
      )}
    >
      <Caption className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </Caption>
      <div
        className={cn(
          "mt-0.5 truncate tabular-nums leading-tight text-foreground",
          emphasize
            ? "text-base font-semibold sm:text-lg"
            : "text-sm font-medium sm:text-[0.95rem]"
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Full-width cutoff money/headcount strip — avoids left-clumped Summary gaps.
 */
export function CutoffSummaryStrip({
  statusLabel,
  hoursRows,
  punchRows,
  headcount,
  gross,
  statutory,
  loans,
  net,
  hasRegister,
  className,
}: CutoffSummaryStripProps) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-md border border-border bg-card shadow-card",
        className
      )}
      aria-label="Cutoff summary"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 py-2.5 sm:px-4">
        <h2 className="text-sm font-semibold tracking-tight text-foreground">
          Summary
        </h2>
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {statusLabel}
        </Badge>
      </div>
      <div
        className={cn(
          "grid divide-y divide-border/70 sm:divide-y-0",
          hasRegister
            ? "sm:grid-cols-4 lg:grid-cols-7 sm:divide-x"
            : "sm:grid-cols-3 sm:divide-x"
        )}
      >
        <StatCell label="Hours rows">{formatNumber(hoursRows, 0)}</StatCell>
        <StatCell label="Punches">{formatNumber(punchRows, 0)}</StatCell>
        {hasRegister ? (
          <>
            <StatCell label="Headcount">
              {formatNumber(headcount ?? 0, 0)}
            </StatCell>
            <StatCell label="Gross" emphasize>
              {formatCurrency(Number(gross ?? 0))}
            </StatCell>
            <StatCell label="Statutory">
              {formatCurrency(Number(statutory ?? 0))}
            </StatCell>
            <StatCell label="Loans">
              {formatCurrency(Number(loans ?? 0))}
            </StatCell>
            <StatCell
              label="Net"
              emphasize
              className="bg-primary/[0.04] sm:col-span-1"
            >
              {formatCurrency(Number(net ?? 0))}
            </StatCell>
          </>
        ) : (
          <StatCell label="Register">
            <span className="text-sm font-medium text-muted-foreground">
              Not built yet
            </span>
          </StatCell>
        )}
      </div>
    </section>
  );
}
