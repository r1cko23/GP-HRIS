"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSection } from "@/components/ui/card-section";
import { HStack, VStack } from "@/components/ui/stack";
import { Caption, BodySmall } from "@/components/ui/typography";
import { MetricCard } from "@/components/ui/metric-card";
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
import { dbPageWrapper, dbTableShell, dbKpiGrid } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OrganicCutoffStepper } from "@/components/payroll/OrganicCutoffStepper";
import { OrganicCutoffGuide } from "@/components/payroll/OrganicCutoffGuide";
import { PayrollCatchupPanel } from "@/components/payroll/PayrollCatchupPanel";
import {
  buildOrganicAuditChecklist,
  deriveOrganicCutoffPrimaryAction,
  deriveOrganicCutoffSteps,
  hoursRowNeedsAttention,
  type OrganicCutoffPrimaryActionId,
} from "@/lib/payroll-register/organic-cutoff-workflow";
import { remittanceFilesThisCutoff } from "@/lib/payroll-register/cutoff-report-pack";
import { formatCurrency } from "@/utils/format";

type Period = {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  client_id: string;
  notes: string | null;
};

type RemittanceFiles = ReturnType<typeof remittanceFilesThisCutoff>;

type HoursRow = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  actual_regular_hours: number;
  overtime_hours: number;
  night_diff_hours: number;
  legal_holiday_hours: number;
  special_holiday_hours: number;
  rest_day_hours: number;
  pto_hours: number;
  daily_rate_payroll: number | null;
};

type RegisterLine = {
  id?: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  office_employee_id?: string | null;
  directory_employee_id?: string | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  deductions: Record<string, number>;
};

function payslipReviewHref(
  officeEmployeeId: string,
  periodStart: string
): string {
  const params = new URLSearchParams({
    employee: officeEmployeeId,
    period: periodStart,
  });
  return `/payroll/payslips?${params}`;
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    draft: "Draft",
    pending_audit: "Pending audit",
    approved: "Approved",
    posted: "Posted",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status.replace(/_/g, " ");
}

type HoursIssue = "" | "missing_rate" | "zero_hours" | "needs_attention";

const HOURS_PAGE = 50;
const REGISTER_PAGE = 50;

function downloadBase64File(
  base64: string,
  filename: string,
  mime: string
) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function jumpToSection(sectionId: string) {
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
  el.classList.add("ring-2", "ring-primary/30");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-primary/30");
  }, 1200);
}

