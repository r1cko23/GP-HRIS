/**
 * Custom hook for checking user permissions (ACL/RBAC)
 * Provides granular CRUD access control per module
 */

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { isHRFamilyRole } from "@/lib/roles";
import { useCurrentUser } from "./useCurrentUser";

// Define all available modules in the system
export const MODULES = {
  dashboard: "dashboard",
  employees: "employees",
  schedules: "schedules",
  loans: "loans",
  payslips: "payslips",
  timesheet: "timesheet",
  time_entries: "time_entries",
  leave_approval: "leave_approval",
  overtime_approval: "overtime_approval",
  failure_to_log: "failure_to_log",
  audit: "audit",
  bir_reports: "bir_reports",
  reports: "reports",
  settings: "settings",
  user_management: "user_management",
} as const;

export type ModuleName = (typeof MODULES)[keyof typeof MODULES];

// Define actions
export const ACTIONS = {
  create: "create",
  read: "read",
  update: "update",
  delete: "delete",
} as const;

export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

// Module permission structure
export interface ModulePermissions {
  create: boolean;
  read: boolean;
  update: boolean;
  delete: boolean;
}

// Full permissions object
export type UserPermissions = Record<ModuleName, ModulePermissions>;

// Module display information for UI
export interface ModuleInfo {
  key: ModuleName;
  label: string;
  description: string;
  category: "overview" | "people" | "time" | "admin" | "settings";
}

// Define module metadata for the UI
export const MODULE_INFO: ModuleInfo[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    description: "Home overview and workforce snapshots",
    category: "overview",
  },
  {
    key: "employees",
    label: "Employees",
    description: "Directory, profiles, and HR records",
    category: "people",
  },
  {
    key: "schedules",
    label: "Schedules",
    description: "Shifts and work schedules",
    category: "people",
  },
  {
    key: "loans",
    label: "Loans",
    description: "Salary advances and repayments",
    category: "people",
  },
  {
    key: "payslips",
    label: "Payslips",
    description: "Pay runs and payslip history",
    category: "people",
  },
  {
    key: "timesheet",
    label: "Time & attendance",
    description: "Attendance grid and summaries",
    category: "time",
  },
  {
    key: "time_entries",
    label: "Time entries",
    description: "Clock events and manual corrections",
    category: "time",
  },
  {
    key: "leave_approval",
    label: "Leave requests",
    description: "Review and act on time off",
    category: "time",
  },
  {
    key: "overtime_approval",
    label: "Overtime requests",
    description: "Review and approve OT",
    category: "time",
  },
  {
    key: "failure_to_log",
    label: "Missed punches (FTL)",
    description: "Requests when someone forgot to clock",
    category: "time",
  },
  {
    key: "audit",
    label: "Audit log",
    description: "Who changed what and when",
    category: "admin",
  },
  {
    key: "bir_reports",
    label: "BIR reports",
    description: "Tax and statutory filings",
    category: "admin",
  },
  {
    key: "reports",
    label: "Payroll register",
    description: "Payroll summaries and exports",
    category: "admin",
  },
  {
    key: "settings",
    label: "Settings",
    description: "Company and app preferences",
    category: "settings",
  },
  {
    key: "user_management",
    label: "Team & access (Settings)",
    description: "Invite people, roles, and who can open Settings",
    category: "settings",
  },
];

