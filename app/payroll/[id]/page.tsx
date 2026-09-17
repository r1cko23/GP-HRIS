"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  dbPageWrapper,
  dbTableShell,
  dbKpiGrid,
  dbMobileTabList,
  dbMobileTabTrigger,
} from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { OrganicCutoffStepper } from "@/components/payroll/OrganicCutoffStepper";
import { OrganicCutoffGuide } from "@/components/payroll/OrganicCutoffGuide";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { CutoffSummaryBreakdownPanel } from "@/components/payroll/CutoffSummaryBreakdown";
import type { CutoffSummaryBreakdown } from "@/lib/payroll-register/cutoff-summary-breakdown";
import { PayrollAdjustmentPanel } from "@/components/payroll/PayrollAdjustmentPanel";
import { CutoffBillingPanel } from "@/components/payroll/CutoffBillingPanel";
import {
  RegisterPayslipDialog,
  type RegisterPayslipLine,
} from "@/components/payroll/RegisterPayslipDialog";
import {
  buildOrganicAuditChecklist,
  deriveOrganicCutoffPrimaryAction,
  deriveOrganicCutoffSteps,
  hoursRowNeedsAttention,
  type OrganicCutoffPrimaryActionId,
} from "@/lib/payroll-register/organic-cutoff-workflow";
import {
  cutoffHubTabForSection,
  type CutoffHubTab,
} from "@/lib/payroll-register/cutoff-hub-tabs";
import { remittanceFilesThisCutoff } from "@/lib/payroll-register/cutoff-report-pack";
import { formatCurrency, formatNumber } from "@/utils/format";
import {
  canIngestFromGpClient,
  usesOfficeClockAggregate,
} from "@/lib/timekeeping/cutoff-types";
import { canDeleteCutoffPeriod } from "@/lib/timekeeping/cutoff-status";
import {
  canActorEditCutoffHours,
  cutoffHoursWindowOpen,
} from "@/lib/timekeeping/hours-edit-fields";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { isHRFamilyRole } from "@/lib/roles";

type Period = {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  client_id: string;
  notes: string | null;
  source_app?: string | null;
  run_by?: string | null;
  period_kind?: string | null;
  source_cutoff_period_id?: string | null;
};

type RemittanceFiles = ReturnType<typeof remittanceFilesThisCutoff>;

type HoursRow = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  outlet: string | null;
  actual_regular_hours: number;
  overtime_hours: number;
  night_diff_hours: number;
  legal_holiday_hours: number;
  special_holiday_hours: number;
  rest_day_hours: number;
  pto_hours: number;
  daily_rate_payroll: number | null;
};

type RegisterLine = RegisterPayslipLine;

