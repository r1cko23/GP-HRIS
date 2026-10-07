"use server";

import { createClient } from "@/lib/supabase/server";
import { getAdminClient } from "@/lib/supabase/admin";

export type CompletePasswordChangeResult = { error?: string };

export async function completePasswordChange(): Promise<CompletePasswordChangeResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expired. Sign in again." };
  }

  const admin = getAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    app_metadata: {
      ...(user.app_metadata ?? {}),
      must_change_password: false,
    },
  });

  if (error) {
    return { error: error.message };
  }
  return {};
}
