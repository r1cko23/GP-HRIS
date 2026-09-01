"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { generateGpPayrollRegisterPDF } from "@/utils/payroll-run-register-pdf";
import { format } from "date-fns";
import {
  buildPayrollRunFormFromPeriodStart,
  formatBiMonthlyPeriod,
  getBiMonthlyPeriodEnd,
  getDefaultPayrollRunPeriod,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { DbDesktopBlock } from "@/components/dashboard/DashboardViewport";
import {
  dbHeaderActions,
  dbPageWrapper,
  dbPeriodNavButton,
  dbPeriodNavRow,
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { PayrollReadinessPanel } from "@/components/payroll/PayrollReadinessPanel";
import type { PayrollEntrySummary } from "@/lib/ph-payroll/payroll-entry-validation";
import { formatCurrency } from "@/utils/format";

interface PayrollRun {
  id: string;
  cutoff_start: string;
  cutoff_end: string;
  pay_date: string | null;
  status: string;
  created_at: string;
  selected_employee_ids?: string[] | null;
  payslip_count?: number;
  total_gross?: number;
  total_net?: number;
}

interface PayslipRow {
  id: string;
  employee_id: string;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  deductions_breakdown?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  employee?: {
    id: string;
    employee_id: string;
    full_name: string;
    position?: string | null;
  } | null;
}

interface RunSelectableEmployee {
  id: string;
  employee_id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  middle_initial: string | null;
}

const statusStyles: Record<string, string> = {
  draft: "border-border bg-muted/70 text-foreground",
  processing: "border-primary/25 bg-primary/10 text-primary",
  finalized: "border-primary/25 bg-primary/10 text-primary",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export default function PayrollPage() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromQuery = searchParams.get("run_id");
  const { canRead, canCreate, loading: permLoading } = usePermissions();

  const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewRunDialog, setShowNewRunDialog] = useState(false);
  const [newRunPeriodStart, setNewRunPeriodStart] = useState<Date>(
    () => getDefaultPayrollRunPeriod().periodStart
  );
  const [newRunForm, setNewRunForm] = useState(() =>
    buildPayrollRunFormFromPeriodStart(getDefaultPayrollRunPeriod().periodStart)
  );
  const [creating, setCreating] = useState(false);
  const [selectedRun, setSelectedRun] = useState<PayrollRun | null>(null);
  const [payslips, setPayslips] = useState<PayslipRow[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payrollValidation, setPayrollValidation] =
    useState<PayrollEntrySummary | null>(null);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [activeEmployeesForRun, setActiveEmployeesForRun] = useState<
    RunSelectableEmployee[]
  >([]);
  const [selectedEmployeeIdsForRun, setSelectedEmployeeIdsForRun] = useState<
    string[]
  >([]);
  const [employeeScopeQuery, setEmployeeScopeQuery] = useState("");
  const [copyFromRunId, setCopyFromRunId] = useState("");
  const [loadingRunScope, setLoadingRunScope] = useState(false);

  const periodLabel = useMemo(() => {
    if (!selectedRun) return "";
    return formatBiMonthlyPeriod(
      new Date(selectedRun.cutoff_start),
      new Date(selectedRun.cutoff_end)
    );
  }, [selectedRun]);

  function getRunEmployeeName(emp: RunSelectableEmployee) {
    if (emp.full_name?.trim()) return emp.full_name.trim();
    const middleInitial = emp.middle_initial?.trim()
      ? ` ${emp.middle_initial.trim().charAt(0)}.`
      : "";
    return `${emp.last_name || ""}, ${emp.first_name || ""}${middleInitial}`.trim();
  }

  const filteredEmployeesForRun = useMemo(() => {
    const q = employeeScopeQuery.trim().toLowerCase();
    if (!q) return [];
    return activeEmployeesForRun.filter((emp) => {
      const name = getRunEmployeeName(emp).toLowerCase();
      const code = String(emp.employee_id || "").toLowerCase();
      return (
        name.includes(q) ||
        emp.first_name?.toLowerCase().includes(q) ||
        emp.last_name?.toLowerCase().includes(q) ||
        code.includes(q)
      );
    });
  }, [activeEmployeesForRun, employeeScopeQuery]);

  const selectedEmployeesForRun = useMemo(
    () =>
      selectedEmployeeIdsForRun
        .map((id) => activeEmployeesForRun.find((emp) => emp.id === id))
        .filter((emp): emp is RunSelectableEmployee => Boolean(emp)),
    [activeEmployeesForRun, selectedEmployeeIdsForRun]
  );

  const previousRunsForScope = useMemo(
    () => payrollRuns.filter((run) => String(run.status) !== "cancelled"),
    [payrollRuns]
  );

  const copyFromRun = useMemo(
    () => previousRunsForScope.find((run) => run.id === copyFromRunId) ?? null,
    [copyFromRunId, previousRunsForScope]
  );

  function runScopeCount(run: PayrollRun) {
    if (
      Array.isArray(run.selected_employee_ids) &&
      run.selected_employee_ids.length > 0
    ) {
      return run.selected_employee_ids.length;
    }
    if (activeEmployeesForRun.length > 0) return activeEmployeesForRun.length;
    return null;
  }

  const fetchPayrollRuns = useCallback(async () => {
    setLoading(true);
    try {
      const { data: runs, error } = await supabase
        .from("payroll_runs")
        .select("*")
        .order("cutoff_start", { ascending: false });
      if (error) throw error;

      const runsWithCounts = await Promise.all(
        (runs || [])
          .filter((run: PayrollRun) => run.status !== "cancelled")
          .map(async (run: PayrollRun) => {
            const { data: slips } = await supabase
              .from("payslips")
              .select("gross_pay, net_pay")
              .eq("payroll_run_id", run.id);
            return {
              ...run,
              payslip_count: slips?.length || 0,
              total_gross:
                slips?.reduce((s, p) => s + Number(p.gross_pay), 0) || 0,
              total_net: slips?.reduce((s, p) => s + Number(p.net_pay), 0) || 0,
            };
          })
      );

      setPayrollRuns(runsWithCounts);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load payroll runs"
      );
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  const loadActiveEmployeesForRun = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(
          "id, employee_id, full_name, first_name, last_name, middle_initial"
        )
        .eq("is_active", true)
        .order("last_name", { ascending: true });
      if (error) throw error;
      setActiveEmployeesForRun((data || []) as RunSelectableEmployee[]);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load active employees"
      );
      setActiveEmployeesForRun([]);
    }
  }, [supabase]);

  const loadEmployeesFromPayrollRun = useCallback(
    async (runId: string, options?: { silent?: boolean }) => {
      const run = payrollRuns.find((item) => item.id === runId);
      if (!run) return 0;

      setLoadingRunScope(true);
      try {
        let ids: string[] = [];
        if (
          Array.isArray(run.selected_employee_ids) &&
          run.selected_employee_ids.length > 0
        ) {
          ids = run.selected_employee_ids.map((id) => String(id));
        } else {
          const { data: slips, error } = await supabase
            .from("payslips")
            .select("employee_id")
            .eq("payroll_run_id", runId);
          if (error) throw error;
          if (slips && slips.length > 0) {
            ids = [...new Set(slips.map((slip) => String(slip.employee_id)))];
          } else {
            ids = activeEmployeesForRun.map((emp) => emp.id);
          }
        }

        const activeIds = new Set(activeEmployeesForRun.map((emp) => emp.id));
        const validIds = ids.filter((id) => activeIds.has(id));
        setSelectedEmployeeIdsForRun(validIds);

        if (!options?.silent) {
          toast.success(
            `Loaded ${validIds.length} employee(s) from ${format(
              new Date(run.cutoff_start),
              "MMM d"
            )} – ${format(new Date(run.cutoff_end), "MMM d, yyyy")}.`
          );
        }

        return validIds.length;
      } catch (error: unknown) {
        toast.error(
          error instanceof Error
            ? error.message
            : "Failed to load employees from payroll run"
        );
        return 0;
      } finally {
        setLoadingRunScope(false);
      }
    },
    [payrollRuns, supabase, activeEmployeesForRun]
  );

  const initNewRunEmployeeScope = useCallback(async () => {
    const latest = previousRunsForScope[0];
    if (!latest) {
      setCopyFromRunId("");
      setSelectedEmployeeIdsForRun([]);
      return;
    }
    setCopyFromRunId(latest.id);
    await loadEmployeesFromPayrollRun(latest.id, { silent: true });
  }, [previousRunsForScope, loadEmployeesFromPayrollRun]);

  const loadPayrollValidation = useCallback(async (run: PayrollRun) => {
    setLoadingValidation(true);
    try {
      const res = await fetch(
        `/api/payroll-runs/validate?payroll_run_id=${run.id}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to load validation");
      setPayrollValidation(json as PayrollEntrySummary);
    } catch {
      setPayrollValidation(null);
    } finally {
      setLoadingValidation(false);
    }
  }, []);

  const openRunDetail = useCallback(
    async (run: PayrollRun) => {
      setSelectedRun(run);
      setLoadingPayslips(true);
      void loadPayrollValidation(run);
      try {
        const { data, error } = await supabase
          .from("payslips")
          .select(
            "id, employee_id, gross_pay, total_deductions, net_pay, deductions_breakdown, created_at, updated_at, employees:employee_id ( id, employee_id, full_name, position )"
          )
          .eq("payroll_run_id", run.id)
          .order("created_at");
        if (error) throw error;
        const mapped = (data || []).map((p: Record<string, unknown>) => ({
          ...p,
          employee: p.employees as PayslipRow["employee"],
        })) as PayslipRow[];
        setPayslips(mapped);
      } catch (error: unknown) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load payslips"
        );
      } finally {
        setLoadingPayslips(false);
      }
    },
    [supabase, loadPayrollValidation]
  );

  useEffect(() => {
    if (!permLoading && !canRead("payslips")) {
      router.replace("/reports");
      return;
    }
    if (!permLoading) {
      void fetchPayrollRuns();
      void loadActiveEmployeesForRun();
    }
  }, [permLoading, canRead, router, fetchPayrollRuns, loadActiveEmployeesForRun]);

  useEffect(() => {
    if (!runIdFromQuery || !payrollRuns.length) return;
    const run = payrollRuns.find((r) => r.id === runIdFromQuery);
    if (run) void openRunDetail(run);
  }, [runIdFromQuery, payrollRuns, openRunDetail]);

  function applyPayrollPeriodStart(periodStart: Date) {
    const normalized = new Date(
      periodStart.getFullYear(),
      periodStart.getMonth(),
      periodStart.getDate()
    );
    setNewRunPeriodStart(normalized);
    setNewRunForm(buildPayrollRunFormFromPeriodStart(normalized));
  }

  function shiftPayrollPeriod(direction: -1 | 1) {
    const next =
      direction === -1
        ? getPreviousBiMonthlyPeriod(newRunPeriodStart)
        : getNextBiMonthlyPeriod(newRunPeriodStart);
    applyPayrollPeriodStart(next);
  }

  async function handleCreateRun(e: React.FormEvent) {
    e.preventDefault();
    if (!newRunForm.cutoff_start || !newRunForm.cutoff_end) {
      toast.error("Cutoff start and end dates are required.");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("payroll_runs")
        .insert([
          {
            cutoff_start: newRunForm.cutoff_start,
            cutoff_end: newRunForm.cutoff_end,
            pay_date: newRunForm.pay_date || null,
            status: "draft",
            selected_employee_ids:
              selectedEmployeeIdsForRun.length > 0
                ? selectedEmployeeIdsForRun
                : null,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      toast.success("Payroll run created.");
      setShowNewRunDialog(false);
      await fetchPayrollRuns();
      if (data) void openRunDetail(data as PayrollRun);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create payroll run"
      );
    } finally {
      setCreating(false);
    }
  }

  async function generatePayslips(options?: { skipWarningsConfirm?: boolean }) {
    if (!selectedRun) return;

    if (payrollValidation && payrollValidation.blocked > 0) {
      toast.error(
        `${payrollValidation.blocked} employee(s) blocked. Fix issues in the readiness panel first.`
      );
      return;
    }

    if (
      payrollValidation &&
      payrollValidation.warning > 0 &&
      !options?.skipWarningsConfirm
    ) {
      const ok = window.confirm(
        `${payrollValidation.warning} employee(s) have warnings. Continue generating?`
      );
      if (!ok) return;
    }

    setProcessing(true);
    try {
      const res = await fetch("/api/payroll-runs/generate-payslips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Failed to generate payslips");
      }

      toast.success(`Generated ${json.generated ?? 0} draft payslip(s).`);
      const updated = { ...selectedRun, status: "processing" };
      setSelectedRun(updated);
      await openRunDetail(updated);
      await fetchPayrollRuns();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to generate payslips"
      );
    } finally {
      setProcessing(false);
    }
  }

  async function finalizeRun() {
    if (!selectedRun) return;
    setProcessing(true);
    try {
      const res = await fetch("/api/payroll-runs/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to finalize");

      toast.success("Payroll run finalized. Payslips released to employees.");
      const updated = { ...selectedRun, status: "finalized" };
      setSelectedRun(updated);
      await fetchPayrollRuns();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to finalize payroll run"
      );
    } finally {
      setProcessing(false);
    }
  }

  async function cancelRun() {
    if (!selectedRun) return;
    try {
      const { error } = await supabase
        .from("payroll_runs")
        .update({ status: "cancelled" })
        .eq("id", selectedRun.id);
      if (error) throw error;
      toast.success("Payroll run cancelled.");
      setSelectedRun(null);
      await fetchPayrollRuns();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to cancel run"
      );
    }
  }

  function exportBankPayrollFile() {
    if (!selectedRun || selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting bank details.");
      return;
    }
    if (payslips.length === 0) {
      toast.error("No payslips found for this run.");
      return;
    }

    const header = ["ACCOUNT #", "AMOUNT", "NAME"];
    const csvLines = [
      header.join(","),
      ...payslips.map((ps) => {
        const name = ps.employee?.full_name || "Unknown";
        return [`""`, Number(ps.net_pay || 0).toFixed(2), `"${name.replace(/"/g, '""')}"`].join(",");
      }),
    ];

    const fileName = `bank_payroll_${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}.csv`;
    const blob = new Blob([`\uFEFF${csvLines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Bank payroll file exported.");
  }

  async function exportPayrollExcel() {
    if (!selectedRun) return;
    if (selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting payroll Excel.");
      return;
    }
    try {
      const res = await fetch("/api/payroll-runs/export-payroll-excel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.error || "Failed to export payroll Excel");
      }
      const blob = await res.blob();
      const fileName = `payroll_${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Payroll Excel exported.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export payroll Excel"
      );
    }
  }

  async function exportPayrollPdf() {
    if (!selectedRun) return;
    if (selectedRun.status !== "finalized") {
      toast.error("Finalize the payroll run before exporting payroll PDF.");
      return;
    }
    try {
      const res = await fetch("/api/payroll-runs/export-payroll-table", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payroll_run_id: selectedRun.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error || "Failed to prepare payroll PDF data");
      }
      const table = json?.table;
      if (!table) throw new Error("Missing payroll table in response");

      const doc = generateGpPayrollRegisterPDF(table);
      doc.save(
        `payroll_${selectedRun.cutoff_start}_to_${selectedRun.cutoff_end}.pdf`
      );
      toast.success("Payroll PDF exported.");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to export payroll PDF"
      );
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

  if (selectedRun) {
    return (
      <DashboardLayout>
        <div className={cn("mx-auto w-full max-w-6xl", dbPageWrapper)}>
          <HStack
            justify="between"
            align="start"
            className="w-full flex-col gap-4 sm:flex-row"
          >
            <VStack gap="1" align="start">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedRun(null)}
                className="mb-1"
              >
                <Icon name="ArrowLeft" size={IconSizes.sm} className="mr-2" />
                Back to Payroll Runs
              </Button>
              <H1>Payroll: {periodLabel}</H1>
              <HStack gap="2" align="center" className="flex-wrap">
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    statusStyles[selectedRun.status] || ""
                  )}
                >
                  {selectedRun.status}
                </Badge>
                {selectedRun.pay_date ? (
                  <Caption>
                    Pay date:{" "}
                    {format(new Date(selectedRun.pay_date), "MMM d, yyyy")}
                  </Caption>
                ) : null}
                <Caption>
                  Scope:{" "}
                  {selectedRun.selected_employee_ids?.length
                    ? `${selectedRun.selected_employee_ids.length} selected employee(s)`
                    : "All active employees"}
                </Caption>
              </HStack>
            </VStack>
            {canCreate("payslips") ? (
              <HStack
                gap="2"
                className="w-full flex-wrap sm:ml-auto sm:w-auto sm:justify-end"
              >
                {selectedRun.status === "draft" ? (
                  <Button onClick={() => generatePayslips()} disabled={processing}>
                    <Icon
                      name="ArrowsClockwise"
                      size={IconSizes.sm}
                      className={processing ? "animate-spin mr-2" : "mr-2"}
                    />
                    {processing ? "Generating…" : "Generate Payslips"}
                  </Button>
                ) : null}
                {selectedRun.status === "processing" ? (
                  <>
                    <Button
                      onClick={() => generatePayslips()}
                      variant="outline"
                      disabled={processing}
                    >
                      <Icon name="ArrowsClockwise" size={IconSizes.sm} className="mr-2" />
                      Regenerate
                    </Button>
                    <Button onClick={finalizeRun} disabled={processing}>
                      <Icon name="Check" size={IconSizes.sm} className="mr-2" />
                      Finalize
                    </Button>
                  </>
                ) : null}
                {(selectedRun.status === "draft" ||
                  selectedRun.status === "processing") && (
                  <Button variant="destructive" onClick={cancelRun}>
                    Cancel Run
                  </Button>
                )}
                {selectedRun.status === "finalized" ? (
                  <>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline">
                          <Icon name="Download" size={IconSizes.sm} className="mr-2" />
                          Export Payroll
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => void exportPayrollPdf()}>
                          Download PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void exportPayrollExcel()}>
                          Download Excel
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="outline" onClick={exportBankPayrollFile}>
                      <Icon name="Download" size={IconSizes.sm} className="mr-2" />
                      Export Bank File
                    </Button>
                  </>
                ) : null}
              </HStack>
            ) : null}
          </HStack>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            {[
              {
                label: "Employees",
                value: payslips.length || runScopeCount(selectedRun) || 0,
              },
              {
                label: "Total gross",
                value: formatCurrency(
                  payslips.reduce((s, p) => s + Number(p.gross_pay), 0)
                ),
              },
              {
                label: "Total deductions",
                value: formatCurrency(
                  payslips.reduce((s, p) => s + Number(p.total_deductions), 0)
                ),
              },
              {
                label: "Total net",
                value: formatCurrency(
                  payslips.reduce((s, p) => s + Number(p.net_pay), 0)
                ),
              },
            ].map((card) => (
              <Card key={card.label}>
                <CardContent className="pt-6">
                  <BodySmall className="text-muted-foreground">
                    {card.label}
                  </BodySmall>
                  <p className="mt-1 text-2xl font-bold">{card.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {payrollValidation ? (
            <PayrollReadinessPanel
              validation={payrollValidation}
              periodStart={selectedRun.cutoff_start}
              loading={loadingValidation}
              onRefresh={() => loadPayrollValidation(selectedRun)}
            />
          ) : null}

          <CardSection
            title="Payslips"
            description={`${payslips.length} employee payslip(s) for this run.`}
          >
            {loadingPayslips ? (
              <div className="flex items-center justify-center py-10">
                <BodySmall>Loading payslips…</BodySmall>
              </div>
            ) : payslips.length === 0 ? (
              <BodySmall className="py-8 text-center text-muted-foreground">
                No payslips yet. Finalize timesheets, then click Generate Payslips.
              </BodySmall>
            ) : (
              <DbDesktopBlock className={dbTableShell}>
                <Table className="w-full min-w-[760px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payslips.map((ps) => (
                      <TableRow key={ps.id}>
                        <TableCell>
                          <div className="text-sm font-medium">
                            {ps.employee?.full_name || "Unknown"}
                          </div>
                          <Caption>{ps.employee?.employee_id}</Caption>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(ps.gross_pay)}
                        </TableCell>
                        <TableCell className="text-right text-destructive">
                          {formatCurrency(ps.total_deductions)}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(ps.net_pay)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="secondary" size="sm" asChild>
                            <Link
                              href={`/payroll/payslips?employee=${encodeURIComponent(ps.employee_id)}&period=${encodeURIComponent(selectedRun.cutoff_start)}&payroll_run_id=${encodeURIComponent(selectedRun.id)}`}
                            >
                              <Icon name="PencilSimple" size={IconSizes.sm} className="mr-1" />
                              Edit
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </DbDesktopBlock>
            )}
          </CardSection>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-6xl", dbPageWrapper)}>
        <HStack
          justify="between"
          align="center"
          className="w-full flex-col gap-3 sm:flex-row"
        >
          <H1>Office payroll (legacy)</H1>
          {canCreate("payslips") ? (
            <div className={dbHeaderActions}>
              <Button
                onClick={() => {
                  applyPayrollPeriodStart(getDefaultPayrollRunPeriod().periodStart);
                  setEmployeeScopeQuery("");
                  void loadActiveEmployeesForRun().then(() => {
                    void initNewRunEmployeeScope();
                  });
                  setShowNewRunDialog(true);
                }}
              >
                <Icon name="Plus" size={IconSizes.sm} />
                New Payroll Run
              </Button>
            </div>
          ) : null}
        </HStack>

        <CardSection
          title="Dual-run only"
          description="Live Organic payroll is Operations → Payroll (cutoff hub). This weekly office path stays for dual-run until Organic cutover exit."
        >
          <Button asChild variant="secondary" size="sm">
            <Link href="/payroll">Go to Payroll cutoffs</Link>
          </Button>
        </CardSection>

        <CardSection title="Payroll runs" description="Bi-monthly cutoffs, most recent first.">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <BodySmall>Loading payroll runs…</BodySmall>
            </div>
          ) : payrollRuns.length === 0 ? (
            <BodySmall className="py-10 text-center text-muted-foreground">
              No payroll runs yet. Create one to start a bi-monthly payroll batch.
            </BodySmall>
          ) : (
            <DbDesktopBlock className={dbTableShell}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cutoff</TableHead>
                    <TableHead>Pay date</TableHead>
                    <TableHead className="text-center">Payslips</TableHead>
                    <TableHead className="text-right">Total net</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium">
                        {formatBiMonthlyPeriod(
                          new Date(run.cutoff_start),
                          new Date(run.cutoff_end)
                        )}
                      </TableCell>
                      <TableCell>
                        {run.pay_date
                          ? format(new Date(run.pay_date), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {run.payslip_count && run.payslip_count > 0
                          ? run.payslip_count
                          : runScopeCount(run) ?? 0}
                      </TableCell>
                      <TableCell className="text-right font-medium text-primary">
                        {formatCurrency(run.total_net || 0)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "capitalize",
                            statusStyles[run.status] || ""
                          )}
                        >
                          {run.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openRunDetail(run)}
                        >
                          <Icon name="Eye" size={IconSizes.sm} className="mr-1" />
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </DbDesktopBlock>
          )}
        </CardSection>
      </div>

      <Dialog
        open={showNewRunDialog}
        onOpenChange={(open) => {
          setShowNewRunDialog(open);
          if (open) {
            applyPayrollPeriodStart(getDefaultPayrollRunPeriod().periodStart);
            setEmployeeScopeQuery("");
            void loadActiveEmployeesForRun().then(() => {
              void initNewRunEmployeeScope();
            });
          }
        }}
      >
        <DialogContent className="max-h-[min(90vh,800px)] max-w-xl overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>New payroll run</DialogTitle>
            <DialogDescription>
              Bi-monthly cutoff (1–15 or 16–end of month). Dates are prefilled.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRun} className="space-y-4">
            <div className="space-y-2">
              <Label>Cutoff period</Label>
              <div className={dbPeriodNavRow}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={dbPeriodNavButton}
                  onClick={() => shiftPayrollPeriod(-1)}
                >
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                </Button>
                <BodySmall className="min-w-0 flex-1 px-1 text-center text-sm font-medium">
                  {formatBiMonthlyPeriod(
                    newRunPeriodStart,
                    getBiMonthlyPeriodEnd(newRunPeriodStart)
                  )}
                </BodySmall>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={dbPeriodNavButton}
                  onClick={() => shiftPayrollPeriod(1)}
                >
                  <Icon name="CaretRight" size={IconSizes.sm} />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="cutoff-start">Cutoff start</Label>
                <Input
                  id="cutoff-start"
                  type="date"
                  required
                  value={newRunForm.cutoff_start}
                  onChange={(e) =>
                    setNewRunForm((prev) => ({
                      ...prev,
                      cutoff_start: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cutoff-end">Cutoff end</Label>
                <Input
                  id="cutoff-end"
                  type="date"
                  required
                  value={newRunForm.cutoff_end}
                  onChange={(e) =>
                    setNewRunForm((prev) => ({
                      ...prev,
                      cutoff_end: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pay-date">Pay date</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={newRunForm.pay_date}
                  onChange={(e) =>
                    setNewRunForm((prev) => ({
                      ...prev,
                      pay_date: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-3">
              {previousRunsForScope.length > 0 ? (
                <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                  <Label htmlFor="copy-from-run">Start from previous run</Label>
                  <HStack gap="2" align="end" className="flex-col sm:flex-row">
                    <Select
                      value={copyFromRunId || undefined}
                      onValueChange={(runId) => {
                        setCopyFromRunId(runId);
                        void loadEmployeesFromPayrollRun(runId);
                      }}
                      disabled={loadingRunScope}
                    >
                      <SelectTrigger id="copy-from-run" className="w-full sm:flex-1">
                        <SelectValue placeholder="Select payroll run" />
                      </SelectTrigger>
                      <SelectContent>
                        {previousRunsForScope.map((run) => (
                          <SelectItem key={run.id} value={run.id}>
                            {formatBiMonthlyPeriod(
                              new Date(run.cutoff_start),
                              new Date(run.cutoff_end)
                            )}
                            {run.payslip_count ? ` · ${run.payslip_count} payslips` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!copyFromRunId || loadingRunScope}
                      onClick={() => {
                        if (copyFromRunId) {
                          void loadEmployeesFromPayrollRun(copyFromRunId);
                        }
                      }}
                    >
                      {loadingRunScope ? "Loading…" : "Reload list"}
                    </Button>
                  </HStack>
                  {copyFromRun && selectedEmployeeIdsForRun.length > 0 ? (
                    <Caption>
                      {selectedEmployeeIdsForRun.length} loaded from{" "}
                      {formatBiMonthlyPeriod(
                        new Date(copyFromRun.cutoff_start),
                        new Date(copyFromRun.cutoff_end)
                      )}
                      . Search below to add more.
                    </Caption>
                  ) : null}
                </div>
              ) : null}
              <HStack justify="between" align="center">
                <Label htmlFor="employee-scope-search">Employee scope (optional)</Label>
                <HStack gap="1">
                  {selectedEmployeeIdsForRun.length > 0 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedEmployeeIdsForRun([])}
                    >
                      Clear ({selectedEmployeeIdsForRun.length})
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSelectedEmployeeIdsForRun(
                        activeEmployeesForRun.map((emp) => emp.id)
                      )
                    }
                  >
                    Select all
                  </Button>
                </HStack>
              </HStack>
              <div className="relative">
                <Icon
                  name="MagnifyingGlass"
                  size={IconSizes.sm}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="employee-scope-search"
                  type="search"
                  placeholder="Search by name or employee ID…"
                  value={employeeScopeQuery}
                  onChange={(e) => setEmployeeScopeQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {selectedEmployeesForRun.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedEmployeesForRun.map((emp) => (
                    <Badge key={emp.id} variant="secondary" className="gap-1 pr-1 font-normal">
                      {getRunEmployeeName(emp)}
                      <button
                        type="button"
                        className="rounded-sm p-0.5 hover:bg-muted"
                        aria-label={`Remove ${getRunEmployeeName(emp)}`}
                        onClick={() =>
                          setSelectedEmployeeIdsForRun((prev) =>
                            prev.filter((id) => id !== emp.id)
                          )
                        }
                      >
                        <Icon name="X" size={IconSizes.xs} />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : null}
              {employeeScopeQuery.trim() ? (
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {filteredEmployeesForRun.length === 0 ? (
                    <BodySmall className="p-3 text-muted-foreground">No matches.</BodySmall>
                  ) : (
                    filteredEmployeesForRun.map((emp) => (
                      <label
                        key={emp.id}
                        className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 text-sm last:border-b-0 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={selectedEmployeeIdsForRun.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            const isChecked = checked === true;
                            setSelectedEmployeeIdsForRun((prev) =>
                              isChecked
                                ? prev.includes(emp.id)
                                  ? prev
                                  : [...prev, emp.id]
                                : prev.filter((id) => id !== emp.id)
                            );
                          }}
                        />
                        <span>
                          {getRunEmployeeName(emp)} ({emp.employee_id || "No ID"})
                        </span>
                      </label>
                    ))
                  )}
                </div>
              ) : (
                <BodySmall className="text-muted-foreground">
                  {selectedEmployeeIdsForRun.length > 0
                    ? "Search to add more employees."
                    : "Search to add employees, or leave empty to run payroll for all active employees."}
                </BodySmall>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowNewRunDialog(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create run"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
