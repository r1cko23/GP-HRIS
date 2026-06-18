"use client";

import { useMemo, useState } from "react";
import {
  buildPeriodBridge,
  buildPeriodChanges,
  buildVolumeContext,
  metricsFromUploadRecord,
  topMoverFromChanges,
  type BridgeMetric,
  type PeriodChangeRow,
} from "@/lib/payroll-summary/category-breakdown";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";
import { PeriodChangeCards } from "@/components/payroll-audit/PeriodChangeCards";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { dbKpiGrid } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

interface PayrollAuditPeriodComparisonProps {
  trend: PayrollSummaryUploadRecord[];
  loading?: boolean;
}

function periodKey(upload: PayrollSummaryUploadRecord): string {
  return `${upload.periodStart}|${upload.periodEnd}|${upload.id}`;
}

function periodOptionLabel(upload: PayrollSummaryUploadRecord): string {
  if (!upload.periodStart) return "Unknown period";
  return formatBiMonthlyPeriod(
    new Date(upload.periodStart + "T00:00:00"),
    new Date(upload.periodEnd + "T00:00:00")
  );
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function formatDelta(
  value: number,
  kind: PeriodChangeRow["kind"] | "currency" | "count" | "hours"
): string {
  const prefix = value > 0 ? "+" : "";
  const isCurrency =
    kind === "currency" ||
    kind === "earnings" ||
    kind === "deduction" ||
    kind === "accrual";
  if (isCurrency) return `${prefix}${formatCurrency(value)}`;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function SummaryCard({
  label,
  value,
  meta,
  tone,
  highlight,
}: {
  label: string;
  value: string;
  meta?: string;
  tone?: "up" | "down" | "neutral";
  highlight?: boolean;
}) {
  return (
    <Card className="stats-card-surface min-w-0">
      <CardContent className="p-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={cn(
            "mt-1 truncate text-xl font-bold tabular-nums",
            tone === "up" && "text-emerald-600",
            tone === "down" && "text-red-600",
            highlight && !tone && "text-primary"
          )}
        >
          {value}
        </p>
        {meta && (
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{meta}</p>
        )}
      </CardContent>
    </Card>
  );
}

