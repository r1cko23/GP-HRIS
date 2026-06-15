/**
 * Payroll cutoff workflow — step state and primary action for Payroll Entry UI.
 */

import type { PayrollEntrySummary } from "@/lib/ph-payroll/payroll-entry-validation";

export type PayrollWorkflowStepId =
  | "timesheets"
  | "fix_blockers"
  | "generate"
  | "review_pay";

export type PayrollWorkflowStepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "attention";

export interface PayrollWorkflowStep {
  id: PayrollWorkflowStepId;
  number: number;
  title: string;
  shortTitle: string;
  description: string;
  status: PayrollWorkflowStepStatus;
  metric?: string;
  href?: string;
}

export type PayrollPrimaryActionId =
  | "finalize_timesheets"
  | "filter_blocked"
  | "generate_payslips"
  | "open_payslips"
  | "refresh"
  | "none";

export interface PayrollPrimaryAction {
  id: PayrollPrimaryActionId;
  label: string;
  description: string;
  disabled: boolean;
  disabledReason?: string;
  variant: "default" | "secondary" | "outline";
  icon: "CheckCircle" | "WarningCircle" | "RocketLaunch" | "Receipt" | "ArrowsClockwise";
  count?: number;
}

export interface PayrollWorkflowState {
  steps: PayrollWorkflowStep[];
  currentStepId: PayrollWorkflowStepId;
  primaryAction: PayrollPrimaryAction;
  draftPayslipCount: number;
  paidPayslipCount: number;
  allPayslipsPaid: boolean;
}

function needsTimesheetWork(data: PayrollEntrySummary): number {
  return data.timesheetsMissing + data.timesheetsDraft;
}

function draftPayslipCount(data: PayrollEntrySummary): number {
  return data.rows.filter(
    (r) => r.payslipId && r.payslipStatus !== "paid"
  ).length;
}

function paidPayslipCount(data: PayrollEntrySummary): number {
  return data.rows.filter((r) => r.payslipStatus === "paid").length;
}

