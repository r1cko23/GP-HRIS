import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * PostgREST puts `.in("id", …)` in the request URL/headers.
 * ~500 UUIDs overflow undici (HeadersOverflowError) and the whole
 * debit-memo Directory join returns zero rows — GCash people then fall
 * through to ATM/cheque with a blank account. Keep each `.in()` small.
 */
export const DIRECTORY_ID_IN_CHUNK = 100;

export type DirectoryEmployeesByIdsResult<T> = {
  data: T[] | null;
  error: { message: string; details?: string; code?: string; hint?: string } | null;
};

type InQueryResult<T> = {
  data: T[] | null;
  error: DirectoryEmployeesByIdsResult<T>["error"];
};

/** Minimal shape used by payroll export routes (schema("directory") client). */
export type DirectoryEmployeesTable = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (column: string, values: string[]) => PromiseLike<InQueryResult<Record<string, unknown>>>;
    };
  };
};

export function chunkIds(ids: string[], size = DIRECTORY_ID_IN_CHUNK): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

/**
 * Load Directory employees by id in header-safe chunks.
 * Dedupes ids. Empty input → empty data, no query.
 */
export async function fetchDirectoryEmployeesByIds<T extends Record<string, unknown> = Record<string, unknown>>(
  directory: DirectoryEmployeesTable | SupabaseClient,
  ids: string[],
  select: string
): Promise<DirectoryEmployeesByIdsResult<T>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return { data: [], error: null };

  const collected: T[] = [];
  for (const part of chunkIds(unique)) {
    const { data, error } = await directory
      .from("employees")
      .select(select)
      .in("id", part);
    if (error) return { data: null, error };
    collected.push(...((data ?? []) as T[]));
  }
  return { data: collected, error: null };
}
