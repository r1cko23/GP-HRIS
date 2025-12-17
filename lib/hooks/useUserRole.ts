/**
 * Custom hook to get the current user's role
 * Used for role-based rendering and access control
 *
 * OPTIMIZATIONS:
 * - Session-level caching to prevent redundant API calls
 * - Memoized return values to prevent unnecessary re-renders
 * - Singleton Supabase client usage
 */

import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

type UserRole =
  | Database["public"]["Tables"]["users"]["Row"]["role"]
  | "account_manager";

interface UserRoleData {
  role: UserRole | null;
  loading: boolean;
  error: string | null;
  isAdmin: boolean;
  isHR: boolean;
  isAccountManager: boolean;
  refetch: () => void;
}

// Session-level cache for user role data
let cachedRole: UserRole | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export function useUserRole(): UserRoleData {
  const [role, setRole] = useState<UserRole | null>(cachedRole);
  const [loading, setLoading] = useState(!cachedRole);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);
  const supabase = createClient();

  const fetchUserRole = useCallback(
    async (force = false) => {
      // Check cache validity
      const now = Date.now();
      if (!force && cachedRole && now - cacheTimestamp < CACHE_DURATION) {
        setRole(cachedRole);
        setLoading(false);
        return;
      }

      // Prevent duplicate fetches
      if (fetchedRef.current && !force) return;
      fetchedRef.current = true;

      try {
        setLoading(true);

        // Get current authenticated user
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          setError("No authenticated user");
          setLoading(false);
          return;
        }

        // Get user role from users table
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .single();

        if (userError) {
          throw userError;
        }

        const userRecord = userData as { role: UserRole };

        // Update cache
        cachedRole = userRecord.role;
        cacheTimestamp = Date.now();

        setRole(userRecord.role);
      } catch (err) {
        console.error("Error fetching user role:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  useEffect(() => {
    fetchUserRole();
  }, [fetchUserRole]);

  // Memoize return value to prevent unnecessary re-renders
  return useMemo(
    () => ({
      role,
      loading,
      error,
      isAdmin: role === "admin",
      isHR: role === "hr",
      isAccountManager: role === "account_manager",
      refetch: () => fetchUserRole(true),
    }),
    [role, loading, error, fetchUserRole]
  );
}

/**
 * Clear the cached role (call on logout)
 */
export function clearUserRoleCache() {
  cachedRole = null;
  cacheTimestamp = 0;
}