export default function PayrollCutoffHubPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [orgId, setOrgId] = useState("");
  const [period, setPeriod] = useState<Period | null>(null);
  const [remittanceFiles, setRemittanceFiles] =
    useState<RemittanceFiles | null>(null);
  const [summary, setSummary] = useState<{
    hours_rows: number;
    punch_rows: number;
    missing_rate: number;
    zero_hours: number;
  } | null>(null);
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [hoursCount, setHoursCount] = useState(0);
  const [hoursOffset, setHoursOffset] = useState(0);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [hoursIssue, setHoursIssue] = useState<HoursIssue>("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editReg, setEditReg] = useState("");
  const [editOt, setEditOt] = useState("");
  const [register, setRegister] = useState<{
    run: { id: string; status: string; totals: Record<string, number> } | null;
    lines: RegisterLine[];
    count: number;
  } | null>(null);
  const [registerOffset, setRegisterOffset] = useState(0);
  const [registerQ, setRegisterQ] = useState("");
  const [registerQApplied, setRegisterQApplied] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    null | "approve" | "post" | "build_with_flags"
  >(null);
  const [spotCheckedPayslip, setSpotCheckedPayslip] = useState(false);
  const [reviewedSummary, setReviewedSummary] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const org = await ensureDirectoryOrgId();
      setOrgId(org);
      const hoursParams = new URLSearchParams({
        include: "hours",
        hours_limit: String(HOURS_PAGE),
        hours_offset: String(hoursOffset),
      });
      if (qApplied.trim()) hoursParams.set("q", qApplied.trim());
      if (hoursIssue) hoursParams.set("hours_issue", hoursIssue);

      const json = await directoryJson<{
        data: {
          period: Period;
          remittance_files?: RemittanceFiles;
          summary: {
            hours_rows: number;
            punch_rows: number;
            missing_rate: number;
            zero_hours: number;
          };
          hours?: HoursRow[];
          hours_pagination?: { count: number };
        };
      }>(`/api/timekeeping/cutoff-periods/${id}?${hoursParams}`, org);
      setPeriod(json.data.period);
      setRemittanceFiles(json.data.remittance_files ?? null);
      setSummary(json.data.summary);
      setHours(json.data.hours ?? []);
      setHoursCount(json.data.hours_pagination?.count ?? 0);

      try {
        const reg = await directoryJson<{
          data: {
            run: { id: string; status: string; totals: Record<string, number> };
            lines: RegisterLine[];
            count: number;
          } | null;
        }>(
          `/api/timekeeping/cutoff-periods/${id}/payroll-run?${new URLSearchParams(
            {
              limit: String(REGISTER_PAGE),
              offset: String(registerOffset),
              ...(registerQApplied.trim()
                ? { q: registerQApplied.trim() }
                : {}),
            }
          )}`,
          org
        );
        setRegister(
          reg.data
            ? {
                run: reg.data.run,
                lines: reg.data.lines ?? [],
                count: reg.data.count ?? 0,
              }
            : null
        );
      } catch {
        setRegister(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cutoff");
    } finally {
      setLoading(false);
    }
  }, [hoursIssue, hoursOffset, id, qApplied, registerOffset, registerQApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(
    label: string,
    fn: () => Promise<void | { hours_upserted?: number; employees_skipped?: number }>,
    nextHint?: string
  ) {
    setBusy(label);
    try {
      const result = await fn();
      if (
        result &&
        typeof result === "object" &&
        "hours_upserted" in result &&
        result.hours_upserted != null
      ) {
        toast.success(
          `${label}: ${result.hours_upserted} employee hour row(s)${
            result.employees_skipped
              ? ` · ${result.employees_skipped} not enrolled for Bundy clock (hours still written)`
              : ""
          }`
        );
      } else {
        toast.success(label);
      }
      if (nextHint) toast.message(nextHint);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function aggregate() {
    const org = orgId || (await ensureDirectoryOrgId());
    const json = await directoryJson<{
      data: {
        hours_upserted: number;
        punches_upserted: number;
        employees_skipped: number;
      };
    }>(
      `/api/timekeeping/cutoff-periods/${id}/aggregate-from-office`,
      org,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: true }),
      }
    );
    const r = json.data;
    if (r.hours_upserted === 0) {
      throw new Error(
        `No hours aggregated (${r.employees_skipped} employee(s) skipped — check Enrollment under Time for this client)`
      );
    }
    return r;
  }

  async function setStatus(next: string) {
    await directoryJson(`/api/timekeeping/cutoff-periods/${id}`, orgId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function buildRegister() {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/payroll-run`,
      orgId,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
  }

  async function postRegister() {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/payroll-run/post`,
      orgId,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }
    );
  }

  async function saveHoursEdit(hoursId: string) {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/hours/${hoursId}`,
      orgId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_regular_hours: Number(editReg) || 0,
          overtime_hours: Number(editOt) || 0,
          note: "HR draft edit",
        }),
      }
    );
    setEditId(null);
  }

  function downloadExport(type: string) {
    const url = `/api/timekeeping/cutoff-periods/${id}/exports?type=${encodeURIComponent(type)}`;
    void (async () => {
      try {
        const json = await directoryJson<{
          data: { csv: string; filename: string };
        }>(`${url}&format=json`, orgId);
        const blob = new Blob([json.data.csv], {
          type: "text/csv;charset=utf-8",
        });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = json.data.filename;
        a.click();
        URL.revokeObjectURL(href);
        toast.success(`Downloaded ${type}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    })();
  }

  function downloadPdfExport(type: "summary-pdf") {
    const params = new URLSearchParams({
      type,
      format: "json",
    });
    void (async () => {
      try {
        const json = await directoryJson<{
          data: { pdf_base64: string; filename: string };
        }>(
          `/api/timekeeping/cutoff-periods/${id}/exports?${params}`,
          orgId
        );
        downloadBase64File(
          json.data.pdf_base64,
          json.data.filename,
          "application/pdf"
        );
        setReviewedSummary(true);
        toast.success(`Downloaded ${json.data.filename}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "PDF export failed");
      }
    })();
  }

  async function downloadAllPayslipPdfs() {
    if (!register?.run) return;
    setBusy("Downloading payslips");
    try {
      const params = new URLSearchParams({
        type: "payslip-pdfs-zip",
        format: "json",
      });
      const json = await directoryJson<{
        data: { zip_base64: string; filename: string; count: number };
      }>(
        `/api/timekeeping/cutoff-periods/${id}/exports?${params}`,
        orgId
      );
      downloadBase64File(
        json.data.zip_base64,
        json.data.filename,
        "application/zip"
      );
      setSpotCheckedPayslip(true);
      toast.success(
        `Downloaded ${json.data.count} payslip PDF(s) as ${json.data.filename}`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Batch payslip download failed"
      );
    } finally {
      setBusy(null);
    }
  }

  const canEditHours =
    period?.status === "draft" || period?.status === "pending_audit";
  const canAggregate = canEditHours;
  const canApprove = period?.status === "pending_audit";
  const canSubmitAudit = period?.status === "draft";
  const canBuildRegister =
    period?.status === "approved" || period?.status === "posted";
  const canPost =
    period?.status === "approved" && register?.run?.status === "draft";
  const hasRegister = !!register?.run;
  const readinessIssues =
    (summary?.missing_rate ?? 0) > 0 || (summary?.zero_hours ?? 0) > 0;

  const steps = useMemo(
    () =>
      deriveOrganicCutoffSteps({
        periodStatus: period?.status,
        hoursRows: summary?.hours_rows ?? 0,
        hasRegister,
        registerStatus: register?.run?.status,
        missingRate: summary?.missing_rate,
        zeroHours: summary?.zero_hours,
      }),
    [
      hasRegister,
      period?.status,
      register?.run?.status,
      summary?.hours_rows,
      summary?.missing_rate,
      summary?.zero_hours,
    ]
  );

  const primaryAction = useMemo(
    () =>
      deriveOrganicCutoffPrimaryAction({
        periodStatus: period?.status,
        hoursRows: summary?.hours_rows ?? 0,
        hasRegister,
        registerStatus: register?.run?.status,
        missingRate: summary?.missing_rate,
        zeroHours: summary?.zero_hours,
      }),
    [
      hasRegister,
      period?.status,
      register?.run?.status,
      summary?.hours_rows,
      summary?.missing_rate,
      summary?.zero_hours,
    ]
  );

  const totals = register?.run?.totals ?? {};
  const checklist = useMemo(
    () =>
      buildOrganicAuditChecklist({
        periodStatus: period?.status,
        hoursRows: summary?.hours_rows ?? 0,
        punchRows: summary?.punch_rows ?? 0,
        missingRate: summary?.missing_rate ?? 0,
        zeroHours: summary?.zero_hours ?? 0,
        hasRegister,
        registerStatus: register?.run?.status,
        registerHeadcount: register?.count,
        registerGross: Number(totals.gross_pay ?? 0),
        registerNet: Number(totals.net_pay ?? 0),
      }),
    [
      hasRegister,
      period?.status,
      register?.count,
      register?.run?.status,
      summary?.hours_rows,
      summary?.missing_rate,
      summary?.punch_rows,
      summary?.zero_hours,
      totals.gross_pay,
      totals.net_pay,
    ]
  );

  const registerShowingFrom =
    (register?.count ?? 0) === 0 ? 0 : registerOffset + 1;
  const registerShowingTo = Math.min(
    registerOffset + REGISTER_PAGE,
    register?.count ?? 0
  );

  function applyHoursIssue(next: HoursIssue) {
    setHoursIssue(next);
    setHoursOffset(0);
    if (next) jumpToSection("cutoff-hours");
  }

  function executePrimary(actionId: OrganicCutoffPrimaryActionId) {
    switch (actionId) {
      case "aggregate":
        void runAction(
          "Aggregated from attendance",
          aggregate,
          "Review flagged rates and hour buckets next"
        ).then(() => jumpToSection("cutoff-readiness"));
        break;
      case "submit_audit":
        void runAction(
          "Submitted for audit",
          () => setStatus("pending_audit"),
          "Ready for approval — confirm checklist first"
        );
        break;
      case "approve":
        setConfirmAction("approve");
        break;
      case "build":
        if (readinessIssues) {
          setConfirmAction("build_with_flags");
        } else {
          void runAction(
            "Register built",
            buildRegister,
            "Review register totals, then spot-check a payslip before posting"
          ).then(() => jumpToSection("pre-post-review"));
        }
        break;
      case "post":
        setConfirmAction("post");
        break;
      case "review_hours":
      case "review_register":
      case "downloads":
      case "done":
        jumpToSection(primaryAction.sectionId);
        if (actionId === "review_hours") applyHoursIssue("needs_attention");
        break;
      default:
        jumpToSection(primaryAction.sectionId);
    }
  }

  async function confirmPendingAction() {
    const action = confirmAction;
    setConfirmAction(null);
    if (action === "approve") {
      await runAction(
        "Cutoff approved",
        () => setStatus("approved"),
        "Hours locked — build the payroll register next"
      );
      jumpToSection("cutoff-guide");
    } else if (action === "build_with_flags") {
      await runAction(
        "Register built",
        buildRegister,
        "Review register carefully — some hour rows still had flags"
      );
      jumpToSection("pre-post-review");
    } else if (action === "post") {
      await runAction(
        "Payroll posted",
        postRegister,
        "Cutoff finalized — download payslips and remittance files"
      );
      jumpToSection("cutoff-downloads");
    }
  }

  const firstRegisterLine = register?.lines[0];

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/payroll">← Payroll</Link>
            </Button>
          }
          title="Payroll cutoff"
          description={
            period
              ? `${period.period_start}–${period.period_end} · ${statusLabel(period.status)}`
              : "Organic cutoff payroll: hours, rates, register, and downloads"
          }
          actions={
            <HStack gap="2" className="flex-wrap">
              {canAggregate ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction(
                      "Aggregated from attendance",
                      aggregate,
                      "Review flagged rates and hour buckets next"
                    ).then(() => jumpToSection("cutoff-readiness"))
                  }
                >
                  {busy === "Aggregated from attendance"
                    ? "Aggregating…"
                    : "Re-aggregate"}
                </Button>
              ) : null}
              {canSubmitAudit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy || readinessIssues}
                  onClick={() =>
                    void runAction("Submitted for audit", () =>
                      setStatus("pending_audit")
                    )
                  }
                >
                  Submit audit
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setConfirmAction("approve")}
                >
                  Approve
                </Button>
              ) : null}
              {canBuildRegister ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    readinessIssues
                      ? setConfirmAction("build_with_flags")
                      : void runAction("Register built", buildRegister)
                  }
                >
                  {hasRegister ? "Rebuild register" : "Build register"}
                </Button>
              ) : null}
              {canPost ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() => setConfirmAction("post")}
                >
                  Post payroll
                </Button>
              ) : null}
            </HStack>
          }
        />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading && !period ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <CardSection title="Workflow">
              <OrganicCutoffStepper
                steps={steps}
                onStepSelect={jumpToSection}
              />
            </CardSection>

            <OrganicCutoffGuide
              primaryAction={primaryAction}
              checklist={checklist}
              busy={!!busy}
              onPrimaryAction={() => executePrimary(primaryAction.id)}
              onJumpToSection={jumpToSection}
            />

            <CardSection title="Summary">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <Caption className="text-muted-foreground">Status</Caption>
                  <p className="font-medium">
                    <Badge variant="outline">{statusLabel(period?.status ?? "")}</Badge>
                  </p>
                </div>
                <div>
                  <Caption className="text-muted-foreground">Hours rows</Caption>
                  <p className="font-medium tabular-nums">
                    {summary?.hours_rows ?? 0}
                  </p>
                </div>
                <div>
                  <Caption className="text-muted-foreground">Punches</Caption>
                  <p className="font-medium tabular-nums">
                    {summary?.punch_rows ?? 0}
                  </p>
                </div>
                {hasRegister ? (
                  <>
                    <div>
                      <Caption className="text-muted-foreground">
                        Headcount
                      </Caption>
                      <p className="font-medium tabular-nums">
                        {register?.count ?? 0}
                      </p>
                    </div>
                    <div>
                      <Caption className="text-muted-foreground">Gross</Caption>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(Number(totals.gross_pay ?? 0))}
                      </p>
                    </div>
                    <div>
                      <Caption className="text-muted-foreground">
                        Statutory
                      </Caption>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(
                          Number(totals.sss ?? 0) +
                            Number(totals.philhealth ?? 0) +
                            Number(totals.pagibig ?? 0) +
                            Number(totals.withholding_tax ?? 0)
                        )}
                      </p>
                    </div>
                    <div>
                      <Caption className="text-muted-foreground">Loans</Caption>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(Number(totals.loans ?? 0))}
                      </p>
                    </div>
                    <div>
                      <Caption className="text-muted-foreground">Net</Caption>
                      <p className="font-medium tabular-nums">
                        {formatCurrency(Number(totals.net_pay ?? 0))}
                      </p>
                    </div>
                    <div>
                      <Caption className="text-muted-foreground">
                        Register
                      </Caption>
                      <p className="font-medium">{register?.run?.status}</p>
                    </div>
                  </>
                ) : null}
              </div>
            </CardSection>

            {(summary?.hours_rows ?? 0) > 0 &&
            (canBuildRegister || canEditHours) ? (
              <div id="cutoff-readiness" className="scroll-mt-24">
                <CardSection title="Cutoff readiness">
                  <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                    Filter the hours table to rows that need a second look
                    before you approve or build. Daily rates come from attendance
                    aggregation.
                  </Caption>
                  <div className={dbKpiGrid}>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => applyHoursIssue("")}
                    >
                      <MetricCard
                        label="Hours rows"
                        value={summary?.hours_rows ?? 0}
                        meta="All employees in cutoff"
                        className={
                          hoursIssue === ""
                            ? "ring-2 ring-primary/25"
                            : undefined
                        }
                      />
                    </button>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => applyHoursIssue("missing_rate")}
                    >
                      <MetricCard
                        label="Missing daily rate"
                        value={summary?.missing_rate ?? 0}
                        meta="Must fix before approve"
                        className={cn(
                          (summary?.missing_rate ?? 0) > 0 &&
                            "border-amber-300",
                          hoursIssue === "missing_rate" &&
                            "ring-2 ring-amber-400/40"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => applyHoursIssue("zero_hours")}
                    >
                      <MetricCard
                        label="Zero-hour rows"
                        value={summary?.zero_hours ?? 0}
                        meta="Confirm absences or fix punches"
                        className={cn(
                          (summary?.zero_hours ?? 0) > 0 && "border-amber-300",
                          hoursIssue === "zero_hours" &&
                            "ring-2 ring-amber-400/40"
                        )}
                      />
                    </button>
                    <button
                      type="button"
                      className="text-left"
                      onClick={() => applyHoursIssue("needs_attention")}
                    >
                      <MetricCard
                        label="Needs attention"
                        value={
                          (summary?.missing_rate ?? 0) +
                          (summary?.zero_hours ?? 0)
                        }
                        meta="All flagged rows"
                        className={cn(
                          readinessIssues && "border-amber-300",
                          hoursIssue === "needs_attention" &&
                            "ring-2 ring-amber-400/40"
                        )}
                      />
                    </button>
                  </div>
                  {hoursIssue ? (
                    <HStack gap="2" className="mt-3">
                      <Badge variant="secondary">
                        Filtering:{" "}
                        {hoursIssue === "missing_rate"
                          ? "missing rate"
                          : hoursIssue === "zero_hours"
                            ? "zero hours"
                            : "needs attention"}
                      </Badge>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => applyHoursIssue("")}
                      >
                        Clear filter
                      </Button>
                    </HStack>
                  ) : null}
                </CardSection>
              </div>
            ) : null}

            <div id="cutoff-hours" className="scroll-mt-24">
              <CardSection title="Cutoff hours">
                <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                  Reg is regular hours: the 104h monthly cap (13 days × 8h)
                  minus absences. A scheduled workday with no complete time
                  entry counts as an absence. Re-aggregate after timesheet
                  changes.
                </Caption>
                <HStack gap="2" className="mb-3 flex-wrap">
                  <Input
                    className="max-w-sm"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        setHoursOffset(0);
                        setQApplied(q);
                      }
                    }}
                    placeholder="Search name or employee ID"
                    aria-label="Search hours"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setHoursOffset(0);
                      setQApplied(q);
                    }}
                  >
                    Search
                  </Button>
                  {(["", "missing_rate", "zero_hours"] as const).map(
                    (issue) => (
                      <Button
                        key={issue || "all"}
                        type="button"
                        size="sm"
                        variant={hoursIssue === issue ? "default" : "outline"}
                        onClick={() => applyHoursIssue(issue)}
                      >
                        {issue === ""
                          ? "All"
                          : issue === "missing_rate"
                            ? "Missing rate"
                            : "Zero hours"}
                      </Button>
                    )
                  )}
                </HStack>
                <div className={dbTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Reg</TableHead>
                        <TableHead>OT</TableHead>
                        <TableHead>ND</TableHead>
                        <TableHead>LH</TableHead>
                        <TableHead>SH</TableHead>
                        <TableHead>RD</TableHead>
                        <TableHead>PTO</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Flags</TableHead>
                        {canEditHours ? (
                          <TableHead className="text-right">Edit</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canEditHours ? 12 : 11}
                            className="py-8 text-center text-muted-foreground"
                          >
                            {qApplied || hoursIssue
                              ? "No hour rows match this search or filter."
                              : "No hours on file yet. Aggregate attendance to begin."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        hours.map((row) => {
                          const flags = hoursRowNeedsAttention(row);
                          const flagged = flags.missingRate || flags.zeroHours;
                          return (
                            <TableRow
                              key={row.id}
                              className={cn(
                                flagged && "bg-amber-50/70"
                              )}
                            >
                              <TableCell className="font-mono text-xs">
                                {row.employee_code}
                              </TableCell>
                              <TableCell>
                                {row.last_name}, {row.first_name}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {editId === row.id ? (
                                  <Input
                                    className="h-8 w-20"
                                    value={editReg}
                                    onChange={(e) => setEditReg(e.target.value)}
                                  />
                                ) : (
                                  row.actual_regular_hours
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {editId === row.id ? (
                                  <Input
                                    className="h-8 w-20"
                                    value={editOt}
                                    onChange={(e) => setEditOt(e.target.value)}
                                  />
                                ) : (
                                  row.overtime_hours
                                )}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {row.night_diff_hours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {row.legal_holiday_hours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {row.special_holiday_hours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {row.rest_day_hours}
                              </TableCell>
                              <TableCell className="tabular-nums">
                                {row.pto_hours}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "tabular-nums",
                                  flags.missingRate && "font-semibold text-amber-800"
                                )}
                              >
                                {row.daily_rate_payroll ?? "—"}
                              </TableCell>
                              <TableCell>
                                {flagged ? (
                                  <HStack gap="1" className="flex-wrap">
                                    {flags.missingRate ? (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-300 text-amber-900"
                                      >
                                        Rate
                                      </Badge>
                                    ) : null}
                                    {flags.zeroHours ? (
                                      <Badge
                                        variant="outline"
                                        className="border-amber-300 text-amber-900"
                                      >
                                        Hours
                                      </Badge>
                                    ) : null}
                                  </HStack>
                                ) : (
                                  <Caption className="text-muted-foreground">
                                    OK
                                  </Caption>
                                )}
                              </TableCell>
                              {canEditHours ? (
                                <TableCell className="text-right">
                                  {editId === row.id ? (
                                    <HStack gap="1" className="justify-end">
                                      <Button
                                        type="button"
                                        size="sm"
                                        onClick={() =>
                                          void runAction("Hours saved", () =>
                                            saveHoursEdit(row.id)
                                          )
                                        }
                                      >
                                        Save
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => setEditId(null)}
                                      >
                                        Cancel
                                      </Button>
                                    </HStack>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        setEditId(row.id);
                                        setEditReg(
                                          String(row.actual_regular_hours)
                                        );
                                        setEditOt(String(row.overtime_hours));
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                </TableCell>
                              ) : null}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {hoursCount > HOURS_PAGE ? (
                  <HStack gap="2" className="pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={hoursOffset === 0 || !!busy}
                      onClick={() =>
                        setHoursOffset(Math.max(0, hoursOffset - HOURS_PAGE))
                      }
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={
                        hoursOffset + HOURS_PAGE >= hoursCount || !!busy
                      }
                      onClick={() => setHoursOffset(hoursOffset + HOURS_PAGE)}
                    >
                      Next
                    </Button>
                    <Caption className="text-muted-foreground">
                      Showing {hoursOffset + 1}–
                      {Math.min(hoursOffset + HOURS_PAGE, hoursCount)} of{" "}
                      {hoursCount}
                    </Caption>
                  </HStack>
                ) : hoursCount > 0 ? (
                  <Caption className="pt-3 text-muted-foreground">
                    Showing {hoursCount} row{hoursCount === 1 ? "" : "s"}
                  </Caption>
                ) : null}
              </CardSection>
            </div>

            {period && orgId && period.status !== "posted" ? (
              <PayrollCatchupPanel
                cutoffId={id}
                orgId={orgId}
                periodStatus={period.status}
                periodLabel={`${period.period_start}–${period.period_end}`}
              />
            ) : null}

            {hasRegister && canPost ? (
              <div id="pre-post-review" className="scroll-mt-24">
                <CardSection title="Pre-post review">
                  <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                    Verify totals and open at least one payslip from the
                    Payslips tab before posting. Posting finalizes loans for
                    this cutoff.
                  </Caption>
                  <div className={dbKpiGrid}>
                    <MetricCard
                      label="Headcount"
                      value={register?.count ?? 0}
                      meta="Register lines"
                    />
                    <MetricCard
                      label="Gross"
                      value={formatCurrency(Number(totals.gross_pay ?? 0))}
                      meta="Total earnings"
                    />
                    <MetricCard
                      label="Net"
                      value={formatCurrency(Number(totals.net_pay ?? 0))}
                      meta="Take-home total"
                    />
                    <MetricCard
                      label="Loans"
                      value={formatCurrency(Number(totals.loans ?? 0))}
                      meta="Will post on confirm"
                    />
                  </div>
                  <div className="mt-4 space-y-2 rounded-md border border-border bg-muted/20 p-4">
                    <BodySmall className="font-semibold">
                      Double-check before post
                    </BodySmall>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={reviewedSummary}
                        onChange={(e) => setReviewedSummary(e.target.checked)}
                      />
                      <span>
                        I reviewed the payroll summary totals
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto px-1"
                          onClick={() => downloadPdfExport("summary-pdf")}
                        >
                          Download summary PDF
                        </Button>
                      </span>
                    </label>
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={spotCheckedPayslip}
                        onChange={(e) =>
                          setSpotCheckedPayslip(e.target.checked)
                        }
                      />
                      <span>
                        I spot-checked a payslip
                        {firstRegisterLine?.office_employee_id &&
                        period?.period_start ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto px-1"
                            asChild
                          >
                            <Link
                              href={payslipReviewHref(
                                firstRegisterLine.office_employee_id,
                                period.period_start
                              )}
                              onClick={() => setSpotCheckedPayslip(true)}
                            >
                              Open sample payslip
                            </Link>
                          </Button>
                        ) : null}
                      </span>
                    </label>
                    <HStack gap="2" className="pt-2">
                      <Button
                        type="button"
                        disabled={
                          !!busy ||
                          !reviewedSummary ||
                          !spotCheckedPayslip
                        }
                        onClick={() => setConfirmAction("post")}
                      >
                        Post payroll
                      </Button>
                      {!reviewedSummary || !spotCheckedPayslip ? (
                        <Caption className="text-muted-foreground">
                          Complete both checks to enable post from this panel
                        </Caption>
                      ) : null}
                    </HStack>
                  </div>
                </CardSection>
              </div>
            ) : null}

            {hasRegister ? (
              <>
                <div id="cutoff-downloads" className="scroll-mt-24">
                  <CardSection title="Downloads">
                    <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                      Bulk payslip ZIP, register summary, WTAX (with TIN), ATM
                      bank file, and other-deduction particulars. Open an
                      individual payslip from the register table or the Payslips
                      tab. SSS / PhilHealth / Pag-IBIG remittance files appear on
                      the second kinsena when this client files statutory monthly.
                    </Caption>
                    <div className="space-y-4">
                      <div>
                        <Caption className="mb-2 block font-medium text-foreground">
                          Payslips and summary
                        </Caption>
                        <HStack gap="2" className="flex-wrap">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => downloadPdfExport("summary-pdf")}
                            disabled={!!busy}
                          >
                            Payroll summary PDF
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            onClick={() => void downloadAllPayslipPdfs()}
                            disabled={!!busy}
                          >
                            Download all payslip PDFs (ZIP)
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => downloadExport("register_detail")}
                            disabled={!!busy}
                          >
                            Register detail CSV
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => downloadExport("payslips")}
                            disabled={!!busy}
                          >
                            Payslip roster CSV
                          </Button>
                        </HStack>
                      </div>
                      <div>
                        <Caption className="mb-2 block font-medium text-foreground">
                          This cutoff
                        </Caption>
                        <HStack gap="2" className="flex-wrap">
                          {(
                            [
                              ["wtax", "WTAX CSV"],
                              ["bank", "ATM bank CSV"],
                              ["other_deductions", "Other deductions CSV"],
                            ] as const
                          )
                            .filter(([type]) =>
                              type === "wtax"
                                ? remittanceFiles?.wtax !== false
                                : true
                            )
                            .map(([type, label]) => (
                              <Button
                                key={type}
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => downloadExport(type)}
                                disabled={!!busy}
                              >
                                {label}
                              </Button>
                            ))}
                        </HStack>
                      </div>
                      <div>
                        <Caption className="mb-2 block font-medium text-foreground">
                          Second-window remittance
                        </Caption>
                        {remittanceFiles?.sss === false ? (
                          <Caption className="mb-2 block text-muted-foreground">
                            Held until the 16–end window (Monthly statutory).
                          </Caption>
                        ) : null}
                        <HStack gap="2" className="flex-wrap">
                          {(
                            [
                              ["sss", "SSS CSV"],
                              ["philhealth", "PhilHealth CSV"],
                              ["pagibig", "Pag-IBIG CSV"],
                            ] as const
                          ).map(([type, label]) => (
                            <Button
                              key={type}
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => downloadExport(type)}
                              disabled={
                                !!busy || remittanceFiles?.[type] === false
                              }
                            >
                              {label}
                            </Button>
                          ))}
                        </HStack>
                      </div>
                    </div>
                  </CardSection>
                </div>

                <div id="payroll-register" className="scroll-mt-24">
                  <CardSection title="Payroll register">
                    <HStack gap="2" className="mb-3 flex-wrap">
                      <Input
                        className="max-w-sm"
                        value={registerQ}
                        onChange={(e) => setRegisterQ(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            setRegisterOffset(0);
                            setRegisterQApplied(registerQ);
                          }
                        }}
                        placeholder="Search register by name or ID"
                        aria-label="Search register"
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setRegisterOffset(0);
                          setRegisterQApplied(registerQ);
                        }}
                      >
                        Search
                      </Button>
                      <Badge variant="secondary" className="font-normal">
                        {(register?.count ?? 0) === 0
                          ? "0 lines"
                          : `Showing ${registerShowingFrom}–${registerShowingTo} of ${register?.count ?? 0}`}
                      </Badge>
                    </HStack>
                    <div className={dbTableShell}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Gross</TableHead>
                            <TableHead>Deductions</TableHead>
                            <TableHead>Net</TableHead>
                            <TableHead className="text-right">
                              Payslip
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(register?.lines.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="py-8 text-center text-muted-foreground"
                              >
                                {registerQApplied
                                  ? "No register lines match this search."
                                  : "Register is empty."}
                              </TableCell>
                            </TableRow>
                          ) : (
                            register?.lines.map((line, i) => (
                              <TableRow
                                key={line.id ?? `${line.employee_code}-${i}`}
                              >
                                <TableCell className="font-mono text-xs">
                                  {line.employee_code}
                                </TableCell>
                                <TableCell>
                                  {line.last_name}, {line.first_name}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                  {formatCurrency(Number(line.gross_pay))}
                                </TableCell>
                                <TableCell className="tabular-nums">
                                  {formatCurrency(
                                    Number(line.total_deductions)
                                  )}
                                </TableCell>
                                <TableCell className="tabular-nums font-medium">
                                  {formatCurrency(Number(line.net_pay))}
                                </TableCell>
                                <TableCell className="text-right">
                                  {line.office_employee_id &&
                                  period?.period_start ? (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      asChild
                                    >
                                      <Link
                                        href={payslipReviewHref(
                                          line.office_employee_id,
                                          period.period_start
                                        )}
                                        onClick={() =>
                                          setSpotCheckedPayslip(true)
                                        }
                                      >
                                        Open payslip
                                      </Link>
                                    </Button>
                                  ) : (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="outline"
                                      disabled
                                      title="No office employee linked for this register line"
                                    >
                                      Open payslip
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    {(register?.count ?? 0) > REGISTER_PAGE ? (
                      <HStack gap="2" className="pt-3">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={registerOffset === 0 || !!busy}
                          onClick={() =>
                            setRegisterOffset(
                              Math.max(0, registerOffset - REGISTER_PAGE)
                            )
                          }
                        >
                          Previous
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            registerOffset + REGISTER_PAGE >=
                              (register?.count ?? 0) || !!busy
                          }
                          onClick={() =>
                            setRegisterOffset(registerOffset + REGISTER_PAGE)
                          }
                        >
                          Next
                        </Button>
                      </HStack>
                    ) : null}
                  </CardSection>
                </div>
              </>
            ) : (
              <div id="payroll-register" className="scroll-mt-24" />
            )}

            {period && orgId && period.status === "posted" ? (
              <PayrollCatchupPanel
                cutoffId={id}
                orgId={orgId}
                periodStatus={period.status}
                periodLabel={`${period.period_start}–${period.period_end}`}
              />
            ) : null}
          </>
        )}
      </div>

      <AlertDialog
        open={confirmAction !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmAction(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction === "approve"
                ? "Approve and lock hours?"
                : confirmAction === "build_with_flags"
                  ? "Build register with audit flags?"
                  : "Post this payroll cutoff?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {confirmAction === "approve" ? (
                  <>
                    <p>
                      Approval locks hour edits. You will not be able to
                      re-aggregate until status is rolled back.
                    </p>
                    {readinessIssues ? (
                      <p className="text-amber-800">
                        There are still{" "}
                        {(summary?.missing_rate ?? 0) +
                          (summary?.zero_hours ?? 0)}{" "}
                        flagged row(s). Approve only if those absences or rates
                        are intentional.
                      </p>
                    ) : (
                      <p>Readiness checks are clear.</p>
                    )}
                  </>
                ) : null}
                {confirmAction === "build_with_flags" ? (
                  <p className="text-amber-800">
                    Missing rates or zero-hour rows remain. The register may
                    underpay or omit earnings for those employees.
                  </p>
                ) : null}
                {confirmAction === "post" ? (
                  <VStack gap="1" align="start">
                    <p>
                      Posting applies loan deductions and marks this cutoff as
                      posted. This should be the final step after register
                      review.
                    </p>
                    <p>
                      Headcount {register?.count ?? 0} · Gross{" "}
                      {formatCurrency(Number(totals.gross_pay ?? 0))} · Net{" "}
                      {formatCurrency(Number(totals.net_pay ?? 0))}
                    </p>
                  </VStack>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmPendingAction()}
            >
              {confirmAction === "approve"
                ? "Approve"
                : confirmAction === "build_with_flags"
                  ? "Build anyway"
                  : "Post payroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
