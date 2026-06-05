/**
 * Plain-language access profiles for Settings UI (role guide, previews, handoffs).
 * Technical enforcement still uses users.role + users.permissions + can_access_salary.
 */

import { formatRoleLabel } from "@/lib/format-role-label";
import { isHRFamilyRole, type DashboardUserRole } from "@/lib/roles";
import {
  getDefaultPermissionsForRole,
  type ModuleName,
  type UserPermissions,
} from "@/lib/hooks/usePermissions";

export type AccessLevel = "full" | "edit" | "read" | "approve" | "none";

export interface FriendlyAccessRow {
  id: string;
  area: string;
  description: string;
  level: AccessLevel;
  note?: string;
}

export interface RoleProfile {
  role: string;
  title: string;
  summary: string;
  bestFor: string;
  /** Shown when replacing someone who left */
  handoffTip: string;
  salaryAccessDefault: boolean | "always";
  rows: FriendlyAccessRow[];
}

const LEVEL_LABELS: Record<AccessLevel, string> = {
  full: "Full access",
  edit: "Can edit",
  read: "View only",
  approve: "Can approve",
  none: "No access",
};

export function getAccessLevelLabel(level: AccessLevel): string {
  return LEVEL_LABELS[level];
}

export function getAccessLevelVariant(
  level: AccessLevel
): "default" | "secondary" | "outline" | "destructive" {
  switch (level) {
    case "full":
      return "default";
    case "edit":
    case "approve":
      return "default";
    case "read":
      return "secondary";
    default:
      return "outline";
  }
}

