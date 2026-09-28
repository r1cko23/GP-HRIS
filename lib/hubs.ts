import type { ModuleName } from "@/lib/hooks/usePermissions";

export type HubId =
  | "people"
  | "benefits"
  | "payroll"
  | "bdo"
  | "time"
  | "reports"
  | "admin";

export type HubTab = {
  name: string;
  href: string;
  /** One-line job shown on the hub index. */
  description?: string;
  permissionModule?: ModuleName;
  permissionAny?: ModuleName[];
  adminOnly?: boolean;
  /** Path prefixes that count as active for this tab. */
  activePrefixes?: string[];
};

export type HubDef = {
  id: HubId;
  label: string;
  href: string;
  permissionModule?: ModuleName;
  permissionAny?: ModuleName[];
  tabs: HubTab[];
};

export function peopleClientPath(clientId: string): string {
  return `/people/c/${clientId}?status=active`;
}

export function peopleEmployeePath(
  clientId: string,
  employeeId: string
): string {
  return `/people/c/${clientId}/${employeeId}`;
}

export function peopleEmployeeHirePath(clientId: string): string {
  return `/people/c/${clientId}/new`;
}

export function peopleEmployeeOnboardPath(
  clientId: string,
  employeeId: string,
  step?: string
): string {
  const base = `/people/c/${clientId}/${employeeId}/onboard`;
  if (!step) return base;
  return `${base}?step=${encodeURIComponent(step)}`;
}

export function peopleClientEditPath(clientId: string): string {
  return `/people/clients/${clientId}`;
}

export function enrollmentPath(employeeId?: string): string {
  return employeeId ? `/time/enrollment/${employeeId}` : "/time/enrollment";
}

