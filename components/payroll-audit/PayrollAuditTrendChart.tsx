"use client";

import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary";

export type TrendMetricKey = "silCutoffTotal" | "netAmountTotal" | "grossAmountTotal";

const METRIC_LABELS: Record<TrendMetricKey, string> = {
  silCutoffTotal: "SIL Cutoff",
  netAmountTotal: "Net Pay",
  grossAmountTotal: "Gross Pay",
};

interface PayrollAuditTrendChartProps {
  data: PayrollSummaryUploadRecord[];
  metric: TrendMetricKey;
  width?: number;
  height?: number;
}

function formatPeriodLabel(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(s)} – ${fmt(e)}`;
}

export function PayrollAuditTrendChart({
  data,
  metric,
  width = 640,
  height = 220,
}: PayrollAuditTrendChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Upload payroll summaries to see period trends.
      </p>
    );
  }

  const padding = { top: 20, right: 16, bottom: 48, left: 56 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const values = data.map((d) => d[metric] as number);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const points = data.map((d, i) => {
    const x =
      padding.left +
      (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const val = d[metric] as number;
    const y = padding.top + chartH - ((val - minVal) / range) * chartH;
    return { x, y, val, record: d };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  const yTicks = 4;
  const yTickValues = Array.from({ length: yTicks + 1 }, (_, i) =>
    minVal + (range * i) / yTicks
  );

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        role="img"
        aria-label={`${METRIC_LABELS[metric]} trend chart`}
      >
        <text
          x={padding.left}
          y={14}
          className="fill-foreground text-[11px] font-medium"
        >
          {METRIC_LABELS[metric]} by cutoff period
        </text>

        {yTickValues.map((tick, i) => {
          const y = padding.top + chartH - ((tick - minVal) / range) * chartH;
          return (
            <g key={i}>
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
                className="fill-muted-foreground text-[9px]"
              >
                {tick >= 1000
                  ? `${(tick / 1000).toFixed(0)}k`
                  : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        <path
          d={linePath}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {points.map((p, i) => (
          <g key={i}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="hsl(var(--primary))"
              stroke="hsl(var(--background))"
              strokeWidth={2}
            />
            <text
              x={p.x}
              y={height - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {formatPeriodLabel(p.record.periodStart, p.record.periodEnd)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
