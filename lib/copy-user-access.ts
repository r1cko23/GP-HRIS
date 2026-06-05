/**
 * Copy dashboard access from one user to another (handoff / replacement).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { clearPermissionsCache } from "@/lib/hooks/usePermissions";

export interface CopyUserAccessOptions {
  /** Copy stored permissions JSON (null = role template only). */
  copyPermissions?: boolean;
  copySalaryAccess?: boolean;
  /** Reassign overtime_groups approver_id / viewer_id from source. */
  copyOtGroups?: boolean;
}

export interface CopyUserAccessResult {
  copiedPermissions: boolean;
  copiedSalaryAccess: boolean;
  copiedOtGroups: number;
}

type Client = SupabaseClient<Database>;

export async function copyUserAccess(
  supabase: Client,
  sourceUserId: string,
  targetUserId: string,
  options: CopyUserAccessOptions = {}
): Promise<CopyUserAccessResult> {
  const {
    copyPermissions = true,
    copySalaryAccess = true,
    copyOtGroups = true,
  } = options;

  const { data: source, error: sourceError } = await supabase
    .from("users")
    .select("id, role, permissions, can_access_salary")
    .eq("id", sourceUserId)
    .single();

  if (sourceError || !source) {
    throw new Error("Could not load the colleague to copy from.");
  }

  const sourceRow = source as {
    role: string;
    permissions: unknown;
    can_access_salary: boolean | null;
  };

  const result: CopyUserAccessResult = {
    copiedPermissions: false,
    copiedSalaryAccess: false,
    copiedOtGroups: 0,
  };

  const db = supabase as SupabaseClient;

  if (copyPermissions) {
    const { error } = await db.rpc("set_user_permissions", {
      p_target_user_id: targetUserId,
      p_permissions: sourceRow.permissions ?? null,
    } as never);
    if (error) throw error;
    result.copiedPermissions = true;
  }

  if (copySalaryAccess && sourceRow.role !== "admin") {
    const { error } = await db.rpc("set_user_salary_access", {
      p_target_user_id: targetUserId,
      p_can_access_salary: Boolean(sourceRow.can_access_salary),
    } as never);
    if (error) throw error;
    result.copiedSalaryAccess = true;
  }

  if (copyOtGroups && (sourceRow.role === "approver" || sourceRow.role === "viewer")) {
    const field = sourceRow.role === "approver" ? "approver_id" : "viewer_id";
    const { data: groups, error: groupsError } = await supabase
      .from("overtime_groups")
      .select("id")
      .eq(field, sourceUserId);

    if (groupsError) throw groupsError;

    await (supabase.from("overtime_groups") as any)
      .update({ [field]: null })
      .eq(field, targetUserId);

    for (const group of groups ?? []) {
      const { error } = await (supabase.from("overtime_groups") as any)
        .update({ [field]: targetUserId })
        .eq("id", (group as { id: string }).id);
      if (error) throw error;
      result.copiedOtGroups += 1;
    }
  }

  clearPermissionsCache();
  return result;
}