// Default permissions by role
export const DEFAULT_PERMISSIONS: Record<string, UserPermissions> = {
  admin: Object.fromEntries(
    Object.values(MODULES).map((module) => [
      module,
      { create: true, read: true, update: true, delete: true },
    ])
  ) as UserPermissions,
  head_of_hr: {
    dashboard: { create: false, read: true, update: false, delete: false },
    employees: { create: true, read: true, update: true, delete: false },
    schedules: { create: true, read: true, update: true, delete: true },
    loans: { create: true, read: true, update: true, delete: false },
    payslips: { create: true, read: true, update: true, delete: false },
    timesheet: { create: false, read: true, update: true, delete: false },
    time_entries: { create: true, read: true, update: true, delete: true },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: true, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
  },
  approver: {
    dashboard: { create: false, read: false, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    schedules: { create: false, read: true, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    timesheet: { create: false, read: true, update: false, delete: false },
    time_entries: { create: false, read: true, update: false, delete: false },
    leave_approval: { create: false, read: true, update: true, delete: false },
    overtime_approval: { create: false, read: true, update: true, delete: false },
    failure_to_log: { create: false, read: true, update: true, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
  },
  viewer: {
    dashboard: { create: false, read: false, update: false, delete: false },
    employees: { create: false, read: false, update: false, delete: false },
    schedules: { create: false, read: true, update: false, delete: false },
    loans: { create: false, read: false, update: false, delete: false },
    payslips: { create: false, read: false, update: false, delete: false },
    timesheet: { create: false, read: true, update: false, delete: false },
    time_entries: { create: false, read: true, update: false, delete: false },
    leave_approval: { create: false, read: true, update: false, delete: false },
    overtime_approval: { create: false, read: true, update: false, delete: false },
    failure_to_log: { create: false, read: true, update: false, delete: false },
    audit: { create: false, read: false, update: false, delete: false },
    bir_reports: { create: false, read: false, update: false, delete: false },
    reports: { create: false, read: false, update: false, delete: false },
    settings: { create: false, read: false, update: false, delete: false },
    user_management: { create: false, read: false, update: false, delete: false },
  },
};

// Empty permissions (deny all)
const EMPTY_PERMISSIONS: UserPermissions = Object.fromEntries(
  Object.values(MODULES).map((module) => [
    module,
    { create: false, read: false, update: false, delete: false },
  ])
) as UserPermissions;

/** True if at least one module allows read (navigation / pages use `canRead`). */
function hasAnyModuleRead(perms: UserPermissions | null): boolean {
  if (!perms) return false;
  return Object.values(MODULES).some((key) => perms[key]?.read === true);
}

/**
 * If ACL/RPC returns an all-deny matrix for an admin or HR-family user, fall back to
 * role defaults so the sidebar and dashboards stay usable (fixes bad rows in users.permissions).
 */
function coercePrivilegedPermissionsIfBroken(
  role: string | null | undefined,
  perms: UserPermissions
): UserPermissions {
  const r = role || "viewer";
  if ((r === "admin" || isHRFamilyRole(r)) && !hasAnyModuleRead(perms)) {
    return getDefaultPermissionsForRole(r);
  }
  return perms;
}

interface UsePermissionsReturn {
  permissions: UserPermissions | null;
  loading: boolean;
  error: string | null;
  hasPermission: (module: ModuleName, action: ActionName) => boolean;
  canCreate: (module: ModuleName) => boolean;
  canRead: (module: ModuleName) => boolean;
  canUpdate: (module: ModuleName) => boolean;
  canDelete: (module: ModuleName) => boolean;
  refetch: () => void;
}

// Cache for permissions to avoid redundant API calls
let permissionsCache: { userId: string; permissions: UserPermissions; timestamp: number } | null =
  null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function usePermissions(): UsePermissionsReturn {
  const { user, loading: userLoading, refetch: refetchUser } = useCurrentUser();
  const [permissions, setPermissions] = useState<UserPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const fetchPermissions = useCallback(async () => {
    if (!user) {
      setPermissions(null);
      setLoading(false);
      return;
    }

    // Check cache first
    if (
      permissionsCache &&
      permissionsCache.userId === user.id &&
      Date.now() - permissionsCache.timestamp < CACHE_TTL
    ) {
      setPermissions(
        coercePrivilegedPermissionsIfBroken(
          user.role,
          permissionsCache.permissions
        )
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Call the RPC function to get merged permissions
      const { data, error: rpcError } = await supabase.rpc("get_user_permissions", {
        p_user_id: user.id,
      });

      if (rpcError) {
        console.error("Error fetching permissions:", rpcError);
        // Merge role defaults with users.permissions (same as Settings CRUD matrix)
        const { data: row, error: permError } = await supabase
          .from("users")
          .select("permissions")
          .eq("id", user.id)
          .single();

        if (permError) {
          const defaultPerms = getDefaultPermissionsForRole(user.role || "viewer");
          setPermissions(defaultPerms);
          setError(rpcError.message);
        } else {
          const merged = coercePrivilegedPermissionsIfBroken(
            user.role,
            mergePermissions(
              user.role || "viewer",
              (row?.permissions as Partial<UserPermissions> | null) ?? null
            )
          );
          setPermissions(merged);
          permissionsCache = {
            userId: user.id,
            permissions: merged,
            timestamp: Date.now(),
          };
          setError(null);
        }
      } else {
        const perms = coercePrivilegedPermissionsIfBroken(
          user.role,
          data as UserPermissions
        );
        setPermissions(perms);
        permissionsCache = {
          userId: user.id,
          permissions: perms,
          timestamp: Date.now(),
        };
      }
    } catch (err: any) {
      console.error("Error fetching permissions:", err);
      try {
        const { data: row } = await supabase
          .from("users")
          .select("permissions")
          .eq("id", user.id)
          .single();
        const merged = coercePrivilegedPermissionsIfBroken(
          user.role,
          mergePermissions(
            user.role || "viewer",
            (row?.permissions as Partial<UserPermissions> | null) ?? null
          )
        );
        setPermissions(merged);
      } catch {
        const defaultPerms = getDefaultPermissionsForRole(user.role || "viewer");
        setPermissions(defaultPerms);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!userLoading) {
      fetchPermissions();
    }
  }, [userLoading, fetchPermissions]);

  const refetch = useCallback(() => {
    // Clear cache
    permissionsCache = null;
    refetchUser();
    fetchPermissions();
  }, [refetchUser, fetchPermissions]);

  // Permission check helpers
  const hasPermission = useCallback(
    (module: ModuleName, action: ActionName): boolean => {
      if (!permissions) return false;
      const modulePerms = permissions[module];
      if (!modulePerms) return false;
      return modulePerms[action] ?? false;
    },
    [permissions]
  );

  const canCreate = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "create"),
    [hasPermission]
  );

  const canRead = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "read"),
    [hasPermission]
  );

  const canUpdate = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "update"),
    [hasPermission]
  );

  const canDelete = useCallback(
    (module: ModuleName): boolean => hasPermission(module, "delete"),
    [hasPermission]
  );

  return useMemo(
    () => ({
      permissions,
      loading: loading || userLoading,
      error,
      hasPermission,
      canCreate,
      canRead,
      canUpdate,
      canDelete,
      refetch,
    }),
    [permissions, loading, userLoading, error, hasPermission, canCreate, canRead, canUpdate, canDelete, refetch]
  );
}

/**
 * Clear the permissions cache (call when permissions are updated)
 */
export function clearPermissionsCache() {
  permissionsCache = null;
}

/**
 * Get default permissions for a role
 */
export function getDefaultPermissionsForRole(role: string): UserPermissions {
  if (isHRFamilyRole(role)) {
    return DEFAULT_PERMISSIONS.head_of_hr;
  }
  return DEFAULT_PERMISSIONS[role] || EMPTY_PERMISSIONS;
}

/**
 * Merge custom permissions with role defaults
 */
export function mergePermissions(
  role: string,
  customPermissions: Partial<UserPermissions> | null
): UserPermissions {
  const defaults = getDefaultPermissionsForRole(role);
  if (!customPermissions) return defaults;

  const merged = { ...defaults };
  for (const [module, perms] of Object.entries(customPermissions)) {
    if (merged[module as ModuleName]) {
      merged[module as ModuleName] = {
        ...merged[module as ModuleName],
        ...perms,
      };
    }
  }
  return merged;
}