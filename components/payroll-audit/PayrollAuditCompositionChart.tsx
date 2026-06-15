"use client";

import { useMemo, useState } from "react";
import {
  buildCompositionSeries,
  compositionLegend,
  type CompositionView,
  type PeriodComposition,
} from "@/lib/payroll-summary/composition-chart";
import type {
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
} from "@/lib/payroll-summary/types";
import { formatCurrency } from "@/utils/format";
import { BodySmall, Caption } from "@/components/ui/typography";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PayrollAuditCompositionChartProps {
  trend: PayrollSummaryUploadRecord[];
  width?: number;
  height?: number;
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

function formatHours(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

interface HoverState {
  periodIndex: number;
  sliceKey?: string;
}

interface PeriodHourBreakdown {
  regular: number;
  regOT: number;
  holiday: number;
  totalOT: number;
}

function periodHourBreakdown(metrics: PayrollSummaryMetrics): PeriodHourBreakdown {
  const employees = metrics.employees ?? [];
  if (employees.length === 0) {
    return {
      regular: metrics.hoursWorkedTotal,
      regOT: metrics.regOTHoursTotal,
      holiday: 0,
      totalOT: metrics.regOTHoursTotal,
    };
  }

  let holiday = 0;
  let totalOT = 0;
  let regOT = 0;

  for (const emp of employees) {
    regOT += emp.regOTHours ?? 0;
    holiday +=
      (emp.specialHolidayHours ?? 0) +
      (emp.specialHolidayOTHours ?? 0) +
      (emp.restdayHours ?? 0);
    totalOT +=
      (emp.regOTHours ?? 0) +
      (emp.nightDiffHours ?? 0) +
      (emp.regNightdiffOTHours ?? 0) +
      (emp.specialHolidayOTHours ?? 0) +
      (emp.restdayHours ?? 0);
  }

  return {
    regular: metrics.hoursWorkedTotal,
    regOT: Math.round(regOT * 100) / 100,
    holiday: Math.round(holiday * 100) / 100,
    totalOT: Math.round(totalOT * 100) / 100,
  };
}

function PeriodBreakdownPanel({
  period,
  view,
  metrics,
  activeSliceKey,
}: {
  period: PeriodComposition;
  view: CompositionView;
  metrics: PayrollSummaryMetrics | null;
  activeSliceKey?: string;
}) {
  const slices = [...period.slices]
    .filter((s) => s.value > 0.01)
    .sort((a, b) => b.value - a.value);

  const hours = metrics && view === "gross" ? periodHourBreakdown(metrics) : null;

  return (
    <div className="rounded-lg border bg-background p-4 text-sm mb-3 space-y-4 shadow-sm">
      <div>
        <BodySmall className="font-semibold text-foreground">
          {period.periodLabel}
        </BodySmall>
        <Caption className="text-muted-foreground mt-0.5 block">
          Total {view === "gross" ? "gross pay" : "deductions"}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(period.total)}
          </span>
        </Caption>
      </div>

      <div>
        <Caption className="text-muted-foreground mb-2 block uppercase tracking-wide text-[10px]">
          {view === "gross" ? "Earnings breakdown" : "Deduction breakdown"}
        </Caption>
        <ul className="space-y-1.5">
          {slices.map((slice) => {
            const isActive = activeSliceKey === slice.key;
            const pct =
              period.total > 0
                ? ((slice.value / period.total) * 100).toFixed(1)
                : "0.0";
            return (
              <li
                key={slice.key}
                className={`flex items-center justify-between gap-3 rounded-md px-2 py-1 -mx-2 ${
                  isActive ? "bg-muted/60" : ""
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: slice.color }}
                  />
                  <span className="truncate text-sm">{slice.label}</span>
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="font-medium">{formatCurrency(slice.value)}</span>
                  <span className="text-muted-foreground text-xs ml-1.5">
                    {pct}%
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {hours && (
        <div>
          <Caption className="text-muted-foreground mb-2 block uppercase tracking-wide text-[10px]">
            Hours (not currency)
          </Caption>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Regular hours</span>
              <span className="tabular-nums font-medium">
                {formatHours(hours.regular)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Reg OT hours</span>
              <span className="tabular-nums font-medium">
                {formatHours(hours.regOT)}
              </span>
            </li>
            {hours.holiday > 0 && (
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Holiday hours</span>
                <span className="tabular-nums font-medium">
                  {formatHours(hours.holiday)}
                </span>
              </li>
            )}
            <li className="flex justify-between gap-3 border-t pt-1 mt-1">
              <span className="text-muted-foreground">Total OT hours</span>
              <span className="tabular-nums font-semibold">
                {formatHours(hours.totalOT)}
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}

export function PayrollAuditCompositionChart({
  trend,
  width = 720,
  height = 300,
}: PayrollAuditCompositionChartProps) {
  const [view, setView] = useState<CompositionView>("gross");
  const [hover, setHover] = useState<HoverState | null>(null);

  const sortedUploads = useMemo(
    () =>
      [...trend]
        .filter((u) => u.periodStart)
        .sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
    [trend]
  );

  const series = useMemo(
    () => buildCompositionSeries(sortedUploads, view),
    [sortedUploads, view]
  );
  const legend = useMemo(() => compositionLegend(series), [series]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Upload payroll registers to see composition by cutoff.
      </p>
    );
  }

  const padding = { top: 44, right: 16, bottom: 56, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const maxTotal = Math.max(...series.map((p) => p.total), 1);
  const barCount = series.length;
  const gap = barCount > 4 ? 12 : 20;
  const barW = Math.min(72, (chartW - gap * (barCount - 1)) / barCount);

  const yScale = (v: number) =>
    padding.top + chartH - (v / maxTotal) * chartH;

  const hoveredPeriod = hover != null ? series[hover.periodIndex] : null;
  const hoveredMetrics =
    hover != null ? (sortedUploads[hover.periodIndex] ?? null) : null;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Caption className="text-muted-foreground">
          Hover a bar to see the full pay breakdown for that cutoff.
        </Caption>
        <Select value={view} onValueChange={(v) => setView(v as CompositionView)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gross">Gross earnings</SelectItem>
            <SelectItem value="deductions">Deductions</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full max-w-full"
          role="img"
          aria-label={`Stacked ${view} composition by cutoff period`}
        >
          <text
            x={padding.left}
            y={20}
            className="fill-foreground text-[12px] font-semibold"
          >
            {view === "gross" ? "Gross pay composition" : "Deduction composition"}
          </text>
          <text
            x={padding.left}
            y={34}
            className="fill-muted-foreground text-[10px]"
          >
            Compare how payroll is sliced across cutoffs
          </text>

          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = maxTotal * t;
            const y = yScale(val);
            return (
              <g key={t}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.06}
                />
                <text
                  x={padding.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-muted-foreground text-[9px]"
                >
                  {formatCompact(val)}
                </text>
              </g>
            );
          })}

          {series.map((period, pi) => {
            const x =
              padding.left +
              pi * (barW + gap) +
              (chartW - barCount * barW - gap * (barCount - 1)) / 2;
            let stackY = yScale(0);
            const isBarHovered = hover?.periodIndex === pi;

            const sliceOrder = legend.map((l) => l.key);
            const orderedSlices = [...period.slices].sort((a, b) => {
              const ai = sliceOrder.indexOf(a.key);
              const bi = sliceOrder.indexOf(b.key);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });

            return (
              <g
                key={`${period.periodStart}-${period.periodEnd}`}
                onMouseEnter={() => setHover({ periodIndex: pi })}
                onMouseLeave={() => setHover(null)}
              >
                {orderedSlices.map((slice) => {
                  const sliceH = (slice.value / maxTotal) * chartH;
                  const y = stackY - sliceH;
                  const isSliceHovered =
                    isBarHovered && hover?.sliceKey === slice.key;

                  const rect = (
                    <rect
                      key={slice.key}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(sliceH, slice.value > 0 ? 1 : 0)}
                      fill={slice.color}
                      opacity={
                        isBarHovered
                          ? isSliceHovered || !hover?.sliceKey
                            ? 1
                            : 0.55
                          : 0.88
                      }
                      stroke={
                        isSliceHovered ? "hsl(var(--foreground))" : "none"
                      }
                      strokeWidth={isSliceHovered ? 1.5 : 0}
                      className="cursor-pointer"
                      onMouseEnter={() =>
                        setHover({ periodIndex: pi, sliceKey: slice.key })
                      }
                    />
                  );
                  stackY = y;
                  return rect;
                })}

                <text
                  x={x + barW / 2}
                  y={height - 28}
                  textAnchor="middle"
                  className={`text-[8px] pointer-events-none ${
                    isBarHovered
                      ? "fill-foreground font-medium"
                      : "fill-muted-foreground"
                  }`}
                >
                  {period.periodLabel.split(" – ")[0]}
                </text>
                <text
                  x={x + barW / 2}
                  y={height - 16}
                  textAnchor="middle"
                  className={`text-[8px] pointer-events-none ${
                    isBarHovered
                      ? "fill-foreground font-medium"
                      : "fill-muted-foreground"
                  }`}
                >
                  {period.periodLabel.split(" – ")[1] ?? ""}
                </text>
                <text
                  x={x + barW / 2}
                  y={padding.top - 8}
                  textAnchor="middle"
                  className={`text-[9px] pointer-events-none ${
                    isBarHovered
                      ? "fill-foreground font-semibold"
                      : "fill-foreground font-medium"
                  }`}
                >
                  {formatCompact(period.total)}
                </text>
              </g>
            );
          })}

          <line
            x1={padding.left}
            y1={yScale(0)}
            x2={padding.left + chartW}
            y2={yScale(0)}
            stroke="currentColor"
            strokeOpacity={0.15}
          />
        </svg>
      </div>

      {hoveredPeriod && (
        <PeriodBreakdownPanel
          period={hoveredPeriod}
          view={view}
          metrics={hoveredMetrics}
          activeSliceKey={hover?.sliceKey}
        />
      )}

      <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-1">
        {legend.map((item) => (
          <span
            key={item.key}
            className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
          >
            <span
              className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
