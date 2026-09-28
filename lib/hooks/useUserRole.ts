/**
 * Custom hook to get the current user's role
 * Used for role-based rendering and access control
 *
 * OPTIMIZATIONS:
 * - Uses /api/auth/me endpoint for faster server-side execution
 * - Session-level caching to prevent redundant API calls
 * - Memoized return values to prevent unnecessary re-renders
 * - Single API call instead of sequential client-side calls
 */

import { useMemo, useCallback } from "react";
import type { Database } from "@/types/database";
import { isHRFamilyRole } from "@/lib/roles";
import { useCurrentUser } from "./useCurrentUser";
import { usePermissions } from "./usePermissions";

type UserRole =
  | Database["public"]["Tables"]["users"]["Row"]["role"];

interface UserRoleData {
  role: UserRole | null;
  email: string | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isHR: boolean;
  isApprover: boolean;
  isViewer: boolean;
  isRestrictedAccess: boolean; // approver or viewer
  canAccessSalaryInfo: boolean; // ABAC salary grant / profile flag / system admin
  /** Only Admin or HR April Gammad can update (re-save) a saved payslip */
  canUpdatePayslip: boolean;
  refetch: () => void;
}

export function useUserRole(): UserRoleData {
  const { user, loading: userLoading, error: userError, refetch: refetchUser } = useCurrentUser();
  const { canAccessSalary, loading: permissionsLoading } = usePermissions();

  const refetch = useCallback(() => {
    refetchUser();
  }, [refetchUser]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(() => {
    const emailLower = user?.email?.toLowerCase() ?? "";
    const isAprilCompbenEmail = emailLower === "anngammad@greenpasture.ph";
    const isAprilGammad =
      isAprilCompbenEmail ||
      (user?.role === "hr_compben" &&
        user?.full_name != null &&
        user.full_name.toLowerCase().includes("april") &&
        user.full_name.toLowerCase().includes("gammad"));

    const hrFamily = isHRFamilyRole(user?.role);

    return {
      role: user?.role ?? null,
      email: user?.email ?? null,
      loading: userLoading || permissionsLoading,
      error: userError,
      isAdmin: user?.role === "admin",
      isHR: hrFamily,
      isApprover: user?.role === "approver" || hrFamily,
      isViewer: user?.role === "viewer",
      isRestrictedAccess: user?.role === "approver" || user?.role === "viewer",
      canAccessSalaryInfo:
        canAccessSalary || Boolean(user?.can_access_salary),
      canUpdatePayslip:
        user?.role === "admin" ||
        user?.role === "hr_compben" ||
        isAprilGammad,
      refetch,
    };
  }, [user, userLoading, userError, permissionsLoading, canAccessSalary, refetch]);
}

/**
 * Clear the cached role (call on logout)
 */
export function clearUserRoleCache() {
  // Clear the current user cache as well
  const { clearCurrentUserCache } = require("./useCurrentUser");
  clearCurrentUserCache();
}