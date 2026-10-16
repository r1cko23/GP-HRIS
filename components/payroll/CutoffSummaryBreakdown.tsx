"use client";

import { Badge } from "@/components/ui/badge";
import { Caption } from "@/components/ui/typography";
import {
  orderedCutoffSummarySections,
  type CutoffSummaryBreakdown,
} from "@/lib/payroll-register/cutoff-summary-breakdown";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/utils/format";

type Props = {
  statusLabel: string;
  breakdown: CutoffSummaryBreakdown | null;
  /** Register search / deduction filter is narrowing the summary. */
  filtersActive?: boolean;
  matchCount?: number | null;
  className?: string;
};

function BreakdownSection({
  section,
}: {
  section: CutoffSummaryBreakdown["earnings"];
}) {
  return (
    <div className="min-w-0 border-border/70 px-3 py-2.5 sm:px-3.5 sm:py-3">
      <Caption className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {section.title}
      </Caption>
      <dl className="divide-y divide-border/60">
        {section.items.map((row) => (
          <div
            key={row.key}
            className="flex items-baseline justify-between gap-3 py-1 text-sm first:pt-0 last:pb-0"
          >
            <dt className="min-w-0 truncate text-muted-foreground">{row.label}</dt>
            <dd className="shrink-0 tabular-nums font-medium text-foreground">
              {formatCurrency(row.amount)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function CutoffSummaryBreakdownPanel({
  statusLabel,
  breakdown,
  filtersActive = false,
  matchCount = null,
  className,
}: Props) {
  const sections = breakdown
    ? orderedCutoffSummarySections(breakdown, {
        prioritizeAccruals: filtersActive,
      })
    : [];
  const scopeBadge =
    filtersActive && matchCount != null
      ? `${matchCount} match${matchCount === 1 ? "" : "es"}`
      : null;

  return (
    <section
      id="cutoff-summary"
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
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
          {scopeBadge ? (
            <Badge variant="secondary" className="tabular-nums">
              {scopeBadge}
            </Badge>
          ) : null}
          <Badge variant="outline" className="tabular-nums">
            {statusLabel}
          </Badge>
        </div>
      </div>
      {sections.length ? (
        <div className="grid divide-x divide-y divide-border/70 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {sections.map((section) => (
            <BreakdownSection key={section.title} section={section} />
          ))}
        </div>
      ) : (
        <div className="px-3 py-4 sm:px-4">
          <Caption className="text-muted-foreground">
            Register not built yet.
          </Caption>
        </div>
      )}
    </section>
  );
}