export const HUBS: HubDef[] = [
  {
    id: "people",
    label: "People",
    href: "/people",
    permissionModule: "employees",
    tabs: [],
  },
  {
    id: "benefits",
    label: "Benefits",
    href: "/benefits",
    permissionAny: ["loans", "payslips", "employees"],
    tabs: [
      {
        name: "Loans",
        href: "/benefits/loans",
        permissionModule: "loans",
        description: "Standing balances deducted on the register",
      },
      {
        name: "Allowances",
        href: "/benefits/allowances",
        permissionModule: "payslips",
        description: "Recurring extras on the register",
      },
      {
        name: "Deductions",
        href: "/benefits/deductions",
        permissionModule: "payslips",
        description: "Recurring extras on the register",
      },
      {
        name: "Refunds",
        href: "/benefits/refunds",
        permissionModule: "payslips",
        description: "Cutoff-scoped refund on the register",
      },
      {
        name: "Statutory IDs",
        href: "/benefits/statutory",
        permissionModule: "employees",
        description: "SSS, TIN, PhilHealth, and Pag-IBIG on the 201",
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    // Cutoff register — not Benefits Allowances/Deductions (those use payslips too).
    permissionModule: "reports",
    /** Weekly Office generator stays at /payroll/payslips (Settings dual-run). */
    tabs: [],
  },
  {
    id: "bdo",
    label: "Debit Memo",
    href: "/bdo-queue",
    permissionModule: "reports",
    tabs: [],
  },
  {
    id: "time",
    label: "Time",
    href: "/time",
    // Enrollment/Biometric tabs still gate on `employees`; hub chrome must not.
    permissionAny: [
      "timesheet",
      "time_entries",
      "leave_approval",
      "overtime_approval",
      "failure_to_log",
      "schedules",
    ],
    tabs: [
      {
        name: "Attendance",
        href: "/time/attendance",
        permissionAny: ["timesheet", "time_entries"],
        description: "One card per employee per cutoff",
      },
      {
        name: "Leave",
        href: "/time/leave",
        permissionModule: "leave_approval",
        description: "SIL and LWOP approvals",
      },
      {
        name: "OT",
        href: "/time/overtime",
        permissionModule: "overtime_approval",
        description: "Overtime approvals",
      },
      {
        name: "Failure to log",
        href: "/time/failure-to-log",
        permissionModule: "failure_to_log",
        description: "Missed punch requests",
      },
      {
        name: "Schedules",
        href: "/time/schedules",
        permissionModule: "schedules",
        description: "Weekly shift assignments",
      },
      {
        name: "Enrollment",
        href: "/time/enrollment",
        permissionModule: "employees",
        activePrefixes: ["/time/enrollment"],
        description: "Clock, portal, and GPS access",
      },
      {
        name: "Biometric",
        href: "/time/biometric",
        permissionModule: "employees",
        activePrefixes: ["/time/biometric"],
        description: "MB10-VL PIN maps for Green Pasture",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    // Business remittance reports. Diagnostic tools live under Admin.
    // Entry pages (deductions / allowances / refunds) live under Benefits.
    permissionAny: ["reports", "loans", "bir_reports"],
    tabs: [
      {
        name: "Loans",
        href: "/reports/loans",
        permissionAny: ["reports", "loans"],
        activePrefixes: ["/reports/loans"],
        description: "SSS and Pag-IBIG loan remittance from posted registers",
      },
      {
        name: "Cash advance",
        href: "/reports/cash-advance",
        permissionAny: ["reports", "loans"],
        activePrefixes: ["/reports/cash-advance"],
        description: "Organic cash advances from posted registers",
      },
      {
        name: "Alphalist",
        href: "/reports/alphalist",
        permissionAny: ["reports", "bir_reports"],
        activePrefixes: ["/reports/alphalist"],
        description: "Annual alphalist from posted registers",
      },
      {
        name: "13th month",
        href: "/reports/thirteenth-month",
        permissionAny: ["reports", "bir_reports"],
        activePrefixes: ["/reports/thirteenth-month"],
        description: "Miss Merry 13th month pay from posted registers",
      },
      {
        name: "13th Final Pay",
        href: "/reports/thirteenth-month-final-pay",
        permissionAny: ["reports", "bir_reports"],
        activePrefixes: ["/reports/thirteenth-month-final-pay"],
        description: "MAIN Final Pay Emp ID / months / basic / 13th",
      },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    href: "/admin",
    permissionAny: ["dashboard", "reports", "bir_reports", "audit"],
    tabs: [
      {
        name: "Overview",
        href: "/admin/overview",
        permissionModule: "dashboard",
        activePrefixes: ["/admin/overview"],
        description: "Executive and workforce dashboards",
      },
      {
        name: "Register",
        href: "/admin/register",
        permissionModule: "reports",
        activePrefixes: ["/admin/register"],
        description: "Posted cutoff lines and exports",
      },
      {
        name: "BIR",
        href: "/admin/bir",
        permissionModule: "bir_reports",
        activePrefixes: ["/admin/bir"],
        description: "Tax forms and alphalist",
      },
      {
        name: "Audit log",
        href: "/admin/audit",
        permissionModule: "audit",
        activePrefixes: ["/admin/audit"],
        description: "Who changed what",
      },
      {
        name: "Devices",
        href: "/admin/devices",
        permissionModule: "audit",
        activePrefixes: ["/admin/devices"],
        description: "Clock device and IP",
      },
      {
        name: "Cutoff parity",
        href: "/admin/cutoff-parity",
        adminOnly: true,
        activePrefixes: ["/admin/cutoff-parity"],
        description: "Register vs GREENHRISMAIN",
      },
      {
        name: "Payroll audit",
        href: "/admin/payroll-audit",
        adminOnly: true,
        activePrefixes: ["/admin/payroll-audit"],
        description: "Posted-run diagnostics",
      },
      {
        name: "Incentive audit",
        href: "/admin/incentive-audit",
        adminOnly: true,
        activePrefixes: ["/admin/incentive-audit"],
        description: "Duplicate and prior payouts",
      },
    ],
  },
];

export function hubForPath(pathname: string): HubDef | null {
  if (pathname.startsWith("/payroll-office")) return null;
  const ranked = HUBS.map((hub) => ({
    hub,
    rank: pathname === hub.href || pathname.startsWith(`${hub.href}/`)
      ? hub.href.length
      : 0,
  }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  return ranked[0]?.hub ?? null;
}

export function isHubTabActive(pathname: string, tab: HubTab): boolean {
  const prefixes = tab.activePrefixes?.length ? tab.activePrefixes : [tab.href];
  return prefixes.some((prefix) => {
    if (pathname === prefix) return true;
    if (prefix !== "/" && pathname.startsWith(`${prefix}/`)) return true;
    return false;
  });
}

/** Longest matching tab wins when prefixes overlap (e.g. /admin vs /admin/bir). */
export function activeHubTab(pathname: string, hub: HubDef): HubTab | null {
  let best: HubTab | null = null;
  let longest = -1;
  for (const tab of hub.tabs) {
    if (!isHubTabActive(pathname, tab)) continue;
    const rank = Math.max(
      ...(tab.activePrefixes?.length ? tab.activePrefixes : [tab.href]).map(
        (p) => p.length
      )
    );
    if (rank > longest) {
      best = tab;
      longest = rank;
    }
  }
  return best;
}

export function grantedHubTabs(
  hub: HubDef,
  canRead: (module: ModuleName) => boolean,
  opts: { isAdmin?: boolean; hideEmployees?: boolean } = {}
): HubTab[] {
  return hub.tabs.filter((tab) => tabVisible(tab, canRead, opts));
}

export function firstGrantedHubTab(
  hub: HubDef,
  canRead: (module: ModuleName) => boolean,
  opts: { isAdmin?: boolean; hideEmployees?: boolean } = {}
): HubTab | null {
  return grantedHubTabs(hub, canRead, opts)[0] ?? null;
}

export function tabVisible(
  tab: HubTab,
  canRead: (module: ModuleName) => boolean,
  opts: { isAdmin?: boolean; hideEmployees?: boolean } = {}
): boolean {
  if (tab.adminOnly) return Boolean(opts.isAdmin);
  if (opts.hideEmployees && tab.permissionModule === "employees") return false;
  if (tab.permissionAny?.length) {
    return tab.permissionAny.some((mod) => canRead(mod));
  }
  if (!tab.permissionModule) return true;
  return canRead(tab.permissionModule);
}

export function hubVisible(
  hub: HubDef,
  canRead: (module: ModuleName) => boolean,
  opts: { isAdmin?: boolean; hideEmployees?: boolean } = {}
): boolean {
  // Hub-level gates win over tabs so Enrollment/Biometric (`employees`) cannot
  // open the Time chrome for a People-only ABAC pack.
  if (hub.permissionAny?.length) {
    return hub.permissionAny.some((mod) => canRead(mod));
  }
  if (hub.permissionModule) {
    if (opts.hideEmployees && hub.permissionModule === "employees") return false;
    return canRead(hub.permissionModule);
  }
  if (hub.tabs.length > 0) {
    return hub.tabs.some((tab) => tabVisible(tab, canRead, opts));
  }
  return true;
}

export function postLoginPath(role: string | null | undefined): string {
  if (role === "admin") return "/admin";
  if (role === "approver" || role === "viewer") return "/time";
  return "/people";
}

export function headerTitleForPath(pathname: string): string {
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/overtime-groups")) return "Groups & approvers";
  if (pathname.startsWith("/payroll-office")) return "Office payroll";
  if (pathname.startsWith("/bdo-queue")) return "Debit Memo Queue";
  if (pathname.startsWith("/payroll/payslips")) return "Office payslips";
  if (pathname.startsWith("/privacy")) return "Privacy";

  if (pathname.match(/^\/people\/c\/[^/]+\/new\/?$/)) return "Add employee";
  if (pathname.match(/^\/people\/c\/[^/]+\/[^/]+\/onboard/)) return "Onboard 201";
  if (pathname.match(/^\/people\/c\/[^/]+\/departments/)) return "Departments";
  if (pathname.match(/^\/people\/c\/[^/]+\/positions/)) return "Positions";
  if (pathname.match(/^\/people\/c\/[^/]+\/[^/]+/)) return "201 file";
  if (pathname.match(/^\/people\/c\/[^/]+/)) return "Employee roster";
  if (pathname.startsWith("/people/clients")) return "Client";
  if (pathname.startsWith("/people")) return "People";

  const hub = hubForPath(pathname);
  if (!hub) return "GP HRIS";
  const tab = activeHubTab(pathname, hub);
  if (tab) return tab.name;
  return hub.label;
}