/** Role templates for onboarding and the role guide (not per-user overrides). */
export const ROLE_PROFILES: RoleProfile[] = [
  {
    role: "admin",
    title: "Admin",
    summary: "Full control of the system, including audit, tax reports, and final payslip approval.",
    bestFor: "IT owner, company admin, or payroll lead with sign-off authority.",
    handoffTip:
      "Create a new admin account, verify audit/BIR access, then deactivate the old admin after a short overlap.",
    salaryAccessDefault: "always",
    rows: [
      { id: "dash", area: "Dashboards", description: "Executive and workforce views", level: "full" },
      { id: "emp", area: "Employees", description: "Directory and profiles", level: "full" },
      { id: "pay", area: "Payroll & payslips", description: "Generate, save, and approve payslips", level: "full" },
      { id: "time", area: "Time & attendance", description: "Timesheets, entries, approvals", level: "full" },
      { id: "leave_hr", area: "Leave (HR step)", description: "Final approval for all staff", level: "approve" },
      { id: "admin_mod", area: "Audit, BIR, payroll register", description: "Compliance and exports", level: "full" },
      { id: "team", area: "Team accounts", description: "Create and manage logins", level: "full" },
    ],
  },
  {
    role: "head_of_hr",
    title: "Head of HR",
    summary:
      "Runs day-to-day HR: employees, schedules, time data, and both approval steps for leave (assigned staff + company-wide final step).",
    bestFor: "HR director or primary HR contact.",
    handoffTip:
      "Use “Copy access from” the departing Head of HR, grant Pay info if they handled payroll, then reassign their groups on Groups & approvers.",
    salaryAccessDefault: false,
    rows: [
      { id: "dash", area: "Dashboard", description: "Workforce overview", level: "read" },
      { id: "emp", area: "Employees", description: "Add and edit (not delete)", level: "edit" },
      { id: "pay", area: "Payroll & payslips", description: "Needs Pay info turned on", level: "edit", note: "Cannot final-approve payslip status" },
      { id: "time", area: "Time & attendance", description: "Timesheets and clock entries", level: "edit" },
      { id: "leave_mgr", area: "Leave (manager step)", description: "For assigned teams only", level: "approve" },
      { id: "leave_hr", area: "Leave (HR step)", description: "Final approval for everyone", level: "approve" },
      { id: "ot", area: "Overtime & failure to log", description: "All requests", level: "approve" },
      { id: "admin_mod", area: "Audit, BIR, payroll register", description: "—", level: "none" },
      { id: "team", area: "Team accounts", description: "—", level: "none" },
    ],
  },
  {
    role: "hr_admin",
    title: "HR Admin",
    summary: "Same system access as Head of HR by default; use for HR operations staff.",
    bestFor: "HR generalists handling records, schedules, and approvals.",
    handoffTip: "Copy from the previous HR Admin account and match Pay info + any custom app access.",
    salaryAccessDefault: false,
    rows: [
      { id: "dash", area: "Dashboard", description: "Workforce overview", level: "read" },
      { id: "emp", area: "Employees", description: "Add and edit", level: "edit" },
      { id: "pay", area: "Payroll & payslips", description: "With Pay info", level: "edit", note: "Cannot final-approve payslip status" },
      { id: "time", area: "Time & attendance", description: "Full operational access", level: "edit" },
      { id: "leave_hr", area: "Leave (HR step)", description: "Final approval for everyone", level: "approve" },
      { id: "ot", area: "Overtime & failure to log", description: "All requests", level: "approve" },
      { id: "admin_mod", area: "Audit, BIR, payroll register", description: "—", level: "none" },
    ],
  },
  {
    role: "hr_compben",
    title: "HR Comp & Benefits",
    summary: "HR access plus ability to re-save payslips after they are stored (compensation team).",
    bestFor: "Compensation & benefits specialist (e.g. payroll preparation).",
    handoffTip: "Copy from outgoing compben user; ensure Pay info is on and verify payslip re-save if needed.",
    salaryAccessDefault: true,
    rows: [
      { id: "dash", area: "Dashboard", description: "Workforce overview", level: "read" },
      { id: "emp", area: "Employees", description: "Add and edit", level: "edit" },
      { id: "pay", area: "Payroll & payslips", description: "Generate and re-save payslips", level: "edit", note: "Cannot final-approve payslip status" },
      { id: "time", area: "Time & attendance", description: "Operational access", level: "edit" },
      { id: "leave_hr", area: "Leave (HR step)", description: "Final approval", level: "approve" },
      { id: "ot", area: "Overtime & failure to log", description: "All requests", level: "approve" },
    ],
  },
  {
    role: "approver",
    title: "Approver",
    summary: "Reviews time and requests only for employees in assigned groups (no employee directory in menu).",
    bestFor: "Department leads and supervisors.",
    handoffTip:
      "Copy access from the previous approver and include team assignments, or pick the same groups in Add member.",
    salaryAccessDefault: false,
    rows: [
      { id: "dash", area: "Dashboard", description: "—", level: "none" },
      { id: "emp", area: "Employees", description: "Hidden from menu", level: "none" },
      { id: "pay", area: "Payroll & payslips", description: "—", level: "none" },
      { id: "time", area: "Time & attendance", description: "View for assigned staff", level: "read" },
      { id: "leave_mgr", area: "Leave (manager step)", description: "Assigned groups only", level: "approve" },
      { id: "ot", area: "Overtime & failure to log", description: "Assigned groups only", level: "approve" },
      { id: "groups", area: "Group assignment", description: "Required", level: "full", note: "Set under Groups & approvers" },
    ],
  },
  {
    role: "viewer",
    title: "Viewer",
    summary: "Same visibility as Approver but cannot approve—read-only on queues.",
    bestFor: "Auditors or backup supervisors who only need to monitor.",
    handoffTip: "Copy from the previous viewer; assign the same groups.",
    salaryAccessDefault: false,
    rows: [
      { id: "dash", area: "Dashboard", description: "—", level: "none" },
      { id: "time", area: "Time & attendance", description: "View assigned staff", level: "read" },
      { id: "leave_mgr", area: "Leave requests", description: "View only", level: "read" },
      { id: "ot", area: "Overtime & failure to log", description: "View only", level: "read" },
      { id: "groups", area: "Group assignment", description: "Required", level: "full" },
    ],
  },
];

export function getRoleProfile(role: string | null | undefined): RoleProfile | null {
  if (!role) return null;
  return ROLE_PROFILES.find((p) => p.role === role) ?? null;
}

function levelFromModule(perms: UserPermissions, module: ModuleName): AccessLevel {
  const m = perms[module];
  if (!m) return "none";
  if (m.create && m.read && m.update && m.delete) return "full";
  if (m.update) return m.read ? "approve" : "edit";
  if (m.create || m.delete) return "edit";
  if (m.read) return "read";
  return "none";
}

