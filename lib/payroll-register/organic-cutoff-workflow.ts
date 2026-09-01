/**
 * Step state for Organic / cutoff payroll hub
 * (Aggregate → Audit → Approve → Build → Post → Downloads).
 */

export type OrganicCutoffStepId =
  | "aggregate"
  | "audit"
  | "approve"
  | "build"
  | "post"
  | "downloads";

export type OrganicCutoffStepStatus =
  | "complete"
  | "current"
  | "upcoming"
  | "attention";

export type OrganicCutoffStep = {
  id: OrganicCutoffStepId;
  number: number;
  title: string;
  description: string;
  status: OrganicCutoffStepStatus;
  /** In-page section anchor for guided navigation */
  sectionId: string;
};

export type OrganicCutoffReadiness = {
  hours_rows: number;
  missing_rate: number;
  zero_hours: number;
};

export type OrganicCutoffPrimaryActionId =
  | "aggregate"
  | "review_hours"
  | "submit_audit"
  | "approve"
  | "build"
  | "review_register"
  | "post"
  | "downloads"
  | "done";

export type OrganicCutoffPrimaryAction = {
  id: OrganicCutoffPrimaryActionId;
  label: string;
  description: string;
  sectionId: string;
  /** When true, the CTA runs a mutating action; otherwise it scrolls/focuses. */
  mutates: boolean;
  /** Soft-block: show confirm when readiness issues remain. */
  requiresConfirm?: boolean;
  blockedByReadiness?: boolean;
};

export type OrganicAuditCheck = {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "warn" | "pending";
  sectionId?: string;
};

const STEP_DEFS: Array<
  Omit<OrganicCutoffStep, "status"> & { status?: OrganicCutoffStepStatus }
> = [
  {
    id: "aggregate",
    number: 1,
    title: "Aggregate",
    description: "Pull attendance into cutoff hours",
    sectionId: "cutoff-hours",
  },
  {
    id: "audit",
    number: 2,
    title: "Audit hours",
    description: "Review rates and hour buckets",
    sectionId: "cutoff-readiness",
  },
  {
    id: "approve",
    number: 3,
    title: "Approve",
    description: "Lock hours for payroll",
    sectionId: "cutoff-guide",
  },
  {
    id: "build",
    number: 4,
    title: "Build register",
    description: "Hours × rates to gross and deductions",
    sectionId: "payroll-register",
  },
  {
    id: "post",
    number: 5,
    title: "Post",
    description: "Post loans and finalize cutoff",
    sectionId: "pre-post-review",
  },
  {
    id: "downloads",
    number: 6,
    title: "Downloads",
    description: "Payslips, summary, remittance, bank",
    sectionId: "cutoff-downloads",
  },
];

const ORDER: OrganicCutoffStepId[] = [
  "aggregate",
  "audit",
  "approve",
  "build",
  "post",
  "downloads",
];

export function hoursRowNeedsAttention(row: {
  daily_rate_payroll?: number | null;
  actual_regular_hours?: number | null;
  overtime_hours?: number | null;
  night_diff_hours?: number | null;
  legal_holiday_hours?: number | null;
  special_holiday_hours?: number | null;
  rest_day_hours?: number | null;
  pto_hours?: number | null;
}): { missingRate: boolean; zeroHours: boolean } {
  const rate = Number(row.daily_rate_payroll ?? 0);
  const hoursSum =
    Number(row.actual_regular_hours ?? 0) +
    Number(row.overtime_hours ?? 0) +
    Number(row.night_diff_hours ?? 0) +
    Number(row.legal_holiday_hours ?? 0) +
    Number(row.special_holiday_hours ?? 0) +
    Number(row.rest_day_hours ?? 0) +
    Number(row.pto_hours ?? 0);
  return {
    missingRate: !(rate > 0),
    zeroHours: !(hoursSum > 0),
  };
}

