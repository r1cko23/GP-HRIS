"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { MetricCard } from "@/components/ui/metric-card";
import { PayrollWorkflowSteps } from "@/components/payroll/PayrollWorkflowSteps";
import { PayrollReadinessPanel } from "@/components/payroll/PayrollReadinessPanel";
import { PayrollRowAction } from "@/components/payroll/PayrollRowAction";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatCurrency } from "@/utils/format";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { derivePayrollWorkflow } from "@/lib/payroll-workflow";
import {
  dbHeaderActions,
  dbHeaderButton,
  dbKpiGrid,
  dbPageWrapper,
  dbPeriodNavButton,
  dbPeriodNavRow,
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import type {
  PayrollEntryRow,
  PayrollEntryStatus,
} from "@/lib/ph-payroll/payroll-entry-validation";

interface PayrollEntryResponse {
  periodStart: string;
  periodEnd: string;
  total: number;
  saved: number;
  ready: number;
  warning: number;
  blocked: number;
  timesheetsFinalized: number;
  timesheetsDraft: number;
  timesheetsMissing: number;
  totalGross: number;
  totalNet: number;
  rows: PayrollEntryRow[];
}

const TIMESHEET_LABELS = {
  missing: "No timesheet",
  draft: "Draft",
  finalized: "Finalized",
} as const;

const STATUS_LABELS: Record<PayrollEntryStatus, string> = {
  saved: "Saved",
  ready: "Ready",
  warning: "Review",
  blocked: "Blocked",
};

const STATUS_VARIANT: Record<
  PayrollEntryStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  saved: "secondary",
  ready: "default",
  warning: "outline",
  blocked: "destructive",
};

