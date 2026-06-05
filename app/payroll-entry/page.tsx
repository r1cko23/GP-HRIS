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
import { BodySmall, Caption, H4 } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
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

  const loadEntry = useCallback(async () => {
    setLoading(true);
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
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
  }, [periodStart]);

  useEffect(() => {
    if (!permLoading && !canRead("payslips")) {
      router.replace("/dashboard");
      return;
    }
    if (!permLoading) {
      loadEntry();
    }
  }, [permLoading, canRead, router, loadEntry]);

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

  const needsTimesheetCount = useMemo(() => {
    if (!data?.rows) return 0;
    return data.rows.filter((r) => r.timesheetStatus !== "finalized").length;
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
          period_start: format(periodStart, "yyyy-MM-dd"),
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
          period_start: format(periodStart, "yyyy-MM-dd"),
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
      <VStack gap="6" className="w-full">
        <DashboardPageHeader
          title="Payroll Entry"
          description="Review cutoff readiness and generate draft payslips in bulk — Frappe HR Payroll Entry workflow."
        />

        <HStack justify="between" align="center" className="flex-wrap gap-3">
          <HStack gap="2" align="center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePeriod("prev")}
            >
              <Icon name="CaretLeft" size={IconSizes.sm} />
            </Button>
            <BodySmall className="font-medium min-w-[180px] text-center">
              {periodLabel}
            </BodySmall>
            <Button
              variant="outline"
              size="sm"
              onClick={() => changePeriod("next")}
            >
              <Icon name="CaretRight" size={IconSizes.sm} />
            </Button>
          </HStack>

          <HStack gap="2" className="flex-wrap">
            <Button variant="outline" onClick={loadEntry} disabled={loading}>
              <Icon name="ArrowsClockwise" size={IconSizes.sm} />
              Refresh
            </Button>
            {canCreate("payslips") && needsTimesheetCount > 0 && (
              <Button
                variant="secondary"
                onClick={finalizeTimesheets}
                disabled={finalizingTimesheets || loading}
              >
                <Icon name="CheckCircle" size={IconSizes.sm} />
                {finalizingTimesheets
                  ? "Finalizing…"
                  : `Finalize ${needsTimesheetCount} Timesheets`}
              </Button>
            )}
            {canCreate("payslips") && (
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={generating || generatableCount === 0}
              >
                <Icon name="RocketLaunch" size={IconSizes.sm} />
                {generating
                  ? "Running…"
                  : `Generate ${generatableCount} Payslips`}
              </Button>
            )}
          </HStack>
        </HStack>

        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Employees", value: data.total, color: "" },
              {
                label: "Timesheets OK",
                value: data.timesheetsFinalized,
                color: "text-green-700",
              },
              {
                label: "Need Timesheet",
                value: data.timesheetsMissing + data.timesheetsDraft,
                color: "text-amber-700",
              },
              { label: "Ready", value: data.ready, color: "text-green-700" },
              { label: "Blocked", value: data.blocked, color: "text-red-700" },
              { label: "Saved", value: data.saved, color: "text-blue-700" },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-4 pb-3">
                  <Caption className="text-muted-foreground">
                    {card.label}
                  </Caption>
                  <p className={`text-xl font-semibold ${card.color}`}>
                    {card.value}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card>
          <CardHeader className="pb-3">
            <HStack justify="between" align="center" className="flex-wrap gap-3">
              <CardTitle className="text-base">Cutoff checklist</CardTitle>
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
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row) => (
                    <TableRow key={row.employeeId}>
                      <TableCell>
                        <VStack gap="0" align="start">
                          <span className="font-medium text-sm">
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
                        {row.netPay != null ? formatCurrency(row.netPay) : "—"}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" asChild>
                          <Link
                            href={`/payslips?employee=${row.employeeId}&period=${data?.periodStart}`}
                          >
                            Open
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <H4 className="text-sm text-blue-900 mb-1">How this works</H4>
            <BodySmall className="text-blue-800">
              Workflow: <strong>Finalize timesheets</strong> first (locks Time
              Attendance for the cutoff), then <strong>Generate payslips</strong>{" "}
              as drafts. <strong>Ready</strong> rows pass all gates;{" "}
              <strong>Review</strong> rows have warnings but can still generate;{" "}
              <strong>Blocked</strong> rows need a finalized timesheet or pay
              rate. Admin marks saved drafts as <strong>Paid</strong> on the
              Payslips page.
            </BodySmall>
          </CardContent>
        </Card>
      </VStack>

      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run payroll for {periodLabel}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  This will generate draft payslips for{" "}
                  <strong>{generatableCount}</strong> employees (ready +
                  review). Already-saved payslips are skipped unless you choose
                  to overwrite.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={(e) => setOverwrite(e.target.checked)}
                  />
                  Overwrite existing payslips for this cutoff
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={runBulkGenerate}>
              Run Payroll
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
