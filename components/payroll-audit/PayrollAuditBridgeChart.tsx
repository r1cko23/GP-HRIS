"use client";

import type { CategoryBridgeItem, PeriodBridgeAnalysis } from "@/lib/payroll-summary/category-breakdown";
import { formatCurrency } from "@/utils/format";

interface PayrollAuditBridgeChartProps {
  analysis: PeriodBridgeAnalysis;
  width?: number;
  height?: number;
}

const POSITIVE = "hsl(142 71% 45%)";
const NEGATIVE = "hsl(0 72% 51%)";
const NEUTRAL = "hsl(var(--primary))";
const MUTED = "hsl(var(--muted-foreground))";

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

export function PayrollAuditBridgeChart({
  analysis,
  width = 720,
  height = 320,
}: PayrollAuditBridgeChartProps) {
  const impactDrivers = analysis.topDrivers.filter((d) => d.impact !== 0);
  const useDeltaFallback = impactDrivers.length === 0;
  const drivers = useDeltaFallback
    ? [...analysis.items]
        .filter((d) => d.delta !== 0)
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 8)
        .map((d) => ({ ...d, impact: d.delta }))
    : impactDrivers;

  if (drivers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        No measurable changes between these periods.
      </p>
    );
  }

  const padding = { top: 36, right: 20, bottom: 72, left: 52 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  type Step =
    | { type: "start"; label: string; value: number }
    | { type: "delta"; item: CategoryBridgeItem }
    | { type: "end"; label: string; value: number };

  const steps: Step[] = [
    { type: "start", label: analysis.previousLabel, value: analysis.previousTotal },
    ...drivers.map((item) => ({ type: "delta" as const, item })),
    { type: "end", label: analysis.currentLabel, value: analysis.currentTotal },
  ];

  const barCount = steps.length;
  const gap = 8;
  const barW = Math.min(56, (chartW - gap * (barCount - 1)) / barCount);

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
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        role="img"
        aria-label={`${analysis.metricLabel} bridge chart`}
      >
        <text
          x={padding.left}
          y={18}
          className="fill-foreground text-[12px] font-semibold"
        >
          {useDeltaFallback
            ? "Largest category changes"
            : `${analysis.metricLabel} bridge — what drove the change`}
        </text>
        <text
          x={padding.left}
          y={32}
          className="fill-muted-foreground text-[10px]"
        >
          {useDeltaFallback
            ? "Includes accruals and volume — not all rows affect net pay"
            : `${formatCurrency(analysis.previousTotal)} → ${formatCurrency(analysis.currentTotal)} (${analysis.totalDelta >= 0 ? "+" : ""}${formatCurrency(analysis.totalDelta)})`}
        </text>

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

        {steps.map((step, i) => {
          const cx = x + barW / 2;
          let y0: number;
          let y1: number;
          let fill: string;
          let label: string;

          if (step.type === "start" || step.type === "end") {
            y0 = yScale(0);
            y1 = yScale(step.value);
            fill = step.type === "start" ? MUTED : NEUTRAL;
            label = step.type === "start" ? "Start" : "End";
          } else {
            const base = running[i - 1];
            const top = base + step.item.impact;
            y0 = yScale(Math.min(base, top));
            y1 = yScale(Math.max(base, top));
            fill = step.item.impact >= 0 ? POSITIVE : NEGATIVE;
            label = step.item.label;
          }

          const barH = Math.max(Math.abs(y1 - y0), 2);
          const rectY = Math.min(y0, y1);
          const el = (
            <g key={i}>
              <rect
                x={x}
                y={rectY}
                width={barW}
                height={barH}
                rx={3}
                fill={fill}
                opacity={step.type === "delta" ? 0.92 : 0.85}
              />
              {step.type === "delta" && (
                <text
                  x={cx}
                  y={rectY - 4}
                  textAnchor="middle"
                  className="fill-foreground text-[8px] font-medium"
                >
                  {step.item.impact >= 0 ? "+" : ""}
                  {formatCompact(step.item.impact)}
                </text>
              )}
              <text
                x={cx}
                y={height - 52}
                textAnchor="middle"
                className="fill-muted-foreground text-[7px]"
              >
                {label.length > 14 ? `${label.slice(0, 12)}…` : label}
              </text>
              {(step.type === "start" || step.type === "end") && (
                <text
                  x={cx}
                  y={height - 38}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[7px]"
                >
                  {step.type === "start"
                    ? analysis.previousLabel.split(" – ")[0]
                    : analysis.currentLabel.split(" – ")[0]}
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
          strokeOpacity={0.15}
        />
      </svg>

      <div className="flex flex-wrap gap-4 justify-center mt-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: POSITIVE }} />
          Increase
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm" style={{ background: NEGATIVE }} />
          Decrease
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-primary/70" />
          Start / End
        </span>
      </div>
    </div>
  );
}
