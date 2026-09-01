import type { ModuleName } from "@/lib/hooks/usePermissions";

export type HubId = "people" | "benefits" | "payroll" | "time" | "reports";

export type HubTab = {
  name: string;
  href: string;
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
  return `/people/c/${clientId}`;
}

export function peopleEmployeePath(
  clientId: string,
  employeeId: string
): string {
  return `/people/c/${clientId}/${employeeId}`;
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
      { name: "Loans", href: "/benefits/loans", permissionModule: "loans" },
      {
        name: "Allowances",
        href: "/benefits/allowances",
        permissionModule: "payslips",
      },
      {
        name: "Deductions",
        href: "/benefits/deductions",
        permissionModule: "payslips",
      },
      {
        name: "Statutory IDs",
        href: "/benefits/statutory",
        permissionModule: "employees",
      },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
    href: "/payroll",
    permissionModule: "payslips",
    tabs: [
      {
        name: "Cutoffs",
        href: "/payroll",
        permissionModule: "payslips",
        activePrefixes: ["/payroll"],
      },
      {
        name: "Payslips",
        href: "/payroll/payslips",
        permissionModule: "payslips",
        activePrefixes: ["/payroll/payslips"],
      },
    ],
  },
  {
    id: "time",
    label: "Time",
    href: "/time",
    permissionAny: [
      "timesheet",
      "time_entries",
      "leave_approval",
      "overtime_approval",
      "failure_to_log",
      "schedules",
      "employees",
    ],
    tabs: [
      {
        name: "Attendance",
        href: "/time/attendance",
        permissionModule: "timesheet",
      },
      {
        name: "Entries",
        href: "/time/entries",
        permissionModule: "time_entries",
      },
      {
        name: "Leave",
        href: "/time/leave",
        permissionModule: "leave_approval",
      },
      {
        name: "OT",
        href: "/time/overtime",
        permissionModule: "overtime_approval",
      },
      {
        name: "Failure to log",
        href: "/time/failure-to-log",
        permissionModule: "failure_to_log",
      },
      {
        name: "Schedules",
        href: "/time/schedules",
        permissionModule: "schedules",
      },
      {
        name: "Enrollment",
        href: "/time/enrollment",
        permissionModule: "employees",
        activePrefixes: ["/time/enrollment"],
      },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    href: "/reports",
    permissionAny: ["dashboard", "reports", "bir_reports", "audit"],
    tabs: [
      {
        name: "Overview",
        href: "/reports",
        permissionModule: "dashboard",
        activePrefixes: ["/reports"],
      },
      {
        name: "Register",
        href: "/reports/register",
        permissionModule: "reports",
        activePrefixes: ["/reports/register"],
      },
      {
        name: "BIR",
        href: "/reports/bir",
        permissionModule: "bir_reports",
        activePrefixes: ["/reports/bir"],
      },
      {
        name: "Audit log",
        href: "/reports/audit",
        permissionModule: "audit",
        activePrefixes: ["/reports/audit"],
      },
      {
        name: "Devices",
        href: "/reports/devices",
        permissionModule: "audit",
        activePrefixes: ["/reports/devices"],
      },
      {
        name: "Cutoff parity",
        href: "/reports/cutoff-parity",
        adminOnly: true,
        activePrefixes: ["/reports/cutoff-parity"],
      },
      {
        name: "Payroll audit",
        href: "/reports/payroll-audit",
        adminOnly: true,
        activePrefixes: ["/reports/payroll-audit"],
      },
      {
        name: "Incentive audit",
        href: "/reports/incentive-audit",
        adminOnly: true,
        activePrefixes: ["/reports/incentive-audit"],
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

/** Longest matching tab wins so /payroll/payslips does not light Cutoffs. */
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

export function firstGrantedHubTab(
  hub: HubDef,
  canRead: (module: ModuleName) => boolean,
  opts: { isAdmin?: boolean; hideEmployees?: boolean } = {}
): HubTab | null {
  return (
    hub.tabs.find((tab) => tabVisible(tab, canRead, opts)) ?? null
  );
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
  if (hub.tabs.length > 0) {
    return hub.tabs.some((tab) => tabVisible(tab, canRead, opts));
  }
  if (hub.permissionAny?.length) {
    return hub.permissionAny.some((mod) => canRead(mod));
  }
  if (!hub.permissionModule) return true;
  if (opts.hideEmployees && hub.permissionModule === "employees") return false;
  return canRead(hub.permissionModule);
}

export function postLoginPath(role: string | null | undefined): string {
  if (role === "admin") return "/reports";
  if (role === "approver" || role === "viewer") return "/time";
  return "/people";
}

export function headerTitleForPath(pathname: string): string {
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/overtime-groups")) return "Groups & approvers";
  if (pathname.startsWith("/payroll-office")) return "Office payroll";
  if (pathname.startsWith("/privacy")) return "Privacy";

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
