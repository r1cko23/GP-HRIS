"use client";

import { useMemo, useState } from "react";
import {
  buildCompositionSeries,
  compositionLegend,
  type CompositionView,
  type PeriodComposition,
} from "@/lib/payroll-summary/composition-chart";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";
import { formatCurrency } from "@/utils/format";
import { Caption } from "@/components/ui/typography";
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

interface HoverState {
  periodIndex: number;
  sliceKey: string;
}

export function PayrollAuditCompositionChart({
  trend,
  width = 720,
  height = 300,
}: PayrollAuditCompositionChartProps) {
  const [view, setView] = useState<CompositionView>("gross");
  const [hover, setHover] = useState<HoverState | null>(null);

  const series = useMemo(
    () => buildCompositionSeries(trend, view),
    [trend, view]
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

  const hoveredSlice =
    hover != null
      ? series[hover.periodIndex]?.slices.find((s) => s.key === hover.sliceKey)
      : null;
  const hoveredPeriod = hover != null ? series[hover.periodIndex] : null;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <Caption className="text-muted-foreground">
          Each bar is one cutoff — colored slices are earnings or deduction categories.
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

            const sliceOrder = legend.map((l) => l.key);
            const orderedSlices = [...period.slices].sort((a, b) => {
              const ai = sliceOrder.indexOf(a.key);
              const bi = sliceOrder.indexOf(b.key);
              return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
            });

            return (
              <g key={`${period.periodStart}-${period.periodEnd}`}>
                {orderedSlices.map((slice) => {
                  const sliceH = (slice.value / maxTotal) * chartH;
                  const y = stackY - sliceH;
                  const isHovered =
                    hover?.periodIndex === pi && hover?.sliceKey === slice.key;

                  const rect = (
                    <rect
                      key={slice.key}
                      x={x}
                      y={y}
                      width={barW}
                      height={Math.max(sliceH, slice.value > 0 ? 1 : 0)}
                      fill={slice.color}
                      opacity={isHovered ? 1 : 0.88}
                      stroke={isHovered ? "hsl(var(--foreground))" : "none"}
                      strokeWidth={isHovered ? 1.5 : 0}
                      className="cursor-pointer transition-opacity"
                      onMouseEnter={() =>
                        setHover({ periodIndex: pi, sliceKey: slice.key })
                      }
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                  stackY = y;
                  return rect;
                })}

                <text
                  x={x + barW / 2}
                  y={height - 28}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[8px]"
                >
                  {period.periodLabel.split(" – ")[0]}
                </text>
                <text
                  x={x + barW / 2}
                  y={height - 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[8px]"
                >
                  {period.periodLabel.split(" – ")[1] ?? ""}
                </text>
                <text
                  x={x + barW / 2}
                  y={padding.top - 8}
                  textAnchor="middle"
                  className="fill-foreground text-[9px] font-medium"
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

      {hoveredSlice && hoveredPeriod && (
        <div className="rounded-lg border bg-background px-3 py-2 text-sm mb-3">
          <span className="font-medium">{hoveredSlice.label}</span>
          <span className="text-muted-foreground"> · {hoveredPeriod.periodLabel}</span>
          <div className="mt-0.5">
            {formatCurrency(hoveredSlice.value)}
            {hoveredPeriod.total > 0 && (
              <span className="text-muted-foreground ml-2">
                ({((hoveredSlice.value / hoveredPeriod.total) * 100).toFixed(1)}% of bar)
              </span>
            )}
          </div>
        </div>
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