export function deriveOrganicCutoffSteps(input: {
  periodStatus: string | null | undefined;
  hoursRows: number;
  hasRegister: boolean;
  registerStatus: string | null | undefined;
  missingRate?: number;
  zeroHours?: number;
}): OrganicCutoffStep[] {
  const status = input.periodStatus ?? "draft";
  const hasHours = input.hoursRows > 0;
  const registerPosted = input.registerStatus === "posted";
  const periodPosted = status === "posted" || registerPosted;
  const readinessIssues =
    (input.missingRate ?? 0) > 0 || (input.zeroHours ?? 0) > 0;

  let current: OrganicCutoffStepId = "aggregate";
  if (!hasHours && (status === "draft" || status === "pending_audit")) {
    current = "aggregate";
  } else if (status === "draft") {
    current = "audit";
  } else if (status === "pending_audit") {
    current = readinessIssues ? "audit" : "approve";
  } else if (
    (status === "approved" || status === "posted") &&
    !input.hasRegister
  ) {
    current = "build";
  } else if (status === "approved" && input.registerStatus === "draft") {
    current = "post";
  } else if (periodPosted || input.hasRegister) {
    current = "downloads";
  }

  const currentIdx = ORDER.indexOf(current);

  return STEP_DEFS.map((step, index) => {
    let stepStatus: OrganicCutoffStepStatus = "upcoming";
    if (index < currentIdx) stepStatus = "complete";
    else if (index === currentIdx) {
      stepStatus =
        step.id === "aggregate" && !hasHours && status === "draft"
          ? "attention"
          : step.id === "audit" && readinessIssues
            ? "attention"
            : "current";
    }
    if (
      step.id === "audit" &&
      readinessIssues &&
      (status === "draft" || status === "pending_audit") &&
      hasHours
    ) {
      stepStatus = "attention";
    }
    if (periodPosted && step.id !== "downloads") stepStatus = "complete";
    if (periodPosted && step.id === "downloads") stepStatus = "current";
    return { ...step, status: stepStatus };
  });
}

export function deriveOrganicCutoffPrimaryAction(input: {
  periodStatus: string | null | undefined;
  hoursRows: number;
  hasRegister: boolean;
  registerStatus: string | null | undefined;
  missingRate?: number;
  zeroHours?: number;
}): OrganicCutoffPrimaryAction {
  const status = input.periodStatus ?? "draft";
  const hasHours = input.hoursRows > 0;
  const readinessIssues =
    (input.missingRate ?? 0) > 0 || (input.zeroHours ?? 0) > 0;
  const registerPosted = input.registerStatus === "posted";
  const periodPosted = status === "posted" || registerPosted;

  if (!hasHours && (status === "draft" || status === "pending_audit")) {
    return {
      id: "aggregate",
      label: "Aggregate attendance",
      description:
        "Pull bundy clock entries into cutoff hours so you can audit rates and hour buckets.",
      sectionId: "cutoff-hours",
      mutates: true,
    };
  }

  if (status === "draft") {
    if (readinessIssues) {
      return {
        id: "review_hours",
        label: "Review flagged hours",
        description:
          "Fix missing daily rates and zero-hour rows before submitting for approval.",
        sectionId: "cutoff-readiness",
        mutates: false,
        blockedByReadiness: true,
      };
    }
    return {
      id: "submit_audit",
      label: "Submit for approval",
      description:
        "Hours look ready. Send this cutoff to pending audit so an approver can lock it.",
      sectionId: "cutoff-guide",
      mutates: true,
    };
  }

  if (status === "pending_audit") {
    if (readinessIssues) {
      return {
        id: "review_hours",
        label: "Clear audit flags",
        description:
          "Resolve missing rates and empty hour rows, then approve to lock hours for payroll.",
        sectionId: "cutoff-readiness",
        mutates: false,
        blockedByReadiness: true,
      };
    }
    return {
      id: "approve",
      label: "Approve and lock hours",
      description:
        "Confirm rates and hour buckets are correct. Approval locks edits before the register is built.",
      sectionId: "cutoff-guide",
      mutates: true,
      requiresConfirm: true,
    };
  }

  if ((status === "approved" || status === "posted") && !input.hasRegister) {
    return {
      id: "build",
      label: "Build payroll register",
      description:
        "Compute gross, statutory deductions, loans, and net pay from approved hours.",
      sectionId: "payroll-register",
      mutates: true,
      blockedByReadiness: readinessIssues,
      requiresConfirm: readinessIssues,
    };
  }

  if (status === "approved" && input.registerStatus === "draft") {
    return {
      id: "post",
      label: "Post payroll",
      description:
        "Verify register totals, spot-check payslips, then post loans and finalize this cutoff.",
      sectionId: "pre-post-review",
      mutates: true,
      requiresConfirm: true,
    };
  }

  if (periodPosted || input.hasRegister) {
    if (periodPosted) {
      return {
        id: "downloads",
        label: "Open downloads",
        description:
          "Export bulk payslip ZIP, payroll summary, remittance files, and bank upload. Open individual payslips from the Payslips tab.",
        sectionId: "cutoff-downloads",
        mutates: false,
      };
    }
    return {
      id: "review_register",
      label: "Review register before post",
      description:
        "Spot-check gross, deductions, and net. Open a sample payslip from the Payslips tab, then post when satisfied.",
      sectionId: "pre-post-review",
      mutates: false,
    };
  }

  return {
    id: "done",
    label: "Cutoff complete",
    description: "This cutoff is finished. Use downloads for remittance and bank files.",
    sectionId: "cutoff-downloads",
    mutates: false,
  };
}

