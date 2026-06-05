"use client";

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
import type {
  EmployeeAnomalyRow,
  PayrollEmployeeAnomalies,
} from "@/lib/payroll-summary/types";
import { Caption } from "@/components/ui/typography";

function formatDelta(value: number | null, isCurrency = false): string {
  if (value == null) return "—";
  const prefix = value > 0 ? "+" : "";
  const formatted = isCurrency
    ? formatCurrency(value)
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  return `${prefix}${formatted}`;
}

function AnomalyTable({
  rows,
  showDeltas = false,
}: {
  rows: EmployeeAnomalyRow[];
  showDeltas?: boolean;
}) {
  if (rows.length === 0) return null;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Employee</TableHead>
          <TableHead>Status</TableHead>
          {showDeltas ? (
            <>
              <TableHead className="text-right">Hours Δ</TableHead>
              <TableHead className="text-right">Gross Δ</TableHead>
              <TableHead className="text-right">SIL Cutoff Δ</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-right">Hours</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">SIL Cutoff</TableHead>
            </>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={`${row.status}-${row.name}`}>
            <TableCell className="font-medium text-sm">{row.name}</TableCell>
            <TableCell>
              <Badge
                variant={
                  row.status === "added"
                    ? "default"
                    : row.status === "removed"
                      ? "destructive"
                      : "outline"
                }
              >
                {row.status === "added"
                  ? "Added"
                  : row.status === "removed"
                    ? "Removed"
                    : "Changed"}
              </Badge>
            </TableCell>
            {showDeltas ? (
              <>
                <TableCell className="text-right">
                  {formatDelta(row.hoursDelta)}
                </TableCell>
                <TableCell className="text-right">
                  {formatDelta(row.grossDelta, true)}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatDelta(row.silCutoffDelta, true)}
                </TableCell>
              </>
            ) : (
              <>
                <TableCell className="text-right">
                  {row.hoursWorked?.toFixed(2) ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.grossAmount != null
                    ? formatCurrency(row.grossAmount)
                    : "—"}
                </TableCell>
                <TableCell className="text-right">
                  {row.silCutoff != null
                    ? formatCurrency(row.silCutoff)
                    : "—"}
                </TableCell>
              </>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function PayrollEmployeeAnomaliesPanel({
  title,
  anomalies,
}: {
  title: string;
  anomalies: PayrollEmployeeAnomalies;
}) {
  const hasAny =
    anomalies.added.length > 0 ||
    anomalies.removed.length > 0 ||
    anomalies.changed.length > 0;

  if (!anomalies.hasBaseline) {
    return (
      <Caption className="text-muted-foreground">
        No prior register to compare — employee roster saved as plantilla baseline.
      </Caption>
    );
  }

  if (!hasAny) {
    return (
      <Caption className="text-muted-foreground">
        No employee anomalies detected vs baseline.
      </Caption>
    );
  }

  const periodLabel =
    anomalies.baselinePeriodStart && anomalies.baselinePeriodEnd
      ? formatBiMonthlyPeriod(
          new Date(anomalies.baselinePeriodStart + "T00:00:00"),
          new Date(anomalies.baselinePeriodEnd + "T00:00:00")
        )
      : null;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {periodLabel && (
          <Caption className="text-muted-foreground">
            Compared to register from {periodLabel}
          </Caption>
        )}
      </div>

      {anomalies.added.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-amber-200">
            <Caption className="font-medium text-amber-900">
              {anomalies.added.length} added employee
              {anomalies.added.length !== 1 ? "s" : ""} — not in prior register
            </Caption>
          </div>
          <AnomalyTable rows={anomalies.added} />
        </div>
      )}

      {anomalies.removed.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30">
            <Caption className="font-medium">
              {anomalies.removed.length} removed employee
              {anomalies.removed.length !== 1 ? "s" : ""}
            </Caption>
          </div>
          <AnomalyTable rows={anomalies.removed} />
        </div>
      )}

      {anomalies.changed.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <div className="px-3 py-2 border-b bg-muted/30">
            <Caption className="font-medium">
              {anomalies.changed.length} employee
              {anomalies.changed.length !== 1 ? "s" : ""} with payment changes
            </Caption>
          </div>
          <AnomalyTable rows={anomalies.changed} showDeltas />
        </div>
      )}
    </div>
  );
}