export function derivePayrollWorkflow(
  data: PayrollEntrySummary,
  options?: { canCreate?: boolean }
): PayrollWorkflowState {
  const canCreate = options?.canCreate ?? true;
  const needsTs = needsTimesheetWork(data);
  const generatable = data.ready + data.warning;
  const drafts = draftPayslipCount(data);
  const paid = paidPayslipCount(data);
  const allFinalized = needsTs === 0;
  const noBlockers = data.blocked === 0;
  const allPaid = paid === data.total && data.total > 0;

  const timesheetsComplete = allFinalized;
  const fixComplete = noBlockers;
  const generateDone =
    generatable === 0 &&
    (data.saved > 0 || allFinalized) &&
    data.blocked === 0;

  let currentStepId: PayrollWorkflowStepId = "timesheets";
  if (timesheetsComplete && !fixComplete) currentStepId = "fix_blockers";
  else if (timesheetsComplete && fixComplete && generatable > 0)
    currentStepId = "generate";
  else if (
    timesheetsComplete &&
    fixComplete &&
    generatable === 0 &&
    drafts > 0
  )
    currentStepId = "review_pay";
  else if (timesheetsComplete && fixComplete && generatable === 0 && allPaid)
    currentStepId = "review_pay";
  else if (timesheetsComplete && fixComplete && generatable === 0)
    currentStepId = "review_pay";

  function stepStatus(
    id: PayrollWorkflowStepId
  ): PayrollWorkflowStepStatus {
    const order: PayrollWorkflowStepId[] = [
      "timesheets",
      "fix_blockers",
      "generate",
      "review_pay",
    ];
    const currentIdx = order.indexOf(currentStepId);
    const idx = order.indexOf(id);

    if (id === "timesheets") {
      if (timesheetsComplete) return "complete";
      if (currentStepId === "timesheets") return "current";
      return "upcoming";
    }
    if (id === "fix_blockers") {
      if (fixComplete) return "complete";
      if (data.blocked > 0 && currentStepId === "fix_blockers")
        return "attention";
      if (currentStepId === "fix_blockers") return "current";
      return idx < currentIdx ? "complete" : "upcoming";
    }
    if (id === "generate") {
      if (generateDone || (generatable === 0 && drafts + paid > 0))
        return "complete";
      if (currentStepId === "generate") return "current";
      return idx < currentIdx ? "complete" : "upcoming";
    }
    if (id === "review_pay") {
      if (allPaid) return "complete";
      if (currentStepId === "review_pay") return "current";
      return "upcoming";
    }
    return "upcoming";
  }

  const steps: PayrollWorkflowStep[] = [
    {
      id: "timesheets",
      number: 1,
      title: "Lock timesheets",
      shortTitle: "Timesheets",
      description:
        "Build and finalize Time Attendance from clock logs for this cutoff.",
      status: stepStatus("timesheets"),
      metric:
        needsTs > 0
          ? `${needsTs} need finalizing`
          : `${data.timesheetsFinalized}/${data.total} finalized`,
      href: "/timesheet",
    },
    {
      id: "fix_blockers",
      number: 2,
      title: "Fix blockers",
      shortTitle: "Fix issues",
      description:
        "Resolve missing rates, unfinalized timesheets, or missing clock data.",
      status: stepStatus("fix_blockers"),
      metric:
        data.blocked > 0
          ? `${data.blocked} blocked`
          : data.warning > 0
            ? `${data.warning} to review`
            : "All clear",
    },
    {
      id: "generate",
      number: 3,
      title: "Generate payslips",
      shortTitle: "Generate",
      description:
        "Create draft payslips in bulk for ready and review employees.",
      status: stepStatus("generate"),
      metric:
        generatable > 0
          ? `${generatable} ready to generate`
          : `${data.saved} saved`,
    },
    {
      id: "review_pay",
      number: 4,
      title: "Review & mark paid",
      shortTitle: "Review & pay",
      description:
        "Open each draft in Payslip Details, adjust if needed, then mark as paid.",
      status: stepStatus("review_pay"),
      metric:
        drafts > 0
          ? `${drafts} draft · ${paid} paid`
          : paid > 0
            ? `${paid}/${data.total} paid`
            : "No drafts yet",
      href: "/payslips",
    },
  ];

  let primaryAction: PayrollPrimaryAction;

  if (!canCreate) {
    primaryAction = {
      id: "none",
      label: "View only",
      description: "You can review this cutoff but cannot run payroll actions.",
      disabled: true,
      variant: "outline",
      icon: "ArrowsClockwise",
    };
  } else if (!timesheetsComplete) {
    primaryAction = {
      id: "finalize_timesheets",
      label: `Step 1 — Finalize ${needsTs} timesheet${needsTs === 1 ? "" : "s"}`,
      description:
        "Locks attendance for the cutoff so payslips can be calculated.",
      disabled: false,
      variant: "default",
      icon: "CheckCircle",
      count: needsTs,
    };
  } else if (!noBlockers) {
    primaryAction = {
      id: "filter_blocked",
      label: `Step 2 — Fix ${data.blocked} blocked employee${data.blocked === 1 ? "" : "s"}`,
      description:
        "Use the actions column to open timesheets, time entries, or employee records.",
      disabled: false,
      variant: "default",
      icon: "WarningCircle",
      count: data.blocked,
    };
  } else if (generatable > 0) {
    primaryAction = {
      id: "generate_payslips",
      label: `Step 3 — Generate ${generatable} payslip${generatable === 1 ? "" : "s"}`,
      description:
        "Creates draft payslips. Review warnings in the table before confirming.",
      disabled: false,
      variant: "default",
      icon: "RocketLaunch",
      count: generatable,
    };
  } else if (drafts > 0) {
    primaryAction = {
      id: "open_payslips",
      label: `Step 4 — Review ${drafts} draft payslip${drafts === 1 ? "" : "s"}`,
      description:
        "Open Payslip Details to edit amounts and mark each employee as paid when released.",
      disabled: false,
      variant: "default",
      icon: "Receipt",
      count: drafts,
    };
  } else if (allPaid) {
    primaryAction = {
      id: "refresh",
      label: "Payroll complete for this cutoff",
      description: "All payslips are marked paid. Switch period or refresh data.",
      disabled: false,
      variant: "outline",
      icon: "ArrowsClockwise",
    };
  } else {
    primaryAction = {
      id: "open_payslips",
      label: "Open Payslip Details",
      description: "View or create individual payslips for this period.",
      disabled: false,
      variant: "outline",
      icon: "Receipt",
    };
  }

  return {
    steps,
    currentStepId,
    primaryAction,
    draftPayslipCount: drafts,
    paidPayslipCount: paid,
    allPayslipsPaid: allPaid,
  };
}
