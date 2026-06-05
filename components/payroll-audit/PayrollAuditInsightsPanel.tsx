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
import { hasRichComposition } from "@/lib/payroll-summary/composition-chart";
import type { PayrollSummaryUploadRecord } from "@/lib/payroll-summary/types";
import { PayrollAuditBridgeChart } from "@/components/payroll-audit/PayrollAuditBridgeChart";
import { PayrollAuditCompositionChart } from "@/components/payroll-audit/PayrollAuditCompositionChart";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";
import { buildCompositionSeries } from "@/lib/payroll-summary/composition-chart";

interface PayrollAuditInsightsPanelProps {
  trend: PayrollSummaryUploadRecord[];
  clientName?: string;
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

function formatDelta(
  value: number,
  kind: PeriodChangeRow["kind"] | "currency" | "count" | "hours"
): string {
  const prefix = value > 0 ? "+" : "";
  const isCurrency = kind === "currency" || kind === "earnings" || kind === "deduction" || kind === "accrual";
  if (isCurrency) return `${prefix}${formatCurrency(value)}`;
  return `${prefix}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
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
  const variants: Record<PeriodChangeRow["kind"], "default" | "secondary" | "outline"> = {
    count: "secondary",
    hours: "secondary",
    earnings: "default",
    deduction: "outline",
    accrual: "outline",
  };
  return <Badge variant={variants[kind]}>{labels[kind]}</Badge>;
}

function PeriodChangesTable({ rows }: { rows: PeriodChangeRow[] }) {
  if (rows.length === 0) {
    return (
      <Caption className="text-muted-foreground block py-4 text-center">
        No changes between the selected cutoffs.
      </Caption>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead>Category</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Previous</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Change</TableHead>
            <TableHead className="text-right">Share</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.key}>
              <TableCell className="font-medium text-sm">{row.label}</TableCell>
              <TableCell>{kindBadge(row.kind)}</TableCell>
              <TableCell className="text-right text-sm">
                {formatValue(row.previous, row.kind)}
              </TableCell>
              <TableCell className="text-right text-sm">
                {formatValue(row.current, row.kind)}
              </TableCell>
              <TableCell className="text-right text-sm">
                <span
                  className={
                    row.delta > 0
                      ? "text-emerald-600"
                      : row.delta < 0
                        ? "text-red-600"
                        : ""
                  }
                >
                  {formatDelta(row.delta, row.kind)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                {row.sharePct > 0 ? (
                  <Badge variant="secondary">{row.sharePct.toFixed(0)}%</Badge>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sublabel,
  tone,
}: {
  label: string;
  value: string;
  sublabel?: string;
  tone?: "up" | "down" | "neutral";
}) {
  return (
    <Card className="stats-card-surface">
      <CardContent className="p-4">
        <Caption className="text-muted-foreground">{label}</Caption>
        <p
          className={`stats-value text-xl mt-1 ${
            tone === "up"
              ? "text-emerald-600"
              : tone === "down"
                ? "text-red-600"
                : ""
          }`}
        >
          {value}
        </p>
        {sublabel && (
          <Caption className="text-muted-foreground mt-0.5">{sublabel}</Caption>
        )}
      </CardContent>
    </Card>
  );
}

export function PayrollAuditInsightsPanel({
  trend,
  clientName,
}: PayrollAuditInsightsPanelProps) {
  const sortedTrend = useMemo(
    () =>
      [...trend].sort((a, b) =>
        a.periodStart.localeCompare(b.periodStart)
      ),
    [trend]
  );

  const [metric, setMetric] = useState<BridgeMetric>("netAmount");
  const [previousId, setPreviousId] = useState<string>("");
  const [currentId, setCurrentId] = useState<string>("");

  const canCompare = sortedTrend.length >= 2;

  const effectivePreviousId =
    previousId || (canCompare ? periodKey(sortedTrend[0]) : "");
  const effectiveCurrentId =
    currentId ||
    (canCompare
      ? periodKey(sortedTrend[sortedTrend.length - 1])
      : sortedTrend.length === 1
        ? periodKey(sortedTrend[0])
        : "");

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

  const periodChanges = useMemo(() => {
    if (!previousUpload || !currentUpload) return [];
    if (periodKey(previousUpload) === periodKey(currentUpload)) return [];
    return buildPeriodChanges(
      metricsFromUploadRecord(previousUpload),
      metricsFromUploadRecord(currentUpload)
    );
  }, [previousUpload, currentUpload]);

  const topMover = topMoverFromChanges(periodChanges);

  const volumeContext = useMemo(() => {
    if (!previousUpload || !currentUpload) return [];
    return buildVolumeContext(
      metricsFromUploadRecord(previousUpload),
      metricsFromUploadRecord(currentUpload)
    ).filter((v) => v.delta !== 0);
  }, [previousUpload, currentUpload]);

  const compositionSeries = useMemo(
    () => buildCompositionSeries(sortedTrend, "gross"),
    [sortedTrend]
  );
  const richComposition = hasRichComposition(compositionSeries);

  if (sortedTrend.length === 0) {
    return (
      <CardSection
        title="Period analysis"
        description="Upload payroll registers to compare cutoffs."
      >
        <div className="flex flex-col items-center justify-center py-10 text-center rounded-lg border border-dashed bg-muted/20">
          <div className="p-3 rounded-full bg-primary/10 mb-3">
            <Icon name="ChartLineUp" size={IconSizes.lg} className="text-primary" />
          </div>
          <BodySmall className="text-muted-foreground max-w-sm">
            Upload at least one register to see composition. Two cutoffs unlock period comparison.
          </BodySmall>
        </div>
      </CardSection>
    );
  }

  const metricLabel = metric === "grossAmount" ? "Gross pay" : "Net pay";

  return (
    <VStack gap="6" className="w-full">
      <CardSection
        title="Payroll composition"
        description={
          clientName
            ? `${clientName} — stacked bars show how gross pay and deductions are built per cutoff.`
            : "Stacked bars show how gross pay and deductions are built per cutoff."
        }
      >
        {!richComposition && (
          <div className="rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-2 mb-3">
            <Caption className="text-amber-900">
              Detailed slice breakdown needs employee-level register data. Re-upload PDFs to
              refresh parsed rows, or check that the register includes earnings columns.
            </Caption>
          </div>
        )}
        <PayrollAuditCompositionChart trend={sortedTrend} />
      </CardSection>

      {canCompare && (
        <CardSection
          title="Period comparison"
          description="Compare two cutoffs — what changed in pay, deductions, accruals, and headcount."
          className="border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Caption className="text-xs mb-1 block">From</Caption>
              <Select value={effectivePreviousId} onValueChange={setPreviousId}>
                <SelectTrigger>
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
            <div>
              <Caption className="text-xs mb-1 block">To</Caption>
              <Select value={effectiveCurrentId} onValueChange={setCurrentId}>
                <SelectTrigger>
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
            <div>
              <Caption className="text-xs mb-1 block">Pay total to compare</Caption>
              <Select
                value={metric}
                onValueChange={(v) => setMetric(v as BridgeMetric)}
              >
                <SelectTrigger>
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
            <VStack gap="4" className="w-full">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryCard
                  label={`${metricLabel} (from)`}
                  value={formatCurrency(analysis.previousTotal)}
                  sublabel={analysis.previousLabel}
                />
                <SummaryCard
                  label={`${metricLabel} (to)`}
                  value={formatCurrency(analysis.currentTotal)}
                  sublabel={analysis.currentLabel}
                />
                <SummaryCard
                  label={`${metricLabel} change`}
                  value={`${analysis.totalDelta >= 0 ? "+" : ""}${formatCurrency(analysis.totalDelta)}`}
                  sublabel={
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
                  sublabel={
                    topMover
                      ? formatDelta(topMover.delta, topMover.kind)
                      : "No category movement"
                  }
                />
              </div>

              {volumeContext.length > 0 && (
                <HStack gap="2" className="flex-wrap">
                  {volumeContext.map((v) => (
                    <Badge
                      key={v.label}
                      variant="outline"
                      className="text-xs py-1 px-2"
                    >
                      {v.label}:{" "}
                      {formatDelta(v.delta, v.isCurrency ? "currency" : "count")}
                    </Badge>
                  ))}
                </HStack>
              )}

              {periodChanges.length > 0 && (
                <div className="rounded-lg border bg-background p-4">
                  <Caption className="text-muted-foreground mb-3 block">
                    Category changes between cutoffs
                  </Caption>
                  <PayrollAuditBridgeChart analysis={analysis} />
                </div>
              )}

              <div>
                <Caption className="text-muted-foreground mb-2 block">
                  All changes — earnings, deductions, accruals, and volume
                </Caption>
                <PeriodChangesTable rows={periodChanges} />
              </div>
            </VStack>
          )}
        </CardSection>
      )}
    </VStack>
  );
}