/** Effective friendly rows for a specific person (role defaults + custom ACL). */
export function buildUserAccessPreview(
  role: string,
  permissions: UserPermissions | null,
  canAccessSalary: boolean
): FriendlyAccessRow[] {
  const effective =
    permissions ?? getDefaultPermissionsForRole(role);

  const rows: FriendlyAccessRow[] = [
    {
      id: "dash",
      area: "Dashboard",
      description: "Overview screens",
      level: levelFromModule(effective, "dashboard"),
    },
    {
      id: "emp",
      area: "Employees",
      description: "Directory and profiles",
      level: levelFromModule(effective, "employees"),
    },
    {
      id: "sched",
      area: "Schedules",
      description: "Work schedules",
      level: levelFromModule(effective, "schedules"),
    },
    {
      id: "pay",
      area: "Payroll & payslips",
      description: canAccessSalary ? "Pay info enabled" : "Pay info off",
      level: canAccessSalary
        ? levelFromModule(effective, "payslips")
        : "none",
      note: canAccessSalary ? undefined : "Turn on Pay info in Team members",
    },
    {
      id: "loans",
      area: "Loans",
      description: "Salary advances",
      level: canAccessSalary ? levelFromModule(effective, "loans") : "none",
    },
    {
      id: "time",
      area: "Time & attendance",
      description: "Timesheet grid",
      level: levelFromModule(effective, "timesheet"),
    },
    {
      id: "entries",
      area: "Time entries",
      description: "Clock events",
      level: levelFromModule(effective, "time_entries"),
    },
    {
      id: "leave",
      area: "Leave approvals",
      description: "Leave queue",
      level: levelFromModule(effective, "leave_approval"),
    },
    {
      id: "ot",
      area: "Overtime approvals",
      description: "OT queue",
      level: levelFromModule(effective, "overtime_approval"),
    },
    {
      id: "ftl",
      area: "Failure to log",
      description: "Missed punch queue",
      level: levelFromModule(effective, "failure_to_log"),
    },
    {
      id: "audit",
      area: "Audit & compliance",
      description: "Audit log, BIR, payroll register",
      level:
        levelFromModule(effective, "audit") !== "none" ||
        levelFromModule(effective, "bir_reports") !== "none" ||
        levelFromModule(effective, "reports") !== "none"
          ? "read"
          : "none",
    },
    {
      id: "settings",
      area: "Settings",
      description: "App preferences",
      level: levelFromModule(effective, "settings"),
    },
  ];

  return rows.filter((r) => r.level !== "none" || r.id === "pay");
}

export interface HandoffChecklistItem {
  id: string;
  label: string;
  done?: boolean;
}

export function getHandoffChecklist(role: string): HandoffChecklistItem[] {
  const base: HandoffChecklistItem[] = [
    { id: "create", label: "Create the new login (Add member)" },
    { id: "copy", label: "Copy app access & Pay info from the departing colleague" },
    { id: "deactivate", label: "Deactivate the old account when the new person is ready" },
  ];

  if (role === "approver" || role === "viewer") {
    return [
      ...base,
      { id: "groups", label: "Assign the same groups (or copy access including teams)" },
      { id: "groups_page", label: "Confirm Groups & approvers shows the new person as lead" },
    ];
  }

  if (isHRFamilyRole(role)) {
    return [
      ...base,
      { id: "salary", label: "Grant Pay info if they handle payslips or loans" },
      { id: "leave", label: "Confirm they can complete leave HR step (all employees)" },
      { id: "groups", label: "Reassign any group lead slots the old HR held" },
    ];
  }

  if (role === "admin") {
    return [
      ...base,
      { id: "audit", label: "Verify Audit, BIR, and payroll register" },
      { id: "payslip", label: "Confirm payslip final approval works" },
    ];
  }

  return base;
}

export function describeCopyPayload(source: {
  full_name: string;
  role: string;
  can_access_salary?: boolean | null;
  permissions?: unknown;
  assigned_ot_groups?: { name: string }[];
}): string[] {
  const lines: string[] = [
    `Role template: ${formatRoleLabel(source.role)} (you can change role separately)`,
  ];
  if (source.permissions) {
    lines.push("Custom app access overrides");
  } else {
    lines.push("Standard app access for that role");
  }
  lines.push(
    source.can_access_salary ? "Pay info: Yes" : "Pay info: No"
  );
  if (source.assigned_ot_groups?.length) {
    lines.push(
      `Teams: ${source.assigned_ot_groups.map((g) => g.name).join(", ")}`
    );
  }
  return lines;
}

export const ASSIGNABLE_ROLES: { value: DashboardUserRole | "admin"; label: string }[] = [
  { value: "head_of_hr", label: "Head of HR" },
  { value: "hr_admin", label: "HR Admin" },
  { value: "hr_compben", label: "HR Comp & Benefits" },
  { value: "approver", label: "Approver" },
  { value: "viewer", label: "Viewer" },
  { value: "admin", label: "Admin" },
];