export default function PayrollEntryPage() {
  const router = useRouter();
  const { canRead, canCreate, loading: permLoading } = usePermissions();
  const [periodStart, setPeriodStart] = useState<Date>(
    getBiMonthlyPeriodStart()
  );
  const [data, setData] = useState<PayrollEntryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PayrollEntryStatus | "all">(
    "all"
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [overwrite, setOverwrite] = useState(false);
  const [finalizingTimesheets, setFinalizingTimesheets] = useState(false);

  const periodEnd = getBiMonthlyPeriodEnd(periodStart);
  const periodLabel = formatBiMonthlyPeriod(periodStart, periodEnd);
  const periodStartStr = format(periodStart, "yyyy-MM-dd");

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/payroll/entry?period_start=${periodStartStr}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load payroll entry");
      }
      const json = (await res.json()) as PayrollEntryResponse;
      setData(json);
    } catch (error: unknown) {
      console.error(error);
      toast.error(
        error instanceof Error ? error.message : "Failed to load payroll entry"
      );
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [periodStartStr]);

  useEffect(() => {
    if (!permLoading && !canRead("payslips")) {
      router.replace("/dashboard");
      return;
    }
    if (!permLoading) {
      loadEntry();
    }
  }, [permLoading, canRead, router, loadEntry]);

  const workflow = useMemo(() => {
    if (!data) return null;
    return derivePayrollWorkflow(data, { canCreate: canCreate("payslips") });
  }, [data, canCreate]);

  const filteredRows = useMemo(() => {
    if (!data?.rows) return [];
    return data.rows.filter((row) => {
      const matchesSearch =
        !search ||
        row.fullName.toLowerCase().includes(search.toLowerCase()) ||
        row.employeeCode.includes(search);
      const matchesStatus =
        statusFilter === "all" || row.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [data?.rows, search, statusFilter]);

  const generatableCount = useMemo(() => {
    if (!data?.rows) return 0;
    return data.rows.filter(
      (r) => r.status === "ready" || r.status === "warning"
    ).length;
  }, [data?.rows]);

  async function finalizeTimesheets() {
    if (!canCreate("payslips")) {
      toast.error("You do not have permission to finalize timesheets");
      return;
    }

    setFinalizingTimesheets(true);
    try {
      const res = await fetch("/api/timesheet/auto-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStartStr,
          period_end: format(periodEnd, "yyyy-MM-dd"),
          overwrite_existing: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to finalize timesheets");
      }

      const result = await res.json();
      const created = result.results?.filter(
        (r: { status: string }) => r.status === "created"
      ).length;
      const updated = result.results?.filter(
        (r: { status: string }) => r.status === "updated"
      ).length;
      toast.success(
        `Timesheets finalized: ${created ?? 0} created, ${updated ?? 0} updated`
      );
      await loadEntry();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to finalize timesheets"
      );
    } finally {
      setFinalizingTimesheets(false);
    }
  }

  async function runBulkGenerate() {
    if (!canCreate("payslips")) {
      toast.error("You do not have permission to generate payslips");
      return;
    }

    setGenerating(true);
    setShowConfirm(false);

    try {
      const targetIds = (data?.rows ?? [])
        .filter((r) => r.status === "ready" || r.status === "warning")
        .map((r) => r.employeeId);

      const res = await fetch("/api/payroll/entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_start: periodStartStr,
          employee_ids: targetIds,
          overwrite,
          include_warnings: true,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Bulk generation failed");
      }

      const result = await res.json();
      toast.success(
        `Payroll run complete: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
      );
      await loadEntry();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Bulk generation failed"
      );
    } finally {
      setGenerating(false);
    }
  }

  function changePeriod(direction: "prev" | "next") {
    setPeriodStart(
      direction === "prev"
        ? getPreviousBiMonthlyPeriod(periodStart)
        : getNextBiMonthlyPeriod(periodStart)
    );
  }

  function handlePrimaryAction() {
    if (!workflow) return;

    switch (workflow.primaryAction.id) {
      case "finalize_timesheets":
        void finalizeTimesheets();
        break;
      case "filter_blocked":
        setStatusFilter("blocked");
        document
          .getElementById("payroll-employee-table")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
        toast.info("Showing blocked employees — use Fix in each row.");
        break;
      case "generate_payslips":
        setShowConfirm(true);
        break;
      case "open_payslips":
        router.push(`/payslips?period=${periodStartStr}`);
        break;
      case "refresh":
        void loadEntry();
        break;
      default:
        break;
    }
  }

  if (permLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <BodySmall>Loading…</BodySmall>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <DashboardPageHeader
          title="Payroll Entry"
          description="Run payroll for each cutoff — lock timesheets, fix blockers, generate drafts, then mark paid."
        />

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className={dbPeriodNavRow}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePeriod("prev")}
              className={dbPeriodNavButton}
              aria-label="Previous period"
            >
              <Icon name="CaretLeft" size={IconSizes.sm} />
            </Button>
            <BodySmall className="min-w-0 flex-1 px-1 text-center text-xs font-medium sm:text-sm">
              {periodLabel}
            </BodySmall>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePeriod("next")}
              className={dbPeriodNavButton}
              aria-label="Next period"
            >
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>
          </div>

          <div className={dbHeaderActions}>
            <Button
              variant="outline"
              onClick={loadEntry}
              disabled={loading}
              className={dbHeaderButton}
            >
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Refresh
            </Button>
            {canCreate("payslips") && generatableCount > 0 ? (
              <Button
                variant="secondary"
                onClick={() => setShowConfirm(true)}
                disabled={generating || loading}
                className={dbHeaderButton}
              >
                <Icon name="RocketLaunch" size={IconSizes.sm} />
                {generating ? "Running…" : `Generate ${generatableCount}`}
              </Button>
            ) : null}
            <Button variant="outline" asChild className={dbHeaderButton}>
              <Link href={`/payslips?period=${periodStartStr}`}>
                <Icon name="Receipt" size={IconSizes.sm} />
                Payslips
              </Link>
            </Button>
          </div>
        </div>

        {data && workflow ? (
          <PayrollWorkflowSteps
            steps={workflow.steps}
            primaryAction={workflow.primaryAction}
            periodLabel={periodLabel}
            loading={loading || finalizingTimesheets || generating}
            onPrimaryAction={handlePrimaryAction}
          />
        ) : null}

        {data ? (
          <div className={dbKpiGrid}>
            <MetricCard label="Employees" value={data.total} />
            <MetricCard
              label="Timesheets locked"
              value={`${data.timesheetsFinalized}/${data.total}`}
              meta={
                data.timesheetsMissing + data.timesheetsDraft > 0
                  ? `${data.timesheetsMissing + data.timesheetsDraft} still open`
                  : "All finalized"
              }
            />
            <MetricCard
              label="Gross (saved)"
              value={formatCurrency(data.totalGross)}
            />
            <MetricCard
              label="Net (saved)"
              value={formatCurrency(data.totalNet)}
            />
          </div>
        ) : null}

        {data ? (
          <PayrollReadinessPanel
            validation={data}
            periodStart={periodStartStr}
            loading={loading}
            onRefresh={loadEntry}
            onFilterStatus={(status) => {
              setStatusFilter(status);
              document
                .getElementById("payroll-employee-table")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          />
        ) : null}

        <Card id="payroll-employee-table">
          <CardHeader className="pb-3">
            <HStack justify="between" align="center" className="flex-wrap gap-3">
              <VStack gap="0" align="start">
                <CardTitle className="text-base">All employees</CardTitle>
                <Caption className="text-muted-foreground">
                  Use <strong>What to do</strong> for the next action on each row
                </Caption>
              </VStack>
              <HStack gap="2" className="flex-wrap">
                <Input
                  placeholder="Search employee…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-48"
                />
                <Select
                  value={statusFilter}
                  onValueChange={(v) =>
                    setStatusFilter(v as PayrollEntryStatus | "all")
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="warning">Review</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                    <SelectItem value="saved">Saved</SelectItem>
                  </SelectContent>
                </Select>
              </HStack>
            </HStack>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <BodySmall>Loading payroll entry…</BodySmall>
              </div>
            ) : !filteredRows.length ? (
              <div className="flex h-40 items-center justify-center">
                <BodySmall className="text-muted-foreground">
                  No employees match your filters.
                </BodySmall>
              </div>
            ) : (
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Payroll</TableHead>
                      <TableHead>Timesheet</TableHead>
                      <TableHead className="text-right">Clock logs</TableHead>
                      <TableHead className="text-right">Absences</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">What to do</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.map((row) => (
                      <TableRow key={row.employeeId}>
                        <TableCell>
                          <VStack gap="0" align="start">
                            <span className="text-sm font-medium">
                              {row.fullName}
                            </span>
                            <Caption>{row.employeeCode}</Caption>
                          </VStack>
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[row.status]}>
                            {STATUS_LABELS[row.status]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.timesheetStatus === "finalized"
                                ? "default"
                                : row.timesheetStatus === "draft"
                                  ? "outline"
                                  : "destructive"
                            }
                          >
                            {TIMESHEET_LABELS[row.timesheetStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.clockEntryCount}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.absences}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <Caption className="text-muted-foreground">
                            {[...row.issues, ...row.warnings].join(" · ") || "—"}
                          </Caption>
                        </TableCell>
                        <TableCell className="text-right">
                          {row.grossPay != null
                            ? formatCurrency(row.grossPay)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.netPay != null
                            ? formatCurrency(row.netPay)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <PayrollRowAction
                            row={row}
                            periodStart={data?.periodStart ?? periodStartStr}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Step 3 — Generate payslips for {periodLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>
                  This creates <strong>draft</strong> payslips for{" "}
                  <strong>{generatableCount}</strong> employee
                  {generatableCount === 1 ? "" : "s"} (ready + review). After
                  generation, go to <strong>Payslips</strong> to review and mark
                  each one as paid.
                </p>
                {data && data.blocked > 0 ? (
                  <p className="text-amber-800">
                    {data.blocked} blocked employee
                    {data.blocked === 1 ? "" : "s"} will be skipped.
                  </p>
                ) : null}
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  Overwrite existing draft payslips for this cutoff
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkGenerate}>
              Generate drafts
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
