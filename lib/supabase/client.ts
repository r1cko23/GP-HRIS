"use client";

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import type { Database } from "@/types/database";
import { browserPublicSupabaseUrl } from "@/lib/supabase/public-url";

/**
 * Singleton Supabase client for Client Components
 * Prevents creating multiple client instances which improves performance
 * and reduces memory usage.
 *
 * URL follows the browser host (.com office / .ph Cloudflare) so Kong
 * same-origin proxy works for both.
 */
let supabaseClient: ReturnType<
  typeof createClientComponentClient<Database>
> | null = null;
let supabaseClientUrl: string | null = null;

export const createClient = () => {
  const url = browserPublicSupabaseUrl();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseClient || supabaseClientUrl !== url) {
    supabaseClient = createClientComponentClient<Database>(
      key
        ? { supabaseUrl: url, supabaseKey: key }
        : undefined
    );
    supabaseClientUrl = url;
  }
  return supabaseClient;
};/**
 * Reset the client (useful for testing or logout)
 */
export const resetClient = () => {
  supabaseClient = null;
  supabaseClientUrl = null;
};