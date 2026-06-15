"use client";

import type {
  CategoryBridgeItem,
  PeriodBridgeAnalysis,
} from "@/lib/payroll-summary/category-breakdown";
import { formatCurrency } from "@/utils/format";
import { BodySmall, Caption } from "@/components/ui/typography";

interface PayrollAuditBridgeChartProps {
  analysis: PeriodBridgeAnalysis;
  width?: number;
  height?: number;
}

const POSITIVE = "hsl(142 71% 45%)";
const NEGATIVE = "hsl(0 72% 51%)";
const NEUTRAL = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

function formatAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `₱${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `₱${(value / 1_000).toFixed(0)}k`;
  return formatCurrency(value);
}

function formatDeltaLabel(value: number, wide: boolean): string {
  const prefix = value >= 0 ? "+" : "";
  if (wide) return `${prefix}${formatCurrency(value)}`;
  const abs = Math.abs(value);
  if (abs >= 1_000) return `${prefix}₱${(value / 1_000).toFixed(1)}k`;
  return `${prefix}${formatCurrency(value)}`;
}

function splitLabel(label: string): [string, string?] {
  const words = label.split(/\s+/);
  if (words.length <= 2) return [label];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

export function PayrollAuditBridgeChart({
  analysis,
  width = 720,
  height = 360,
}: PayrollAuditBridgeChartProps) {
  const impactDrivers = analysis.topDrivers.filter((d) => d.impact !== 0);
  const useDeltaFallback = impactDrivers.length === 0;
  const drivers = useDeltaFallback
    ? [...analysis.items]
        .filter((d) => d.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 6)
        .map((d) => ({ ...d, impact: d.delta }))
    : impactDrivers.slice(0, 6);

  if (drivers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No measurable changes between these periods.
      </p>
    );
  }

  const padding = { top: 48, right: 24, bottom: 88, left: 64 };
  const barW = 64;
  const gap = 10;

  type Step =
    | { type: "start"; label: string; value: number }
    | { type: "delta"; item: CategoryBridgeItem }
    | { type: "end"; label: string; value: number };

  const steps: Step[] = [
    {
      type: "start",
      label: analysis.previousLabel,
      value: analysis.previousTotal,
    },
    ...drivers.map((item) => ({ type: "delta" as const, item })),
    { type: "end", label: analysis.currentLabel, value: analysis.currentTotal },
  ];

  const barCount = steps.length;
  const chartW = barCount * barW + (barCount - 1) * gap;
  const svgWidth = Math.max(width, chartW + padding.left + padding.right);
  const chartH = height - padding.top - padding.bottom;

  const running: number[] = [analysis.previousTotal];
  for (const d of drivers) {
    running.push(running[running.length - 1] + d.impact);
  }
  running.push(analysis.currentTotal);

  const allY = [
    analysis.previousTotal,
    analysis.currentTotal,
    ...running,
    ...drivers.map((d) => running[0] + d.impact),
  ];
  const minY = Math.min(0, ...allY);
  const maxY = Math.max(...allY);
  const range = maxY - minY || 1;

  const yScale = (v: number) =>
    padding.top + chartH - ((v - minY) / range) * chartH;

  let x = padding.left;

  return (
    <div className="space-y-3">
      <div>
        <BodySmall className="font-medium text-foreground">
          {useDeltaFallback
            ? "Largest category changes"
            : `${analysis.metricLabel} bridge`}
        </BodySmall>
        <Caption className="text-muted-foreground mt-1 block max-w-2xl">
          {useDeltaFallback
            ? "Raw category deltas — not every row directly moves net pay."
            : `Walks from ${analysis.previousLabel} to ${analysis.currentLabel}. Green bars increased ${analysis.metricLabel.toLowerCase()}; red bars decreased it (including higher deductions).`}
        </Caption>
        <Caption className="text-foreground mt-1.5 block tabular-nums">
          {formatCurrency(analysis.previousTotal)} →{" "}
          {formatCurrency(analysis.currentTotal)}
          <span
            className={
              analysis.totalDelta >= 0 ? "text-emerald-600" : "text-red-600"
            }
          >
            {" "}
            ({analysis.totalDelta >= 0 ? "+" : ""}
            {formatCurrency(analysis.totalDelta)}
            {analysis.totalDeltaPct != null &&
              ` · ${analysis.totalDeltaPct >= 0 ? "+" : ""}${analysis.totalDeltaPct.toFixed(1)}%`}
            )
          </span>
        </Caption>
      </div>

      <div className="w-full overflow-x-auto rounded-lg border bg-muted/10 p-2">
        <svg
          viewBox={`0 0 ${svgWidth} ${height}`}
          className="min-w-full"
          style={{ minWidth: svgWidth }}
          role="img"
          aria-label={`${analysis.metricLabel} bridge chart from ${analysis.previousLabel} to ${analysis.currentLabel}`}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((t) => {
            const val = minY + range * t;
            const y = yScale(val);
            return (
              <g key={t}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartW}
                  y2={y}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={padding.left - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-muted-foreground text-[10px]"
                >
                  {formatAxis(val)}
                </text>
              </g>
            );
          })}

          {steps.map((step, i) => {
            const cx = x + barW / 2;
            let y0: number;
            let y1: number;
            let fill: string;
            let title: string;
            let subtitle: string | undefined;

            if (step.type === "start" || step.type === "end") {
              y0 = yScale(0);
              y1 = yScale(step.value);
              fill = step.type === "start" ? MUTED : NEUTRAL;
              title = step.type === "start" ? "Start" : "End";
              subtitle = step.label.split(" – ")[0];
            } else {
              const base = running[i - 1];
              const top = base + step.item.impact;
              y0 = yScale(Math.min(base, top));
              y1 = yScale(Math.max(base, top));
              fill = step.item.impact >= 0 ? POSITIVE : NEGATIVE;
              title = step.item.label;
              subtitle = undefined;
            }

            const barH = Math.max(Math.abs(y1 - y0), 3);
            const rectY = Math.min(y0, y1);
            const [line1, line2] = splitLabel(title);

            const el = (
              <g key={i}>
                <rect
                  x={x}
                  y={rectY}
                  width={barW}
                  height={barH}
                  rx={4}
                  fill={fill}
                  opacity={step.type === "delta" ? 0.95 : 0.9}
                />
                {step.type === "delta" && (
                  <text
                    x={cx}
                    y={rectY - 6}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-semibold"
                  >
                    {formatDeltaLabel(step.item.impact, barW >= 56)}
                  </text>
                )}
                {(step.type === "start" || step.type === "end") && (
                  <text
                    x={cx}
                    y={rectY + barH / 2 + 4}
                    textAnchor="middle"
                    className="fill-background text-[9px] font-semibold"
                  >
                    {formatAxis(step.value)}
                  </text>
                )}
                <text
                  x={cx}
                  y={height - 58}
                  textAnchor="middle"
                  className="fill-foreground text-[10px] font-medium"
                >
                  {line1}
                </text>
                {line2 && (
                  <text
                    x={cx}
                    y={height - 44}
                    textAnchor="middle"
                    className="fill-foreground text-[10px] font-medium"
                  >
                    {line2}
                  </text>
                )}
                {subtitle && (
                  <text
                    x={cx}
                    y={height - (line2 ? 28 : 42)}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                  >
                    {subtitle}
                  </text>
                )}
              </g>
            );
            x += barW + gap;
            return el;
          })}

          <line
            x1={padding.left}
            y1={yScale(0)}
            x2={padding.left + chartW}
            y2={yScale(0)}
            stroke="currentColor"
            strokeOpacity={0.2}
          />
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 justify-center text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 h-3.5 rounded-sm"
            style={{ background: POSITIVE }}
          />
          Increased {analysis.metricLabel.toLowerCase()}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3.5 h-3.5 rounded-sm"
            style={{ background: NEGATIVE }}
          />
          Decreased {analysis.metricLabel.toLowerCase()}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3.5 h-3.5 rounded-sm bg-primary/70" />
          Start / end total
        </span>
      </div>
    </div>
  );
}
