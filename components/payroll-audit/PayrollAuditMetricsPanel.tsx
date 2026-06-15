"use client";

import { useMemo } from "react";
import {
  buildAuditMetricsSummary,
  type AuditMetricRow,
} from "@/lib/payroll-summary/audit-metrics";
import { diffPayrollEmployees } from "@/lib/payroll-summary/diff-payroll-employees";
import { metricsFromUploadRecord } from "@/lib/payroll-summary/category-breakdown";
import type {
  AuditUploadAnomalies,
  PayrollEmployeeAnomalies,
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
} from "@/lib/payroll-summary/types";
import { CardSection } from "@/components/ui/card-section";
import { Badge } from "@/components/ui/badge";
import { Caption } from "@/components/ui/typography";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/utils/format";
import { formatBiMonthlyPeriod } from "@/utils/bimonthly";

interface PayrollAuditMetricsPanelProps {
  trend: PayrollSummaryUploadRecord[];
  /** Anomalies from the latest upload response (same-period baseline). */
  uploadAnomalies?: AuditUploadAnomalies | null;
  /** Explicit current/previous when comparing after upload. */
  current?: PayrollSummaryMetrics | null;
  previous?: PayrollSummaryMetrics | null;
  anomalies?: PayrollEmployeeAnomalies | null;
}

function periodLabel(metrics: PayrollSummaryMetrics): string {
  return formatBiMonthlyPeriod(
    new Date(metrics.periodStart + "T00:00:00"),
    new Date(metrics.periodEnd + "T00:00:00")
  );
}

function formatMetricValue(value: number, kind: AuditMetricRow["kind"]): string {
  if (kind === "count") return String(value);
  if (kind === "hours") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return formatCurrency(value);
}

function formatMetricDelta(
  delta: number | null,
  kind: AuditMetricRow["kind"]
): string {
  if (delta == null) return "—";
  const prefix = delta > 0 ? "+" : "";
  if (kind === "count") return `${prefix}${delta}`;
  if (kind === "hours") {
    return `${prefix}${delta.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return `${prefix}${formatCurrency(delta)}`;
}

function anomalySummary(row: AuditMetricRow): string {
  const { anomalies } = row;
  if (anomalies.affected === 0) return "None";

  const parts: string[] = [];
  if (row.key === "employeeCount") {
    if (anomalies.added > 0) parts.push(`${anomalies.added} added`);
    if (anomalies.removed > 0) parts.push(`${anomalies.removed} removed`);
    if (anomalies.increases > 0) {
      parts.push(`${anomalies.increases} ghost risk`);
    }
    return parts.join(" · ");
  }

  if (anomalies.added > 0) parts.push(`${anomalies.added} new`);
  if (anomalies.changed > 0) parts.push(`${anomalies.changed} changed`);
  if (anomalies.increases > 0) parts.push(`${anomalies.increases} ↑`);
  return parts.length > 0 ? parts.join(" · ") : `${anomalies.affected} affected`;
}

function AnomalyBadge({ row }: { row: AuditMetricRow }) {
  if (!row.tracked && row.key === "silHours") {
    return (
      <Caption className="text-muted-foreground">Not in register</Caption>
    );
  }

  if (row.anomalies.affected === 0) {
    return <Caption className="text-muted-foreground">None</Caption>;
  }

  const tone =
    row.anomalies.increases > 0 || row.anomalies.added > 0
      ? "border-amber-300 bg-amber-50 text-amber-900"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge variant="outline" className={`text-xs font-normal ${tone}`}>
      {anomalySummary(row)}
    </Badge>
  );
}

export function PayrollAuditMetricsPanel({
  trend,
  uploadAnomalies,
  current: currentProp,
  previous: previousProp,
  anomalies: anomaliesProp,
}: PayrollAuditMetricsPanelProps) {
  const { summary, compareLabel } = useMemo(() => {
    if (currentProp) {
      const anomalies =
        anomaliesProp ??
        uploadAnomalies?.samePeriod ??
        (previousProp ? diffPayrollEmployees(currentProp, previousProp) : null);

      const summary = buildAuditMetricsSummary(
        currentProp,
        previousProp ?? null,
        anomalies,
        {
          currentPeriodLabel: periodLabel(currentProp),
          previousPeriodLabel: previousProp
            ? periodLabel(previousProp)
            : null,
        }
      );

      return {
        summary,
        compareLabel: summary.previousPeriodLabel
          ? `${summary.previousPeriodLabel} → ${summary.currentPeriodLabel}`
          : summary.currentPeriodLabel,
      };
    }

    const sorted = [...trend]
      .filter((u) => u.documentType === "payroll_register" && u.periodStart)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart));

    const latest = sorted[sorted.length - 1];
    const prior = sorted.length >= 2 ? sorted[sorted.length - 2] : null;

    if (!latest) {
      return { summary: null, compareLabel: null };
    }

    const current = metricsFromUploadRecord(latest);
    const previous = prior ? metricsFromUploadRecord(prior) : null;
    const anomalies = previous
      ? diffPayrollEmployees(current, previous)
      : uploadAnomalies?.samePeriod ?? null;

    const summary = buildAuditMetricsSummary(current, previous, anomalies, {
      currentPeriodLabel: periodLabel(current),
      previousPeriodLabel: previous ? periodLabel(previous) : null,
    });

    return {
      summary,
      compareLabel: summary.previousPeriodLabel
        ? `${summary.previousPeriodLabel} → ${summary.currentPeriodLabel}`
        : summary.currentPeriodLabel,
    };
  }, [
    trend,
    uploadAnomalies,
    currentProp,
    previousProp,
    anomaliesProp,
  ]);

  if (!summary) {
    return (
      <CardSection
        title="Manning & payroll drivers"
        description="Upload a payroll register to track headcount, hours, OT, SIL, holiday pay, and loans."
      >
        <Caption className="text-muted-foreground">
          No register data yet.
        </Caption>
      </CardSection>
    );
  }

  return (
    <CardSection
      title="Manning & payroll drivers"
      description={
        summary.hasPrevious
          ? `Period changes and employee anomalies · ${compareLabel}`
          : `Current cutoff · ${compareLabel} — upload a second register to see changes`
      }
    >
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40">
              <TableHead>Metric</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead>Anomalies</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {summary.rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium text-sm">{row.label}</TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {!row.tracked && row.key === "silHours"
                    ? "—"
                    : row.previous != null
                      ? formatMetricValue(row.previous, row.kind)
                      : "—"}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {!row.tracked && row.key === "silHours"
                    ? "—"
                    : formatMetricValue(row.current, row.kind)}
                </TableCell>
                <TableCell
                  className={`text-right text-sm font-medium ${
                    row.delta != null && row.delta > 0
                      ? "text-amber-700"
                      : row.delta != null && row.delta < 0
                        ? "text-emerald-700"
                        : ""
                  }`}
                >
                  {formatMetricDelta(row.delta, row.kind)}
                  {row.deltaPercent != null && row.deltaPercent !== 0 && (
                    <Caption className="block text-muted-foreground text-xs">
                      {row.deltaPercent > 0 ? "+" : ""}
                      {row.deltaPercent.toFixed(1)}%
                    </Caption>
                  )}
                </TableCell>
                <TableCell>
                  <AnomalyBadge row={row} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </CardSection>
  );
}
