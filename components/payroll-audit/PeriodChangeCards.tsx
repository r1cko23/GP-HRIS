"use client";

import { useEffect, useMemo, useState } from "react";
import {
  buildCategoryChangeDrilldown,
  formatDriverValue,
  type CategoryChangeContributor,
} from "@/lib/payroll-summary/category-change-drilldown";
import type { PeriodChangeRow } from "@/lib/payroll-summary/category-breakdown";
import type { PayrollSummaryMetrics } from "@/lib/payroll-summary/types";
import { formatCurrency } from "@/utils/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

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

function DriverChips({
  contributors,
}: {
  contributors: CategoryChangeContributor[];
}) {
  const topDrivers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const row of contributors) {
      for (const driver of row.drivers) {
        const label = driver.label;
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([label]) => label);
  }, [contributors]);

  if (topDrivers.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {topDrivers.map((label) => (
        <Badge key={label} variant="outline" className="text-[10px] font-normal">
          {label}
        </Badge>
      ))}
    </div>
  );
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
    <ul className="space-y-3 pt-1">
      {contributors.map((row) => (
        <li
          key={`${row.status}-${row.name}`}
          className="rounded-lg border border-primary/15 bg-background px-3 py-3 space-y-2.5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <BodySmall className="font-semibold truncate block">{row.name}</BodySmall>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-normal">
                  {contributorStatus(row.status)}
                </Badge>
                {row.sharePct > 0 && (
                  <Caption className="text-muted-foreground">
                    {row.sharePct.toFixed(0)}% of this change
                  </Caption>
                )}
              </div>
            </div>
            <span
              className={cn(
                "text-base font-bold tabular-nums shrink-0",
                row.delta > 0
                  ? "text-amber-700"
                  : row.delta < 0
                    ? "text-emerald-700"
                    : ""
              )}
            >
              {formatDelta(row.delta, kind)}
            </span>
          </div>

          {row.drivers.length > 0 ? (
            <div className="rounded-md border border-dashed border-primary/20 bg-primary/[0.04] px-3 py-2.5 space-y-2">
              <Caption className="text-[10px] font-semibold uppercase tracking-wide text-primary/80 block">
                What changed for this employee
              </Caption>
              <div className="flex flex-wrap gap-1.5">
                {row.drivers.map((driver) => (
                  <Badge
                    key={`${row.name}-${driver.key}`}
                    variant="secondary"
                    className={cn(
                      "gap-1.5 px-2 py-1 text-[11px] tabular-nums",
                      driver.delta > 0
                        ? "bg-amber-100/80 text-amber-900 hover:bg-amber-100/80"
                        : driver.delta < 0
                          ? "bg-emerald-100/80 text-emerald-900 hover:bg-emerald-100/80"
                          : ""
                    )}
                  >
                    <span className="font-semibold uppercase tracking-wide">
                      {driver.label}
                    </span>
                    <span className="text-sm font-bold">
                      {formatDriverValue(driver)}
                    </span>
                  </Badge>
                ))}
              </div>
            </div>
          ) : row.reason ? (
            <Caption className="text-muted-foreground block">{row.reason}</Caption>
          ) : null}

          <Caption className="text-muted-foreground tabular-nums block">
            {formatValue(row.previous, kind)} → {formatValue(row.current, kind)}
          </Caption>
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
  highlight,
}: {
  row: PeriodChangeRow;
  previous: PayrollSummaryMetrics;
  current: PayrollSummaryMetrics;
  expanded: boolean;
  onToggle: () => void;
  highlight?: boolean;
}) {
  const drilldown = useMemo(
    () => buildCategoryChangeDrilldown(previous, current, row),
    [previous, current, row]
  );

  const canExpand = (previous.employees?.length ?? 0) > 0;
  const deltaUp = row.delta > 0;

  return (
    <Card
      className={cn(
        "overflow-hidden transition-shadow",
        expanded && "ring-2 ring-primary/30 shadow-md",
        highlight && !expanded && "border-primary/25"
      )}
    >
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
                className={cn(
                  "text-xl font-bold tabular-nums",
                  deltaUp ? "text-amber-700" : "text-emerald-700"
                )}
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
            <DriverChips contributors={drilldown.contributors} />
          )}
        </button>

        {expanded && (
          <div className="border-t border-primary/15 bg-gradient-to-b from-primary/[0.06] to-primary/[0.02] px-4 py-4">
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

  useEffect(() => {
    if (rows.length > 0 && expandedKey === null) {
      setExpandedKey(rows[0].key);
    }
  }, [rows, expandedKey]);

  if (rows.length === 0) {
    return (
      <Caption className="text-muted-foreground block py-4 text-center">
        No changes between the selected cutoffs.
      </Caption>
    );
  }

  if (!previous || !current) return null;

  return (
    <div className="space-y-3 w-full">
      {rows.map((row, index) => (
        <PeriodChangeCard
          key={row.key}
          row={row}
          previous={previous}
          current={current}
          expanded={expandedKey === row.key}
          highlight={index === 0}
          onToggle={() =>
            setExpandedKey((k) => (k === row.key ? null : row.key))
          }
        />
      ))}
    </div>
  );
}
