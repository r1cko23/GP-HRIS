"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { dbKpiGrid, dbSectionGrid, dbTableShell } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

type ChartMode = "absolute" | "share";

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

function formatDeltaPct(current: number, previous: number): string | null {
  if (previous === 0) return current === 0 ? "0%" : null;
  const pct = ((current - previous) / previous) * 100;
  const prefix = pct > 0 ? "+" : "";
  return `${prefix}${pct.toFixed(1)}%`;
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

function KpiCard({
  label,
  value,
  meta,
  tone,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-3">
      <Caption className="text-muted-foreground uppercase tracking-wide text-[10px]">
        {label}
      </Caption>
      <BodySmall className="mt-1 text-lg font-semibold tabular-nums tracking-tight">
        {value}
      </BodySmall>
      {meta && (
        <Caption
          className={cn(
            "mt-0.5 block tabular-nums",
            tone === "up" && "text-emerald-700",
            tone === "down" && "text-rose-700",
            (!tone || tone === "neutral") && "text-muted-foreground"
          )}
        >
          {meta}
        </Caption>
      )}
    </div>
  );
}

function PeriodDetailPanel({
  period,
  view,
  metrics,
}: {
  period: PeriodComposition;
  view: CompositionView;
  metrics: PayrollSummaryMetrics | null;
}) {
  const slices = [...period.slices]
    .filter((s) => s.value > 0.01)
    .sort((a, b) => b.value - a.value);

  const hours = metrics && view === "gross" ? periodHourBreakdown(metrics) : null;
  const otherShare =
    period.total > 0
      ? ((slices.find((s) => s.key === "other")?.value ?? 0) / period.total) * 100
      : 0;

  return (
    <div className="rounded-lg border bg-background p-4 text-sm space-y-4 h-full">
      <div>
        <Caption className="uppercase tracking-wide text-[10px] text-muted-foreground">
          Selected cutoff
        </Caption>
        <BodySmall className="font-semibold text-foreground mt-0.5">
          {period.periodLabel}
        </BodySmall>
        <Caption className="text-muted-foreground mt-0.5 block">
          Total {view === "gross" ? "gross" : "deductions"}:{" "}
          <span className="font-medium text-foreground tabular-nums">
            {formatCurrency(period.total)}
          </span>
        </Caption>
      </div>

      {otherShare >= 15 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/70 px-2.5 py-2">
          <Caption className="text-amber-950">
            Other / unmapped is {otherShare.toFixed(0)}% of this cutoff — layout
            mapping may be incomplete for this register.
          </Caption>
        </div>
      )}

      <div>
        <Caption className="text-muted-foreground mb-2 block uppercase tracking-wide text-[10px]">
          {view === "gross" ? "Earnings mix" : "Deduction mix"}
        </Caption>
        <ul className="space-y-2">
          {slices.map((slice) => {
            const pct =
              period.total > 0
                ? ((slice.value / period.total) * 100).toFixed(1)
                : "0.0";
            return (
              <li key={slice.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ background: slice.color }}
                    />
                    <span className="truncate text-sm">{slice.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sm">
                    <span className="font-medium">{formatCurrency(slice.value)}</span>
                    <span className="text-muted-foreground text-xs ml-1.5">
                      {pct}%
                    </span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Number(pct))}%`,
                      background: slice.color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {hours && (
        <div>
          <Caption className="text-muted-foreground mb-2 block uppercase tracking-wide text-[10px]">
            Hours
          </Caption>
          <ul className="space-y-1 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Regular</span>
              <span className="tabular-nums font-medium">
                {formatHours(hours.regular)}
              </span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-muted-foreground">Reg OT</span>
              <span className="tabular-nums font-medium">
                {formatHours(hours.regOT)}
              </span>
            </li>
            {hours.holiday > 0 && (
              <li className="flex justify-between gap-3">
                <span className="text-muted-foreground">Holiday / restday</span>
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

function CompositionMatrix({
  series,
  legend,
  selectedIndex,
  onSelect,
  mode,
}: {
  series: PeriodComposition[];
  legend: ReturnType<typeof compositionLegend>;
  selectedIndex: number;
  onSelect: (index: number) => void;
  mode: ChartMode;
}) {
  const rows = legend.filter((item) =>
    series.some((p) => p.slices.some((s) => s.key === item.key && s.value > 0.01))
  );

  return (
    <div className={dbTableShell}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 bg-card min-w-[140px]">
              Category
            </TableHead>
            {series.map((period, i) => (
              <TableHead
                key={`${period.periodStart}-${period.periodEnd}`}
                className={cn(
                  "text-right whitespace-nowrap cursor-pointer tabular-nums",
                  i === selectedIndex && "bg-muted/70 text-foreground"
                )}
                onClick={() => onSelect(i)}
              >
                {period.periodLabel}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="sticky left-0 z-10 bg-card font-medium">
                <span className="inline-flex items-center gap-2">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: row.color }}
                  />
                  {row.label}
                </span>
              </TableCell>
              {series.map((period, i) => {
                const slice = period.slices.find((s) => s.key === row.key);
                const value = slice?.value ?? 0;
                const display =
                  mode === "share"
                    ? period.total > 0
                      ? `${((value / period.total) * 100).toFixed(1)}%`
                      : "—"
                    : value > 0.01
                      ? formatCurrency(value)
                      : "—";
                return (
                  <TableCell
                    key={`${period.periodStart}-${row.key}`}
                    className={cn(
                      "text-right tabular-nums cursor-pointer",
                      i === selectedIndex && "bg-muted/40"
                    )}
                    onClick={() => onSelect(i)}
                  >
                    {display}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell className="sticky left-0 z-10 bg-muted/40 font-semibold">
              Total
            </TableCell>
            {series.map((period, i) => (
              <TableCell
                key={`total-${period.periodStart}`}
                className={cn(
                  "text-right tabular-nums font-semibold cursor-pointer",
                  i === selectedIndex && "bg-muted/60"
                )}
                onClick={() => onSelect(i)}
              >
                {mode === "share" ? "100%" : formatCurrency(period.total)}
              </TableCell>
            ))}
          </TableRow>
        </TableFooter>
      </Table>
    </div>
  );
}

export function PayrollAuditCompositionChart({
  trend,
  width = 720,
  height = 280,
}: PayrollAuditCompositionChartProps) {
  const [view, setView] = useState<CompositionView>("gross");
  const [mode, setMode] = useState<ChartMode>("absolute");
  const [selectedIndex, setSelectedIndex] = useState(0);

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

  useEffect(() => {
    if (series.length === 0) return;
    setSelectedIndex(series.length - 1);
  }, [view, series.length]);

  if (series.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Upload payroll registers to see composition by cutoff.
      </p>
    );
  }

  const safeIndex = Math.min(selectedIndex, series.length - 1);
  const selected = series[safeIndex];
  const selectedMetrics = sortedUploads[safeIndex] ?? null;
  const previous = safeIndex > 0 ? series[safeIndex - 1] : null;

  const latest = series[series.length - 1];
  const prior = series.length > 1 ? series[series.length - 2] : null;
  const avg =
    series.reduce((sum, p) => sum + p.total, 0) / Math.max(series.length, 1);
  const deltaPct = prior ? formatDeltaPct(latest.total, prior.total) : null;
  const deltaTone: "up" | "down" | "neutral" =
    prior == null
      ? "neutral"
      : latest.total > prior.total
        ? "up"
        : latest.total < prior.total
          ? "down"
          : "neutral";

  const topSlice = [...latest.slices].sort((a, b) => b.value - a.value)[0];

  const padding = { top: 28, right: 12, bottom: 48, left: 52 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;
  const maxTotal =
    mode === "share" ? 1 : Math.max(...series.map((p) => p.total), 1);
  const barCount = series.length;
  const gap = barCount > 4 ? 14 : 22;
  const barW = Math.min(64, (chartW - gap * (barCount - 1)) / barCount);
  const yScale = (v: number) =>
    padding.top + chartH - (v / maxTotal) * chartH;

  return (
    <div className="w-full space-y-4">
      <div className={dbKpiGrid}>
        <KpiCard
          label={`Latest ${view === "gross" ? "gross" : "deductions"}`}
          value={formatCurrency(latest.total)}
          meta={latest.periodLabel}
        />
        <KpiCard
          label="vs prior cutoff"
          value={
            prior
              ? `${latest.total - prior.total >= 0 ? "+" : ""}${formatCurrency(
                  latest.total - prior.total
                )}`
              : "—"
          }
          meta={deltaPct ? `${deltaPct} vs ${prior?.periodLabel}` : "Need 2+ cutoffs"}
          tone={deltaTone}
        />
        <KpiCard
          label="Average / cutoff"
          value={formatCurrency(avg)}
          meta={`${series.length} cutoffs`}
        />
        <KpiCard
          label="Largest slice (latest)"
          value={topSlice ? topSlice.label : "—"}
          meta={
            topSlice
              ? `${formatCompact(topSlice.value)} · ${(
                  (topSlice.value / latest.total) *
                  100
                ).toFixed(0)}%`
              : undefined
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <BodySmall className="font-semibold">
            {view === "gross" ? "Gross pay" : "Deductions"} by cutoff
          </BodySmall>
          <Caption className="text-muted-foreground">
            Click a bar or matrix column to pin the cutoff detail.
          </Caption>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={view} onValueChange={(v) => setView(v as CompositionView)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="gross">Gross earnings</SelectItem>
              <SelectItem value="deductions">Deductions</SelectItem>
            </SelectContent>
          </Select>
          <Select value={mode} onValueChange={(v) => setMode(v as ChartMode)}>
            <SelectTrigger className="h-8 w-[150px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="absolute">₱ amounts</SelectItem>
              <SelectItem value="share">% of total</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className={dbSectionGrid}>
        <div className="min-w-0 overflow-x-auto rounded-lg border bg-card p-3">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full max-w-full"
            role="img"
            aria-label={`${view} composition by cutoff (${mode})`}
          >
            {(mode === "share"
              ? [0, 0.25, 0.5, 0.75, 1]
              : [0, 0.25, 0.5, 0.75, 1]
            ).map((t) => {
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
                    {mode === "share"
                      ? `${Math.round(t * 100)}%`
                      : formatCompact(val)}
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
              const isSelected = pi === safeIndex;
              const sliceOrder = legend.map((l) => l.key);
              const orderedSlices = [...period.slices].sort((a, b) => {
                const ai = sliceOrder.indexOf(a.key);
                const bi = sliceOrder.indexOf(b.key);
                return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
              });

              return (
                <g
                  key={`${period.periodStart}-${period.periodEnd}`}
                  className="cursor-pointer"
                  onClick={() => setSelectedIndex(pi)}
                >
                  {orderedSlices.map((slice) => {
                    const unit =
                      mode === "share"
                        ? period.total > 0
                          ? slice.value / period.total
                          : 0
                        : slice.value;
                    const sliceH = (unit / maxTotal) * chartH;
                    const y = stackY - sliceH;
                    const rect = (
                      <rect
                        key={slice.key}
                        x={x}
                        y={y}
                        width={barW}
                        height={Math.max(sliceH, unit > 0 ? 1 : 0)}
                        fill={slice.color}
                        opacity={isSelected ? 1 : 0.72}
                        stroke={isSelected ? "hsl(var(--foreground))" : "none"}
                        strokeWidth={isSelected ? 1.25 : 0}
                      />
                    );
                    stackY = y;
                    return rect;
                  })}

                  <text
                    x={x + barW / 2}
                    y={height - 28}
                    textAnchor="middle"
                    className={cn(
                      "text-[8px] pointer-events-none",
                      isSelected
                        ? "fill-foreground font-medium"
                        : "fill-muted-foreground"
                    )}
                  >
                    {period.periodLabel.split(" – ")[0]}
                  </text>
                  <text
                    x={x + barW / 2}
                    y={height - 16}
                    textAnchor="middle"
                    className={cn(
                      "text-[8px] pointer-events-none",
                      isSelected
                        ? "fill-foreground font-medium"
                        : "fill-muted-foreground"
                    )}
                  >
                    {period.periodLabel.split(" – ")[1] ?? ""}
                  </text>
                  {mode === "absolute" && (
                    <text
                      x={x + barW / 2}
                      y={padding.top - 6}
                      textAnchor="middle"
                      className={cn(
                        "text-[9px] pointer-events-none",
                        isSelected
                          ? "fill-foreground font-semibold"
                          : "fill-muted-foreground"
                      )}
                    >
                      {formatCompact(period.total)}
                    </text>
                  )}
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

          <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
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

        <PeriodDetailPanel
          period={selected}
          view={view}
          metrics={selectedMetrics}
        />
      </div>

      {previous && (
        <Caption className="text-muted-foreground">
          Selected vs prior:{" "}
          <span
            className={cn(
              "font-medium tabular-nums",
              selected.total >= previous.total
                ? "text-emerald-700"
                : "text-rose-700"
            )}
          >
            {selected.total - previous.total >= 0 ? "+" : ""}
            {formatCurrency(selected.total - previous.total)}
          </span>
          {formatDeltaPct(selected.total, previous.total)
            ? ` (${formatDeltaPct(selected.total, previous.total)})`
            : ""}
        </Caption>
      )}

      <div>
        <BodySmall className="font-semibold mb-2">Composition matrix</BodySmall>
        <Caption className="text-muted-foreground mb-2 block">
          Categories × cutoffs — same grain as a Power BI matrix visual.
        </Caption>
        <CompositionMatrix
          series={series}
          legend={legend}
          selectedIndex={safeIndex}
          onSelect={setSelectedIndex}
          mode={mode}
        />
      </div>
    </div>
  );
}
