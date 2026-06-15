import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyAdminAccess, clearUserRoleCache } from "@/lib/api-helpers";
import { cleanupUserReferences, findRemainingUserReferences } from "@/lib/user-delete-cleanup";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function DELETE(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        { error: "Server not configured" },
        { status: 500 }
      );
    }

    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json(
        { error: "Missing required field: userId" },
        { status: 400 }
      );
    }

    if (userId === authUser.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data: targetUser, error: fetchError } = await supabaseAdmin
      .from("users")
      .select("id, email, full_name, role")
      .eq("id", userId)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: "Failed to look up user", details: fetchError.message },
        { status: 500 }
      );
    }

    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found in members list" },
        { status: 404 }
      );
    }

    let cleanup;
    try {
      cleanup = await cleanupUserReferences(
        supabaseAdmin,
        userId,
        authUser.userId
      );
    } catch (cleanupError) {
      const message =
        cleanupError instanceof Error
          ? cleanupError.message
          : "Failed to clear user references";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    const remainingRefs = await findRemainingUserReferences(
      supabaseAdmin,
      userId
    );
    if (remainingRefs.length > 0) {
      const detail = remainingRefs
        .map((ref) => `${ref.table}.${ref.column} (${ref.count})`)
        .join(", ");
      return NextResponse.json(
        {
          error: "User is still linked to other records and cannot be deleted yet.",
          details: detail,
        },
        { status: 409 }
      );
    }

    const { error: deleteUserError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", userId);

    if (deleteUserError) {
      console.error("Error deleting user from users table:", deleteUserError);
      return NextResponse.json(
        {
          error: "Failed to delete user record",
          details: deleteUserError.message,
        },
        { status: 500 }
      );
    }

    const { error: deleteAuthError } =
      await supabaseAdmin.auth.admin.deleteUser(userId);

    if (
      deleteAuthError &&
      !deleteAuthError.message.toLowerCase().includes("not found")
    ) {
      console.warn(
        "User row deleted but auth removal failed:",
        deleteAuthError.message
      );
    }

    clearUserRoleCache(userId);

    return NextResponse.json(
      {
        success: true,
        message: "User deleted successfully",
        cleanup,
        authRemoved: !deleteAuthError,
        authNote: deleteAuthError
          ? "No login account existed for this member (profile-only row removed)."
          : undefined,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    console.error("Error deleting user:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        error: "Internal server error",
        details: message,
      },
      { status: 500 }
    );
  }
}