function organicPayslipHref(
  cutoffId: string,
  line: { id?: string; office_employee_id?: string | null }
): string | null {
  if (!cutoffId) return null;
  const params = new URLSearchParams();
  if (line.id) params.set("line", line.id);
  else if (line.office_employee_id) {
    params.set("employee", line.office_employee_id);
  } else {
    return null;
  }
  return `/payroll/${cutoffId}/payslip?${params}`;
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
const REGISTER_PAGE = 25;

type RegisterPayFilter = "all" | "deductions" | "zero_deductions" | "loans";

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

function scrollToSection(sectionId: string) {
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
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";
  const { role } = useUserRole();
  const [orgId, setOrgId] = useState("");
  const [period, setPeriod] = useState<Period | null>(null);
  const [remittanceFiles, setRemittanceFiles] =
    useState<RemittanceFiles | null>(null);
  const [summary, setSummary] = useState<{
    hours_rows: number;
    punch_rows: number;
    missing_rate: number;
    zero_hours: number;
    missing_statutory?: number;
    blocked_statutory?: Array<{
      directory_employee_id: string;
      client_id: string | null;
      last_name: string | null;
      first_name: string | null;
      missing: string[];
    }>;
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
    summary_breakdown: CutoffSummaryBreakdown | null;
  } | null>(null);
  const [registerOffset, setRegisterOffset] = useState(0);
  const [registerQ, setRegisterQ] = useState("");
  const [registerQApplied, setRegisterQApplied] = useState("");
  const [registerPayFilter, setRegisterPayFilter] =
    useState<RegisterPayFilter>("all");
  const [confirmAction, setConfirmAction] = useState<
    null | "approve" | "post" | "build_with_flags" | "delete"
  >(null);
  const [spotCheckedPayslip, setSpotCheckedPayslip] = useState(false);
  const [reviewedSummary, setReviewedSummary] = useState(false);
  const [payslipLine, setPayslipLine] = useState<RegisterLine | null>(null);
  const [payslipPdfBusy, setPayslipPdfBusy] = useState(false);
  const [hubTab, setHubTab] = useState<CutoffHubTab>("hours");
  const hubTabRef = useRef<CutoffHubTab>("hours");
  const pendingJump = useRef<string | null>(null);
  hubTabRef.current = hubTab;

  function jumpToSection(sectionId: string) {
    const nextTab = cutoffHubTabForSection(sectionId);
    if (nextTab && nextTab !== hubTabRef.current) {
      pendingJump.current = sectionId;
      setHubTab(nextTab);
      return;
    }
    scrollToSection(sectionId);
  }

  useEffect(() => {
    const sectionId = pendingJump.current;
    if (!sectionId) return;
    pendingJump.current = null;
    const t = window.setTimeout(() => scrollToSection(sectionId), 50);
    return () => window.clearTimeout(t);
  }, [hubTab]);

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
            missing_statutory?: number;
            blocked_statutory?: Array<{
              directory_employee_id: string;
              client_id: string | null;
              last_name: string | null;
              first_name: string | null;
              missing: string[];
            }>;
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
            summary_breakdown: CutoffSummaryBreakdown | null;
          } | null;
        }>(
          `/api/timekeeping/cutoff-periods/${id}/payroll-run?${new URLSearchParams(
            {
              limit: String(REGISTER_PAGE),
              offset: String(registerOffset),
              pay_filter: registerPayFilter,
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
                summary_breakdown: reg.data.summary_breakdown ?? null,
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
  }, [
    hoursIssue,
    hoursOffset,
    id,
    qApplied,
    registerOffset,
    registerPayFilter,
    registerQApplied,
  ]);

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

  async function ingestFromGpClient() {
    const org = orgId || (await ensureDirectoryOrgId());
    const json = await directoryJson<{
      data: {
        hours_upserted: number;
        skipped?: Array<{ full_name: string }>;
      };
    }>(`/api/timekeeping/cutoff-periods/${id}/ingest-from-gp-client`, org, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const r = json.data;
    if (r.hours_upserted === 0) {
      const skipped = r.skipped?.length ?? 0;
      throw new Error(
        skipped
          ? `No hours ingested (${skipped} GP-Client people skipped — they need a Directory link)`
          : "No hours ingested. Validate the GP-Client timesheet for this site and dates first."
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
    const json = await directoryJson<{
      data: {
        line_count: number;
        blocked_statutory?: Array<{
          last_name: string | null;
          first_name: string | null;
          missing: string[];
        }>;
      };
    }>(`/api/timekeeping/cutoff-periods/${id}/payroll-run`, orgId, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const blocked = json.data.blocked_statutory ?? [];
    if (blocked.length) {
      const sample = blocked
        .slice(0, 3)
        .map((row) =>
          `${[row.last_name, row.first_name].filter(Boolean).join(", ") || "Unnamed"} (${row.missing.join(", ")})`
        )
        .join("; ");
      toast.warning(
        `${blocked.length} people skipped — missing statutory IDs. ${sample}`
      );
    }
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

  async function deleteCutoff() {
    await directoryJson(`/api/timekeeping/cutoff-periods/${id}`, orgId, {
      method: "DELETE",
    });
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
          note: "Admin hours audit",
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

  function downloadFundingMemo() {
    const params = new URLSearchParams({
      type: "funding-memo",
      format: "json",
    });
    void (async () => {
      try {
        const json = await directoryJson<{
          data: { xlsx_base64: string; filename: string; mime?: string };
        }>(
          `/api/timekeeping/cutoff-periods/${id}/exports?${params}`,
          orgId
        );
        downloadBase64File(
          json.data.xlsx_base64,
          json.data.filename,
          json.data.mime ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        toast.success(`Downloaded ${json.data.filename}`);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Funding memo export failed"
        );
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

  function openPayslipModal(line: RegisterLine) {
    setPayslipLine(line);
    setSpotCheckedPayslip(true);
  }

  async function downloadPayslipPdf() {
    if (!payslipLine?.id) {
      toast.error("This register line has no id for PDF export");
      return;
    }
    setPayslipPdfBusy(true);
    try {
      const params = new URLSearchParams({
        type: "payslip-pdf",
        format: "json",
        line_id: payslipLine.id,
      });
      const json = await directoryJson<{
        data: { pdf_base64: string; filename: string };
      }>(`/api/timekeeping/cutoff-periods/${id}/exports?${params}`, orgId);
      downloadBase64File(
        json.data.pdf_base64,
        json.data.filename,
        "application/pdf"
      );
      toast.success(`Downloaded ${json.data.filename}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Payslip PDF download failed"
      );
    } finally {
      setPayslipPdfBusy(false);
    }
  }

  const hoursUnlocked = cutoffHoursWindowOpen(period?.status);
  const canEditHours = canActorEditCutoffHours({
    periodStatus: period?.status,
    role,
  });
  const skipOfficeAggregate = !usesOfficeClockAggregate(period?.source_app);
  const canAggregate = hoursUnlocked && !skipOfficeAggregate;
  const canIngest = canIngestFromGpClient(period?.source_app, period?.status);
  const canPost =
    period?.status === "approved" && register?.run?.status === "draft";
  const canDelete = canDeleteCutoffPeriod(period?.status);
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
        skipOfficeAggregate,
      }),
    [
      hasRegister,
      period?.status,
      register?.run?.status,
      skipOfficeAggregate,
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
        skipOfficeAggregate,
      }),
    [
      hasRegister,
      period?.status,
      register?.run?.status,
      skipOfficeAggregate,
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
        skipOfficeAggregate,
        missingStatutory: summary?.missing_statutory,
      }),
    [
      hasRegister,
      period?.status,
      register?.count,
      register?.run?.status,
      skipOfficeAggregate,
      summary?.hours_rows,
      summary?.missing_rate,
      summary?.missing_statutory,
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
      case "ingest":
        void runAction(
          "Ingested GP-Client hours",
          ingestFromGpClient,
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
    } else if (action === "delete") {
      setBusy("Deleting cutoff");
      try {
        await deleteCutoff();
        toast.success("Cutoff deleted");
        router.push("/payroll");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Delete failed");
        setBusy(null);
      }
    }
  }

  const firstRegisterLine = register?.lines[0];

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={<HubBackLink href="/payroll" label="Payroll" />}
          title={
            period?.period_kind === "adjustment"
              ? "Payroll adjustment"
              : "Payroll cutoff"
          }
          description={
            period
              ? `${period.period_start}–${period.period_end} · ${statusLabel(period.status)}${
                  period.period_kind === "adjustment" ? " · Adjustment" : ""
                }${period.run_by ? ` · Run by ${period.run_by}` : ""}`
              : skipOfficeAggregate
                ? "Deployed cutoff: hours from GP-Client ingest, then register and downloads"
                : "Organic cutoff payroll: hours, rates, register, and downloads"
          }
          actions={
            canDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10"
                disabled={!!busy}
                onClick={() => setConfirmAction("delete")}
              >
                Delete cutoff
              </Button>
            ) : null
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
            <CardSection title="Workflow" className="shadow-card">
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

            {(summary?.blocked_statutory?.length ?? 0) > 0 ? (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 p-4 text-sm text-foreground">
                <p className="font-medium">
                  {summary?.missing_statutory}{" "}
                  {(summary?.missing_statutory ?? 0) === 1
                    ? "person"
                    : "people"}{" "}
                  missing SSS, TIN, PhilHealth, or Pag-IBIG — those lines will
                  not be built.
                </p>
                <ul className="mt-2 space-y-1">
                  {(summary?.blocked_statutory ?? []).map((row) => {
                    const name =
                      [row.last_name, row.first_name]
                        .filter(Boolean)
                        .join(", ") || "Unnamed";
                    const href = row.client_id
                      ? `/people/c/${row.client_id}/${row.directory_employee_id}/onboard`
                      : `/people?queue=missing_statutory`;
                    return (
                      <li key={row.directory_employee_id}>
                        <Link
                          href={href}
                          className="font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {name}
                        </Link>
                        <span className="text-muted-foreground">
                          {" "}
                          · {row.missing.join(", ")}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2">
                  <Link
                    href="/people?queue=missing_statutory"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    Open Missing IDs queue
                  </Link>
                </p>
              </div>
            ) : null}

            <CutoffSummaryBreakdownPanel
              statusLabel={statusLabel(period?.status ?? "")}
              breakdown={
                hasRegister ? (register?.summary_breakdown ?? null) : null
              }
            />

            <Tabs
              value={hubTab}
              onValueChange={(value) => setHubTab(value as CutoffHubTab)}
              className="min-w-0"
            >
              <TabsList
                className={cn(dbMobileTabList, "mb-3 bg-muted/50")}
                aria-label="Cutoff sections"
              >
                <TabsTrigger value="hours" className={dbMobileTabTrigger}>
                  Hours
                </TabsTrigger>
                <TabsTrigger value="register" className={dbMobileTabTrigger}>
                  Register
                </TabsTrigger>
                <TabsTrigger value="downloads" className={dbMobileTabTrigger}>
                  Downloads
                </TabsTrigger>
                <TabsTrigger value="billing" className={dbMobileTabTrigger}>
                  Billing
                </TabsTrigger>
              </TabsList>

              <TabsContent value="hours" className="mt-0 space-y-4">
            {(summary?.hours_rows ?? 0) > 0 && hoursUnlocked ? (
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
              {!hoursUnlocked ? (
                <span id="cutoff-readiness" className="sr-only">
                  Hours locked — readiness filters unavailable
                </span>
              ) : null}
              <CardSection title="Cutoff hours">
                <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                  {period?.period_kind === "adjustment"
                    ? "Adjustment run: ingest a Validated GP-Client timesheet (reopen for Adjustment if you added people or hours), then review rates here."
                    : skipOfficeAggregate
                      ? "Reg is regular hours from the GP-Client Validated timesheet. After ingest, review rates and hour buckets here."
                      : "Reg is regular hours: the 104h monthly cap (13 days × 8h) minus absences. A scheduled workday with no complete time entry counts as an absence. Re-aggregate after timesheet changes."}
                  {hoursUnlocked && !canEditHours && isHRFamilyRole(role)
                    ? " Hour values are locked for HR — only an admin can correct buckets during audit."
                    : null}
                </Caption>
                <HStack gap="2" className="mb-3 flex-wrap">
                  {canAggregate ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
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
                  {canIngest ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!!busy}
                      onClick={() =>
                        void runAction(
                          "Ingested GP-Client hours",
                          ingestFromGpClient,
                          "Review flagged rates and hour buckets next"
                        ).then(() => jumpToSection("cutoff-readiness"))
                      }
                    >
                      {busy === "Ingested GP-Client hours"
                        ? "Ingesting…"
                        : (summary?.hours_rows ?? 0) > 0
                          ? "Re-ingest"
                          : "Ingest hours"}
                    </Button>
                  ) : null}
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
                    placeholder="Search name, employee ID, or outlet"
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
                        <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Employee ID
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Employee
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Outlet
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Reg
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          OT
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          ND
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          LH
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          SH
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          RD
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          PTO
                        </TableHead>
                        <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Daily rate
                        </TableHead>
                        <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Status
                        </TableHead>
                        {canEditHours ? (
                          <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <span className="sr-only">Actions</span>
                          </TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {hours.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={canEditHours ? 13 : 12}
                            className="py-8 text-center text-muted-foreground"
                          >
                            {qApplied || hoursIssue
                              ? "No hour rows match this search or filter."
                              : skipOfficeAggregate
                                ? "No hours on file yet. Ingest from GP-Client after the timesheet is Validated."
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
                              <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                                {row.employee_code ?? "—"}
                              </TableCell>
                              <TableCell className="min-w-[10rem] text-sm text-foreground">
                                {[row.last_name, row.first_name]
                                  .filter(Boolean)
                                  .join(", ") || "—"}
                              </TableCell>
                              <TableCell className="min-w-[8rem] text-sm text-muted-foreground">
                                {row.outlet?.trim() || "—"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {editId === row.id ? (
                                  <Input
                                    className="ml-auto h-8 w-20"
                                    value={editReg}
                                    onChange={(e) => setEditReg(e.target.value)}
                                  />
                                ) : (
                                  formatNumber(Number(row.actual_regular_hours ?? 0), 2)
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {editId === row.id ? (
                                  <Input
                                    className="ml-auto h-8 w-20"
                                    value={editOt}
                                    onChange={(e) => setEditOt(e.target.value)}
                                  />
                                ) : (
                                  formatNumber(Number(row.overtime_hours ?? 0), 2)
                                )}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatNumber(Number(row.night_diff_hours ?? 0), 2)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatNumber(Number(row.legal_holiday_hours ?? 0), 2)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatNumber(Number(row.special_holiday_hours ?? 0), 2)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatNumber(Number(row.rest_day_hours ?? 0), 2)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-sm">
                                {formatNumber(Number(row.pto_hours ?? 0), 2)}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right text-sm tabular-nums",
                                  flags.missingRate && "font-semibold text-amber-800"
                                )}
                              >
                                {row.daily_rate_payroll != null &&
                                Number(row.daily_rate_payroll) > 0
                                  ? formatCurrency(Number(row.daily_rate_payroll))
                                  : "—"}
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

            {period && orgId && period.status === "posted" ? (
              <PayrollAdjustmentPanel
                cutoffId={id}
                orgId={orgId}
                periodStatus={period.status}
                periodKind={period.period_kind}
                periodLabel={`${period.period_start}–${period.period_end}`}
              />
            ) : null}
              </TabsContent>

              <TabsContent value="register" className="mt-0 space-y-4">
            {hasRegister && canPost ? (
              <div id="pre-post-review" className="scroll-mt-24">
                <CardSection title="Pre-post review">
                  <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
                    Verify totals and open at least one payslip from the
                    Register tab before posting. Posting finalizes loans for
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
                        {firstRegisterLine ? (
                          <Button
                            type="button"
                            variant="link"
                            size="sm"
                            className="h-auto px-1"
                            onClick={() => openPayslipModal(firstRegisterLine)}
                          >
                            Open sample payslip
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
                <div id="payroll-register" className="scroll-mt-24">
                  <CardSection title="Payroll register">
                    <Caption className="mb-3 text-pretty text-muted-foreground">
                      One row per employee on this cutoff. Amounts are in
                      Philippine pesos.
                    </Caption>
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <label
                          htmlFor="register-search"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Search
                        </label>
                        <Input
                          id="register-search"
                          className="h-10 max-w-md text-base sm:h-9 sm:text-sm"
                          value={registerQ}
                          onChange={(e) => setRegisterQ(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setRegisterOffset(0);
                              setRegisterQApplied(registerQ);
                            }
                          }}
                          placeholder="e.g. Alberto or 202401-00001"
                          aria-label="Search register by name or employee ID"
                          disabled={!!busy || loading}
                        />
                      </div>
                      <div className="flex w-full flex-col gap-1 sm:w-48">
                        <label
                          htmlFor="register-pay-filter"
                          className="text-xs font-medium text-muted-foreground"
                        >
                          Deduction filter
                        </label>
                        <select
                          id="register-pay-filter"
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-base sm:h-9 sm:text-sm"
                          value={registerPayFilter}
                          disabled={!!busy || loading}
                          onChange={(e) => {
                            setRegisterOffset(0);
                            setRegisterPayFilter(
                              e.target.value as RegisterPayFilter
                            );
                          }}
                        >
                          <option value="all">All employees</option>
                          <option value="deductions">With deductions</option>
                          <option value="zero_deductions">
                            No deductions
                          </option>
                          <option value="loans">With loans</option>
                        </select>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="min-h-10 sm:min-h-9"
                        disabled={!!busy || loading}
                        onClick={() => {
                          setRegisterOffset(0);
                          setRegisterQApplied(registerQ);
                        }}
                      >
                        Apply search
                      </Button>
                    </div>
                    <div className={dbTableShell}>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Employee ID
                            </TableHead>
                            <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Employee
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Gross pay
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Deductions
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Net pay
                            </TableHead>
                            <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <span className="sr-only">Actions</span>
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(register?.lines.length ?? 0) === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={6}
                                className="px-4 py-10 text-center"
                              >
                                <p className="text-sm font-medium text-foreground">
                                  {registerQApplied ||
                                  registerPayFilter !== "all"
                                    ? "No employees match these filters"
                                    : "No employees on this register yet"}
                                </p>
                                <p className="mt-1 text-sm leading-normal text-muted-foreground text-pretty">
                                  {registerQApplied ||
                                  registerPayFilter !== "all"
                                    ? "Clear the search or choose All employees to widen results."
                                    : "Build the register from approved hours to populate this table."}
                                </p>
                              </TableCell>
                            </TableRow>
                          ) : (
                            register?.lines.map((line, i) => (
                              <TableRow
                                key={line.id ?? `${line.employee_code}-${i}`}
                              >
                                <TableCell className="font-mono text-xs tabular-nums text-muted-foreground">
                                  {line.employee_code ?? "—"}
                                </TableCell>
                                <TableCell className="min-w-[10rem] text-sm text-foreground">
                                  {[line.last_name, line.first_name]
                                    .filter(Boolean)
                                    .join(", ") || "—"}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums">
                                  {formatCurrency(Number(line.gross_pay))}
                                </TableCell>
                                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                                  {formatCurrency(
                                    Number(line.total_deductions)
                                  )}
                                </TableCell>
                                <TableCell className="text-right text-sm font-medium tabular-nums">
                                  {formatCurrency(Number(line.net_pay))}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openPayslipModal(line)}
                                  >
                                    View payslip
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <HStack
                      gap="2"
                      className="flex-wrap items-center justify-between pt-3"
                    >
                      <Caption className="tabular-nums text-muted-foreground">
                        {(register?.count ?? 0) === 0
                          ? "Showing 0 of 0"
                          : `Showing ${registerShowingFrom}–${registerShowingTo} of ${register?.count ?? 0}`}
                      </Caption>
                      <HStack gap="2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={
                            registerOffset === 0 || !!busy || loading
                          }
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
                              (register?.count ?? 0) ||
                            !!busy ||
                            loading ||
                            (register?.count ?? 0) === 0
                          }
                          onClick={() =>
                            setRegisterOffset(registerOffset + REGISTER_PAGE)
                          }
                        >
                          Next
                        </Button>
                      </HStack>
                    </HStack>
                  </CardSection>
                </div>
            ) : (
              <div id="payroll-register" className="scroll-mt-24">
                <CardSection title="Payroll register">
                  <Caption className="text-muted-foreground">
                    Build the register from approved hours to see payslips here.
                  </Caption>
                </CardSection>
              </div>
            )}
              </TabsContent>

              <TabsContent value="downloads" className="mt-0 space-y-4">
                {hasRegister ? (
                  <div id="cutoff-downloads" className="scroll-mt-24 space-y-4">
                    <CardSection title="Downloads">
                      <Caption className="mb-4 block max-w-[65ch] text-pretty text-muted-foreground">
                        Printable PDFs for review, plus CSV files for remittance
                        and bank upload. Open a single payslip from the Register
                        tab.
                      </Caption>
                      <div className="grid gap-4 lg:grid-cols-3">
                        <div className="rounded-md border border-border bg-card p-4 shadow-card">
                          <BodySmall className="font-semibold text-foreground">
                            Payslips and summary
                          </BodySmall>
                          <Caption className="mt-1 mb-3 block text-muted-foreground">
                            Landscape payroll summary and individual payslips.
                          </Caption>
                          <div className="flex flex-col gap-2">
                            <Button
                              type="button"
                              size="sm"
                              className="justify-start"
                              onClick={() => downloadPdfExport("summary-pdf")}
                              disabled={!!busy}
                            >
                              Payroll summary PDF
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="justify-start"
                              onClick={() => void downloadAllPayslipPdfs()}
                              disabled={!!busy}
                            >
                              All payslip PDFs (ZIP)
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="justify-start"
                              onClick={() => downloadExport("register_detail")}
                              disabled={!!busy}
                            >
                              Register detail CSV
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="justify-start"
                              onClick={() => downloadExport("payslips")}
                              disabled={!!busy}
                            >
                              Payslip roster CSV
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-md border border-border bg-card p-4 shadow-card">
                          <BodySmall className="font-semibold text-foreground">
                            This cutoff
                          </BodySmall>
                          <Caption className="mt-1 mb-3 block text-muted-foreground">
                            Tax, ATM bank, and other deductions for this kinsena.
                          </Caption>
                          <div className="flex flex-col gap-2">
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
                                  className="justify-start"
                                  onClick={() => downloadExport(type)}
                                  disabled={!!busy}
                                >
                                  {label}
                                </Button>
                              ))}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="justify-start"
                              onClick={() => void downloadFundingMemo()}
                              disabled={!!busy}
                            >
                              Funding memo (XLSX)
                            </Button>
                          </div>
                        </div>
                        <div className="rounded-md border border-border bg-card p-4 shadow-card">
                          <BodySmall className="font-semibold text-foreground">
                            Monthly remittance
                          </BodySmall>
                          <Caption className="mt-1 mb-3 block text-muted-foreground">
                            SSS, PhilHealth, and Pag-IBIG — usually on the
                            second kinsena.
                          </Caption>
                          {remittanceFiles?.sss === false ? (
                            <Caption className="mb-3 block rounded-md bg-muted/40 px-2 py-1.5 text-muted-foreground">
                              Held until the 16–end window for monthly
                              statutory.
                            </Caption>
                          ) : null}
                          <div className="flex flex-col gap-2">
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
                                className="justify-start"
                                onClick={() => downloadExport(type)}
                                disabled={
                                  !!busy || remittanceFiles?.[type] === false
                                }
                              >
                                {label}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardSection>
                  </div>
                ) : (
                  <div id="cutoff-downloads" className="scroll-mt-24">
                    <CardSection title="Downloads">
                      <Caption className="text-muted-foreground">
                        Build the register first. Payslip PDFs and remittance
                        files appear here after that.
                      </Caption>
                    </CardSection>
                  </div>
                )}

              </TabsContent>

              <TabsContent value="billing" className="mt-0 space-y-4">
                {period && orgId && period.status === "posted" ? (
                  <CutoffBillingPanel
                    cutoffId={id}
                    orgId={orgId}
                    periodStatus={period.status}
                  />
                ) : (
                  <CardSection title="Client billing">
                    <Caption className="max-w-[65ch] text-muted-foreground">
                      Post payroll first. Billing (SOA / debit memo) is available
                      after this cutoff is posted.
                    </Caption>
                  </CardSection>
                )}
              </TabsContent>
            </Tabs>
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
                  : confirmAction === "delete"
                    ? "Delete this cutoff?"
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
                {confirmAction === "delete" ? (
                  <p>
                    This removes the cutoff and any ingested hours. You can
                    create a new cutoff for the same dates. Posted payroll
                    cannot be deleted.
                  </p>
                ) : null}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirmAction === "delete"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : undefined
              }
              onClick={() => void confirmPendingAction()}
            >
              {confirmAction === "approve"
                ? "Approve"
                : confirmAction === "build_with_flags"
                  ? "Build anyway"
                  : confirmAction === "delete"
                    ? "Delete cutoff"
                    : "Post payroll"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <RegisterPayslipDialog
        open={!!payslipLine}
        onOpenChange={(open) => {
          if (!open) setPayslipLine(null);
        }}
        line={payslipLine}
        periodStart={period?.period_start ?? ""}
        periodEnd={period?.period_end ?? ""}
        fullPayslipHref={
          payslipLine ? organicPayslipHref(id, payslipLine) : null
        }
        onDownloadPdf={() => void downloadPayslipPdf()}
        downloadingPdf={payslipPdfBusy}
      />
    </DashboardLayout>
  );
}