function KpiSnapshot({
  latest,
  previous,
}: {
  latest: PayrollSummaryUploadRecord;
  previous: PayrollSummaryUploadRecord | null;
}) {
  const periodLabel = periodOptionLabel(latest);
  const otAmount = latest.totalOTAmount ?? 0;
  const prevOt = previous?.totalOTAmount ?? 0;

  const items = [
    {
      label: "Net pay",
      value: formatCurrency(latest.netAmountTotal),
      delta: previous
        ? pctChange(latest.netAmountTotal, previous.netAmountTotal)
        : null,
    },
    {
      label: "Gross pay",
      value: formatCurrency(latest.grossAmountTotal),
      delta: previous
        ? pctChange(latest.grossAmountTotal, previous.grossAmountTotal)
        : null,
    },
    {
      label: "Headcount",
      value: String(latest.employeeCount),
      meta: `${latest.hoursWorkedTotal.toFixed(0)} hrs`,
      delta: previous
        ? pctChange(latest.employeeCount, previous.employeeCount)
        : null,
    },
    {
      label: "Total OT",
      value: formatCurrency(otAmount),
      meta: `${latest.regOTHoursTotal.toFixed(1)} OT hrs`,
      delta: previous ? pctChange(otAmount, prevOt) : null,
    },
  ];

  return (
    <div className={dbKpiGrid}>
      {items.map((item) => (
        <Card key={item.label} className="stats-card-surface min-w-0">
          <CardContent className="p-3 sm:p-4">
            <p className="text-xs font-medium text-muted-foreground">
              {item.label}
              <span className="font-normal text-muted-foreground/80">
                {" "}
                · {periodLabel}
              </span>
            </p>
            <p className="mt-1 text-lg font-bold tabular-nums text-foreground sm:text-xl">
              {item.value}
            </p>
            {item.meta && (
              <p className="text-xs text-muted-foreground">{item.meta}</p>
            )}
            {item.delta != null && (
              <p
                className={cn(
                  "mt-0.5 text-xs font-semibold tabular-nums",
                  item.delta > 0
                    ? "text-emerald-600"
                    : item.delta < 0
                      ? "text-red-600"
                      : "text-muted-foreground"
                )}
              >
                {item.delta > 0 ? "+" : ""}
                {item.delta.toFixed(1)}% vs prior
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function PayrollAuditPeriodComparison({
  trend,
  loading,
}: PayrollAuditPeriodComparisonProps) {
  const sortedTrend = useMemo(
    () => [...trend].sort((a, b) => a.periodStart.localeCompare(b.periodStart)),
    [trend]
  );

  const [metric, setMetric] = useState<BridgeMetric>("netAmount");
  const [previousId, setPreviousId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string>("");

  const latest = sortedTrend[sortedTrend.length - 1] ?? null;
  const priorDefault =
    sortedTrend.length >= 2 ? sortedTrend[sortedTrend.length - 2] : null;
  const canCompare = sortedTrend.length >= 2;

  const effectivePreviousId =
    previousId || (canCompare ? periodKey(sortedTrend[0]) : "");
  const effectiveCurrentId =
    currentId ||
    (canCompare ? periodKey(sortedTrend[sortedTrend.length - 1]) : "");

  const previousUpload = sortedTrend.find(
    (u) => periodKey(u) === effectivePreviousId
  );
  const currentUpload = sortedTrend.find(
    (u) => periodKey(u) === effectiveCurrentId
  );

  const analysis = useMemo(() => {
    if (!previousUpload || !currentUpload) return null;
    if (periodKey(previousUpload) === periodKey(currentUpload)) return null;
    return buildPeriodBridge(
      metricsFromUploadRecord(previousUpload),
      metricsFromUploadRecord(currentUpload),
      metric
    );
  }, [previousUpload, currentUpload, metric]);

  const previousMetrics = previousUpload
    ? metricsFromUploadRecord(previousUpload)
    : null;
  const currentMetrics = currentUpload
    ? metricsFromUploadRecord(currentUpload)
    : null;

  const periodChanges = useMemo(() => {
    if (!previousMetrics || !currentMetrics || !previousUpload || !currentUpload)
      return [];
    if (periodKey(previousUpload) === periodKey(currentUpload)) return [];
    return buildPeriodChanges(previousMetrics, currentMetrics);
  }, [previousMetrics, currentMetrics, previousUpload, currentUpload]);

  const topMover = topMoverFromChanges(periodChanges);

  const volumeContext = useMemo(() => {
    if (!previousUpload || !currentUpload) return [];
    return buildVolumeContext(
      metricsFromUploadRecord(previousUpload),
      metricsFromUploadRecord(currentUpload)
    ).filter((v) => v.delta !== 0);
  }, [previousUpload, currentUpload]);

  if (loading) {
    return (
      <CardSection title="Period comparison" className="w-full">
        <div className={cn(dbKpiGrid, "animate-pulse")}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-muted/40" />
          ))}
        </div>
      </CardSection>
    );
  }

  if (!latest) {
    return (
      <CardSection title="Period comparison" className="w-full">
        <Caption className="text-muted-foreground">
          Upload a payroll register to see latest totals and period comparison.
        </Caption>
      </CardSection>
    );
  }

  const metricLabel = metric === "grossAmount" ? "Gross pay" : "Net pay";

  return (
    <CardSection
      title="Period comparison"
      className="w-full border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent"
      headerClassName="pb-2"
    >
      <VStack gap="4" className="w-full">
        <KpiSnapshot latest={latest} previous={priorDefault} />

        {!canCompare ? (
          <Caption className="text-muted-foreground">
            Upload one more cutoff to compare periods and see what changed.
          </Caption>
        ) : (
          <>
            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  From
                </label>
                <Select value={effectivePreviousId} onValueChange={setPreviousId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Earlier cutoff" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedTrend.map((u) => (
                      <SelectItem key={periodKey(u)} value={periodKey(u)}>
                        {periodOptionLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  To
                </label>
                <Select value={effectiveCurrentId} onValueChange={setCurrentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Later cutoff" />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedTrend.map((u) => (
                      <SelectItem key={periodKey(u)} value={periodKey(u)}>
                        {periodOptionLabel(u)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="lg:col-span-4">
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Compare
                </label>
                <Select
                  value={metric}
                  onValueChange={(v) => setMetric(v as BridgeMetric)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="netAmount">Net pay</SelectItem>
                    <SelectItem value="grossAmount">Gross pay</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {analysis && (
              <>
                <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
                  <SummaryCard
                    label={`${metricLabel} · from`}
                    value={formatCurrency(analysis.previousTotal)}
                    meta={analysis.previousLabel}
                    highlight
                  />
                  <SummaryCard
                    label={`${metricLabel} · to`}
                    value={formatCurrency(analysis.currentTotal)}
                    meta={analysis.currentLabel}
                    highlight
                  />
                  <SummaryCard
                    label={`${metricLabel} change`}
                    value={`${analysis.totalDelta >= 0 ? "+" : ""}${formatCurrency(analysis.totalDelta)}`}
                    meta={
                      analysis.totalDeltaPct != null
                        ? `${analysis.totalDeltaPct >= 0 ? "+" : ""}${analysis.totalDeltaPct.toFixed(1)}%`
                        : undefined
                    }
                    tone={
                      analysis.totalDelta > 0
                        ? "up"
                        : analysis.totalDelta < 0
                          ? "down"
                          : "neutral"
                    }
                  />
                  <SummaryCard
                    label="Largest change"
                    value={topMover?.label ?? "—"}
                    meta={
                      topMover
                        ? formatDelta(topMover.delta, topMover.kind)
                        : undefined
                    }
                  />
                </div>

                {volumeContext.length > 0 && (
                  <HStack gap="2" className="flex-wrap">
                    {volumeContext.map((v) => (
                      <Badge
                        key={v.label}
                        variant="secondary"
                        className="text-xs font-medium tabular-nums"
                      >
                        {v.label}:{" "}
                        <span className="font-bold">
                          {formatDelta(
                            v.delta,
                            v.isCurrency ? "currency" : "count"
                          )}
                        </span>
                      </Badge>
                    ))}
                  </HStack>
                )}

                <div className="w-full rounded-xl border border-primary/20 bg-primary/[0.02] p-4 sm:p-5">
                  <BodySmall className="mb-4 block text-base font-semibold">
                    What changed
                  </BodySmall>
                  <PeriodChangeCards
                    rows={periodChanges}
                    previous={previousMetrics}
                    current={currentMetrics}
                  />
                </div>
              </>
            )}
          </>
        )}
      </VStack>
    </CardSection>
  );
}
