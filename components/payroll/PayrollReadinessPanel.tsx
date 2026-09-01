"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { MetricCard } from "@/components/ui/metric-card";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbKpiGrid } from "@/lib/dashboard-ui";
import type {
  PayrollEntryRow,
  PayrollEntrySummary,
} from "@/lib/ph-payroll/payroll-entry-validation";
import { payrollEntryRowsToCsv } from "@/lib/ph-payroll/payroll-entry-validation";
import { PayrollRowAction } from "@/components/payroll/PayrollRowAction";

const statusStyles: Record<string, string> = {
  saved: "bg-blue-100 text-blue-900 border-blue-200",
  ready: "bg-emerald-100 text-emerald-900 border-emerald-200",
  warning: "bg-amber-100 text-amber-900 border-amber-200",
  blocked: "bg-red-100 text-red-900 border-red-200",
};

type Props = {
  validation: PayrollEntrySummary;
  periodStart: string;
  loading?: boolean;
  onRefresh?: () => void;
  onFilterStatus?: (status: "blocked" | "warning") => void;
};

export function PayrollReadinessPanel({
  validation,
  periodStart,
  loading,
  onRefresh,
  onFilterStatus,
}: Props) {
  const blockedRows = validation.rows.filter((r) => r.status === "blocked");
  const warningRows = validation.rows.filter((r) => r.status === "warning");

  function exportBlockedCsv() {
    const csv = payrollEntryRowsToCsv(validation.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payroll-blocked-${validation.periodStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <HStack justify="between" align="center" className="flex-wrap gap-2">
          <VStack gap="0" align="start">
            <CardTitle className="text-sm font-medium">
              Cutoff readiness
            </CardTitle>
            <Caption className="text-muted-foreground">
              Who still needs attention before you generate payslips
            </Caption>
          </VStack>
          <HStack gap="2" className="flex-wrap">
            {onRefresh ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                disabled={loading}
                aria-label="Refresh"
              >
                <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={exportBlockedCsv}
              disabled={blockedRows.length === 0}
            >
              <Icon name="FileCsv" size={IconSizes.sm} className="mr-1" />
              Export blocked
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/time/attendance?period_start=${periodStart}`}>
                Time Attendance
              </Link>
            </Button>
          </HStack>
        </HStack>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={dbKpiGrid}>
          <MetricCard
            label="Ready"
            value={validation.ready}
            className="cursor-pointer"
            meta="Can generate now"
          />
          <MetricCard
            label="Review"
            value={validation.warning}
            meta="Warnings only"
            className={
              validation.warning > 0 ? "cursor-pointer hover:border-amber-300" : ""
            }
          />
          <button
            type="button"
            className="text-left"
            onClick={() => onFilterStatus?.("blocked")}
            disabled={validation.blocked === 0}
          >
            <MetricCard
              label="Blocked"
              value={validation.blocked}
              meta="Fix before generate"
              className={
                validation.blocked > 0
                  ? "cursor-pointer border-red-200 hover:border-red-300"
                  : ""
              }
            />
          </button>
          <MetricCard
            label="Saved drafts"
            value={validation.saved}
            meta="Already generated"
          />
        </div>

        {validation.blocked > 0 ? (
          <BodySmall className="mb-3 text-red-700">
            {validation.blocked} employee
            {validation.blocked === 1 ? "" : "s"} blocked — use Fix in the
            table below before generating payslips.
          </BodySmall>
        ) : null}

        {(blockedRows.length > 0 || warningRows.length > 0) && (
          <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Timesheet</TableHead>
                  <TableHead>Issues / warnings</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...blockedRows, ...warningRows].map((row) => (
                  <ReadinessRow
                    key={row.employeeId}
                    row={row}
                    periodStart={periodStart}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {validation.blocked === 0 && validation.warning === 0 ? (
          <BodySmall className="text-emerald-700">
            All employees in scope are ready for payslip generation.
          </BodySmall>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ReadinessRow({
  row,
  periodStart,
}: {
  row: PayrollEntryRow;
  periodStart: string;
}) {
  const notes = [...row.issues, ...row.warnings];
  return (
    <TableRow>
      <TableCell>
        <div className="text-sm font-medium">{row.fullName}</div>
        <Caption>{row.employeeCode}</Caption>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className={statusStyles[row.status]}>
          {row.status}
        </Badge>
      </TableCell>
      <TableCell className="text-sm capitalize">{row.timesheetStatus}</TableCell>
      <TableCell className="max-w-md text-xs text-muted-foreground">
        {notes.join(" · ") || "—"}
      </TableCell>
      <TableCell className="text-right">
        <PayrollRowAction row={row} periodStart={periodStart} />
      </TableCell>
    </TableRow>
  );
}
