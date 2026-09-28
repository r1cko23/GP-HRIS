/**
 * Resolve a free-text job title onto directory.positions for a Client.
 * Matches case-insensitively; creates a card when none exists.
 */

export type PositionLookupRow = {
  id: string;
  job_title: string | null;
};

function foldTitle(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pure match — first exact fold match wins (stable for duplicate titles). */
export function matchPositionByTitle(
  cards: PositionLookupRow[],
  jobTitle: string
): PositionLookupRow | null {
  const needle = foldTitle(jobTitle);
  if (!needle) return null;
  return cards.find((row) => foldTitle(row.job_title ?? "") === needle) ?? null;
}

export type FindOrCreatePositionDeps = {
  listByClient: () => Promise<PositionLookupRow[]>;
  insert: (jobTitle: string) => Promise<{ id: string }>;
};

/**
 * Find an existing Client position by title, or insert one.
 * Empty / whitespace title → null id (clear assignment).
 */
export async function findOrCreateClientPosition(
  deps: FindOrCreatePositionDeps,
  jobTitle: string | null | undefined
): Promise<
  | { ok: true; position_id: string | null; created: boolean }
  | { ok: false; error: string }
> {
  const title = (jobTitle ?? "").trim();
  if (!title) return { ok: true, position_id: null, created: false };

  let cards: PositionLookupRow[];
  try {
    cards = await deps.listByClient();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to list positions",
    };
  }

  const hit = matchPositionByTitle(cards, title);
  if (hit) return { ok: true, position_id: hit.id, created: false };

  try {
    const inserted = await deps.insert(title);
    return { ok: true, position_id: inserted.id, created: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to create position",
    };
  }
}
