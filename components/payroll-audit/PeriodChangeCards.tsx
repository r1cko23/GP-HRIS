"use client";

import { useMemo, useState } from "react";
import {
  buildCategoryChangeDrilldown,
  type CategoryChangeContributor,
} from "@/lib/payroll-summary/category-change-drilldown";
import type { PeriodChangeRow } from "@/lib/payroll-summary/category-breakdown";
import type { PayrollSummaryMetrics } from "@/lib/payroll-summary/types";
import { formatCurrency } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";

function formatDelta(value: number, kind: PeriodChangeRow["kind"]): string {
  const prefix = value > 0 ? "+" : "";
  if (kind === "count") return `${prefix}${value}`;
  if (kind === "hours") {
    return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${prefix}${formatCurrency(value)}`;
}

function formatValue(value: number, kind: PeriodChangeRow["kind"]): string {
  if (kind === "count") return String(value);
  if (kind === "hours") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return formatCurrency(value);
}

function kindBadge(kind: PeriodChangeRow["kind"]) {
  const labels: Record<PeriodChangeRow["kind"], string> = {
    count: "Headcount",
    hours: "Hours",
    earnings: "Earnings",
    deduction: "Deduction",
    accrual: "Accrual",
  };
  const variants: Record<
    PeriodChangeRow["kind"],
    "default" | "secondary" | "outline"
  > = {
    count: "secondary",
    hours: "secondary",
    earnings: "default",
    deduction: "outline",
    accrual: "outline",
  };
  return <Badge variant={variants[kind]}>{labels[kind]}</Badge>;
}

function contributorStatus(status: CategoryChangeContributor["status"]) {
  switch (status) {
    case "added":
      return "New";
    case "removed":
      return "Removed";
    default:
      return "Changed";
  }
}

function ContributorList({
  contributors,
  kind,
}: {
  contributors: CategoryChangeContributor[];
  kind: PeriodChangeRow["kind"];
}) {
  if (contributors.length === 0) {
    return (
      <Caption className="text-muted-foreground block py-2">
        No employee-level detail for this category.
      </Caption>
    );
  }

  return (
    <ul className="space-y-2 pt-1">
      {contributors.map((row) => (
        <li
          key={`${row.status}-${row.name}`}
          className="rounded-md border bg-background px-3 py-2.5 space-y-1"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <BodySmall className="font-medium truncate block">{row.name}</BodySmall>
              {row.reason && (
                <Caption className="text-muted-foreground block mt-0.5">
                  {row.reason}
                </Caption>
              )}
            </div>
            <span
              className={`text-sm font-semibold tabular-nums shrink-0 ${
                row.delta > 0 ? "text-amber-700" : row.delta < 0 ? "text-emerald-700" : ""
              }`}
            >
              {formatDelta(row.delta, kind)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-normal">
              {contributorStatus(row.status)}
            </Badge>
            <span className="tabular-nums">
              {formatValue(row.previous, kind)} → {formatValue(row.current, kind)}
            </span>
            {row.sharePct > 0 && (
              <span>· {row.sharePct.toFixed(0)}% of this change</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function PeriodChangeCard({
  row,
  previous,
  current,
  expanded,
  onToggle,
}: {
  row: PeriodChangeRow;
  previous: PayrollSummaryMetrics;
  current: PayrollSummaryMetrics;
  expanded: boolean;
  onToggle: () => void;
}) {
  const drilldown = useMemo(
    () => buildCategoryChangeDrilldown(previous, current, row),
    [previous, current, row]
  );

  const canExpand = (previous.employees?.length ?? 0) > 0;
  const deltaUp = row.delta > 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <button
          type="button"
          className="w-full text-left p-4 space-y-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset disabled:cursor-default"
          onClick={() => canExpand && onToggle()}
          disabled={!canExpand}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <BodySmall className="font-semibold text-foreground">
                  {row.label}
                </BodySmall>
                {kindBadge(row.kind)}
                {row.sharePct > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-normal">
                    {row.sharePct.toFixed(0)}% of movement
                  </Badge>
                )}
              </div>
              <Caption className="text-muted-foreground block tabular-nums">
                {formatValue(row.previous, row.kind)} →{" "}
                {formatValue(row.current, row.kind)}
              </Caption>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`text-lg font-semibold tabular-nums ${
                  deltaUp ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {formatDelta(row.delta, row.kind)}
              </span>
              {canExpand && (
                <Icon
                  name={expanded ? "CaretUp" : "CaretDown"}
                  size={IconSizes.sm}
                  className="text-muted-foreground"
                />
              )}
            </div>
          </div>
          {canExpand && !expanded && drilldown.contributors.length > 0 && (
            <Caption className="text-muted-foreground">
              Tap to see {drilldown.contributors.length} employee
              {drilldown.contributors.length !== 1 ? "s" : ""} who contributed
            </Caption>
          )}
        </button>

        {expanded && (
          <div className="border-t bg-muted/10 px-4 py-3">
            <Caption className="text-muted-foreground uppercase tracking-wide text-[10px] mb-2 block">
              Who contributed
            </Caption>
            <ContributorList
              contributors={drilldown.contributors}
              kind={row.kind}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function PeriodChangeCards({
  rows,
  previous,
  current,
}: {
  rows: PeriodChangeRow[];
  previous: PayrollSummaryMetrics | null;
  current: PayrollSummaryMetrics | null;
}) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <Caption className="text-muted-foreground block py-4 text-center">
        No changes between the selected cutoffs.
      </Caption>
    );
  }

  if (!previous || !current) return null;

  return (
    <div className="space-y-3">
      <Caption className="text-muted-foreground block">
        Expand any category to see which employees drove the change and why
        (hours vs pay).
      </Caption>
      {rows.map((row) => (
        <PeriodChangeCard
          key={row.key}
          row={row}
          previous={previous}
          current={current}
          expanded={expandedKey === row.key}
          onToggle={() =>
            setExpandedKey((k) => (k === row.key ? null : row.key))
          }
        />
      ))}
    </div>
  );
}
