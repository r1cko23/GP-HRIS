/**
 * Custom hook to get the current user's assigned overtime groups
 * Returns group IDs where the user is assigned as approver or viewer on
 * `overtime_groups`, plus employee IDs where the user is individual
 * `overtime_approver_id` / `overtime_viewer_id` (matches OT / leave scoping).
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface AssignedGroupsData {
  groupIds: string[];
  /** Employees where this user is overtime_approver_id or overtime_viewer_id */
  managedEmployeeIds: string[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAssignedGroups(): AssignedGroupsData {
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [managedEmployeeIds, setManagedEmployeeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const fetchAssignedGroups = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current authenticated user
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        setGroupIds([]);
        setManagedEmployeeIds([]);
        setLoading(false);
        return;
      }

      // Get user role to check if they're admin or HR (both see all)
      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      if (userError) {
        throw userError;
      }

      // Admins see all groups (return empty array means no filtering)
      // HR users need to have group assignments returned to check if they're group approvers
      // (HR users bypass group filtering for viewing, but need group approver status for approval)
      if (userData?.role === "admin") {
        setGroupIds([]);
        setManagedEmployeeIds([]);
        setLoading(false);
        return;
      }

      // Find groups where this user is approver or viewer, and employees with individual assignment
      const [
        { data: approverGroups, error: approverError },
        { data: viewerGroups, error: viewerError },
        { data: managedRows, error: managedError },
      ] = await Promise.all([
        supabase.from("overtime_groups").select("id").eq("approver_id", user.id),
        supabase.from("overtime_groups").select("id").eq("viewer_id", user.id),
        supabase
          .from("employees")
          .select("id")
          .or(`overtime_approver_id.eq.${user.id},overtime_viewer_id.eq.${user.id}`),
      ]);

      if (approverError) {
        throw approverError;
      }

      if (viewerError) {
        throw viewerError;
      }

      if (managedError) {
        throw managedError;
      }

      // Combine unique group IDs
      const allGroupIds = [
        ...(approverGroups || []).map((g) => g.id),
        ...(viewerGroups || []).map((g) => g.id),
      ];
      const uniqueGroupIds = Array.from(new Set(allGroupIds));
      const uniqueManagedIds = Array.from(
        new Set((managedRows || []).map((r) => r.id))
      );

      setGroupIds(uniqueGroupIds);
      setManagedEmployeeIds(uniqueManagedIds);
    } catch (err) {
      console.error("Error fetching assigned groups:", err);
      setError(err instanceof Error ? err.message : "Unknown error");
      setGroupIds([]);
      setManagedEmployeeIds([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAssignedGroups();
  }, [fetchAssignedGroups]);

  return {
    groupIds,
    managedEmployeeIds,
    loading,
    error,
    refetch: fetchAssignedGroups,
  };
}