export function buildOrganicAuditChecklist(input: {
  periodStatus: string | null | undefined;
  hoursRows: number;
  punchRows: number;
  missingRate: number;
  zeroHours: number;
  hasRegister: boolean;
  registerStatus: string | null | undefined;
  registerHeadcount?: number;
  registerGross?: number;
  registerNet?: number;
}): OrganicAuditCheck[] {
  const status = input.periodStatus ?? "draft";
  const hasHours = input.hoursRows > 0;
  const registerPosted = input.registerStatus === "posted";

  return [
    {
      id: "aggregated",
      label: "Attendance aggregated",
      detail: hasHours
        ? `${input.hoursRows} employee hour row(s) · ${input.punchRows} punch row(s)`
        : "No hours yet — run Aggregate",
      status: hasHours ? "pass" : "pending",
      sectionId: "cutoff-hours",
    },
    {
      id: "rates",
      label: "Daily rates present",
      detail: !hasHours
        ? "Available after aggregation"
        : input.missingRate > 0
          ? `${input.missingRate} row(s) missing a daily payroll rate`
          : "All hour rows have a daily rate",
      status: !hasHours
        ? "pending"
        : input.missingRate > 0
          ? "warn"
          : "pass",
      sectionId: "cutoff-readiness",
    },
    {
      id: "hours",
      label: "Hour buckets reviewed",
      detail: !hasHours
        ? "Available after aggregation"
        : input.zeroHours > 0
          ? `${input.zeroHours} row(s) with zero paid hours — confirm absences`
          : "No empty hour rows",
      status: !hasHours
        ? "pending"
        : input.zeroHours > 0
          ? "warn"
          : "pass",
      sectionId: "cutoff-readiness",
    },
    {
      id: "locked",
      label: "Hours approved and locked",
      detail:
        status === "approved" || status === "posted" || registerPosted
          ? "Hours are locked for payroll"
          : status === "pending_audit"
            ? "Awaiting approval"
            : "Still in draft — submit after audit",
      status:
        status === "approved" || status === "posted" || registerPosted
          ? "pass"
          : status === "pending_audit"
            ? "pending"
            : "pending",
      sectionId: "cutoff-guide",
    },
    {
      id: "register",
      label: "Register built and reviewed",
      detail: input.hasRegister
        ? `${input.registerHeadcount ?? 0} lines · gross ${formatPhp(input.registerGross)} · net ${formatPhp(input.registerNet)}`
        : "Build the register after approval to compute pay",
      status: input.hasRegister ? "pass" : "pending",
      sectionId: "payroll-register",
    },
    {
      id: "posted",
      label: "Payroll posted",
      detail:
        registerPosted || status === "posted"
          ? "Loans posted and cutoff finalized"
          : input.hasRegister
            ? "Spot-check payslips, then post"
            : "Available after register is built",
      status:
        registerPosted || status === "posted"
          ? "pass"
          : input.hasRegister
            ? "pending"
            : "pending",
      sectionId: "pre-post-review",
    },
  ];
}

function formatPhp(value: number | undefined): string {
  const n = Number(value ?? 0);
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function summarizeHoursReadiness(
  rows: Array<{
    daily_rate_payroll?: number | null;
    actual_regular_hours?: number | null;
    overtime_hours?: number | null;
    night_diff_hours?: number | null;
    legal_holiday_hours?: number | null;
    special_holiday_hours?: number | null;
    rest_day_hours?: number | null;
    pto_hours?: number | null;
  }>
): OrganicCutoffReadiness {
  let missing_rate = 0;
  let zero_hours = 0;
  for (const row of rows) {
    const flags = hoursRowNeedsAttention(row);
    if (flags.missingRate) missing_rate += 1;
    if (flags.zeroHours) zero_hours += 1;
  }
  return {
    hours_rows: rows.length,
    missing_rate,
    zero_hours,
  };
}
