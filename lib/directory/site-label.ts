/**
 * Canonical site label for billing print: Directory registered business
 * name plus the site. Unique Directory branch → `Inc. - Batangas`.
 * Many sites on one branch → keep the store / role / supervisor tail.
 * Siblings never invent a second employer name (no “Nabati Batangas”).
 */

export type SiteLabelReason =
  | "client_only"
  | "unique_branch"
  | "shared_branch_local"
  | "unlinked";

export type SiteLabelPlan = {
  label: string;
  qualifier: string | null;
  reason: SiteLabelReason;
};

export type SiteLabelInput = {
  clientName: string;
  branchName?: string | null;
  localName?: string | null;
  sitesOnSameBranch: number;
};

export type LinkedSiteRow = {
  id: string;
  app: "csm" | "gp_client";
  localName: string;
  directoryClientId: string | null;
  directoryBranchId: string | null;
  existingAliases?: string[] | null;
};

export type DirectorySnap = {
  clients: Array<{ id: string; name: string }>;
  branches: Array<{ id: string; client_id: string; name: string }>;
};

export type SiteLabelChange = {
  id: string;
  app: "csm" | "gp_client";
  from: string;
  to: string;
  qualifier: string | null;
  reason: SiteLabelReason;
  unchanged: boolean;
  aliases: string[];
  directoryClientId: string | null;
  directoryBranchId: string | null;
};

/** Same join as printed billing: registered name - branch. */
const JOIN = " - ";

/** Longest-first trade prefixes to strip from a local site name. */
const LOCAL_PREFIXES = [
  "kenny rogers",
  "paris baguette",
  "city of dreams",
  "pico de loro",
  "taal vista",
  "la chicks",
  "chicha hut",
  "goldilocks",
  "popeyes",
  "yayoi",
  "nabati",
  "converge",
  "comclark",
  "dermorepubliq",
  "levelwear",
  "vonou",
  "nikkei",
  "nikke",
  "teppanya",
  "hilton",
  "conrad",
  "okada",
  "lanson",
  "smx",
];

export function foldLabel(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatSiteLabel(
  clientName: string,
  qualifier: string | null | undefined
): string {
  const employer = clientName.trim();
  if (!employer) return "";
  const tail = (qualifier ?? "").trim();
  if (!tail) return employer;
  if (containsQualifier(employer, tail)) return employer;
  return `${employer}${JOIN}${tail}`;
}

export function planSiteLabel(input: SiteLabelInput): SiteLabelPlan {
  const clientName = input.clientName.trim();
  if (!clientName) {
    return { label: "", qualifier: null, reason: "client_only" };
  }

  const branchName = input.branchName?.trim() || null;
  const uniqueBranch = Boolean(branchName) && input.sitesOnSameBranch <= 1;

  if (uniqueBranch && branchName) {
    if (containsQualifier(clientName, branchName)) {
      return { label: clientName, qualifier: null, reason: "client_only" };
    }
    return {
      label: formatSiteLabel(clientName, branchName),
      qualifier: branchName,
      reason: "unique_branch",
    };
  }

  if (input.sitesOnSameBranch > 1) {
    const qualifier = localQualifier(input.localName ?? "", clientName);
    return {
      label: formatSiteLabel(clientName, qualifier),
      qualifier,
      reason: "shared_branch_local",
    };
  }

  return { label: clientName, qualifier: null, reason: "client_only" };
}

/** Keep prior nicknames so transmittal sheets still match after a rename. */
export function mergeNameAliases(
  existing: string[] | null | undefined,
  previousName: string,
  nextName: string
): string[] {
  const next = nextName.trim();
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...(existing ?? []), previousName]) {
    const alias = raw.trim();
    if (!alias || alias === next || seen.has(alias)) continue;
    seen.add(alias);
    out.push(alias);
  }
  return out;
}

export function planLinkedSiteLabels(
  rows: LinkedSiteRow[],
  directory: DirectorySnap
): SiteLabelChange[] {
  const clients = new Map(directory.clients.map((row) => [row.id, row.name]));
  const branches = new Map(
    directory.branches.map((row) => [row.id, row] as const)
  );

  const siblingCount = new Map<string, number>();
  for (const row of rows) {
    if (!row.directoryClientId || !row.directoryBranchId) continue;
    const key = `${row.app}:${row.directoryBranchId}`;
    siblingCount.set(key, (siblingCount.get(key) ?? 0) + 1);
  }

  return rows.map((row) => {
    if (!row.directoryClientId) {
      return {
        id: row.id,
        app: row.app,
        from: row.localName,
        to: row.localName,
        qualifier: null,
        reason: "unlinked" as const,
        unchanged: true,
        aliases: mergeNameAliases(
          row.existingAliases,
          row.localName,
          row.localName
        ),
        directoryClientId: null,
        directoryBranchId: row.directoryBranchId,
      };
    }

    const clientName = clients.get(row.directoryClientId) ?? "";
    const branch = row.directoryBranchId
      ? branches.get(row.directoryBranchId)
      : undefined;
    const sitesOnSameBranch = row.directoryBranchId
      ? siblingCount.get(`${row.app}:${row.directoryBranchId}`) ?? 0
      : 0;

    const planned = planSiteLabel({
      clientName,
      branchName: branch?.name ?? null,
      localName: row.localName,
      sitesOnSameBranch,
    });

    return {
      id: row.id,
      app: row.app,
      from: row.localName,
      to: planned.label,
      qualifier: planned.qualifier,
      reason: planned.reason,
      unchanged: row.localName === planned.label,
      aliases: mergeNameAliases(
        row.existingAliases,
        row.localName,
        planned.label
      ),
      directoryClientId: row.directoryClientId,
      directoryBranchId: row.directoryBranchId,
    };
  });
}

function containsQualifier(employer: string, qualifier: string): boolean {
  const hay = ` ${foldLabel(employer)} `;
  const needle = foldLabel(qualifier);
  if (!needle) return true;
  return hay.includes(` ${needle} `);
}

function localQualifier(localName: string, clientName: string): string | null {
  const raw = localName.trim();
  if (!raw) return null;

  const afterClient = stripFoldedPrefix(raw, foldLabel(clientName));
  if (afterClient != null) return tidyQualifier(afterClient);

  for (const prefix of LOCAL_PREFIXES) {
    const afterAlias = stripFoldedPrefix(raw, prefix);
    if (afterAlias != null) return tidyQualifier(afterAlias);
  }

  if (foldLabel(raw) === foldLabel(clientName)) return null;
  return tidyQualifier(raw);
}

function stripFoldedPrefix(original: string, prefixFold: string): string | null {
  if (!prefixFold) return null;
  const compact = original.replace(/\s+/g, " ").trim();
  const folded = foldLabel(compact);
  if (!folded.startsWith(prefixFold)) return null;
  const leftoverFold = folded.slice(prefixFold.length).trim();
  if (!leftoverFold) return "";
  for (let i = 0; i < compact.length; i++) {
    const slice = compact.slice(i).replace(/^[\s\-–—:|/.]+/, "").trim();
    if (slice && foldLabel(slice) === leftoverFold) return slice;
  }
  return leftoverFold;
}

function tidyQualifier(value: string): string | null {
  const cleaned = value
    .replace(/^[\s\-–—:|/.]+/, "")
    .replace(/\s+/g, " ")
    .replace(/^edd\s+/i, "")
    .trim();
  return cleaned || null;
}

/** Matches GP-Client unique index clients_name_normalized_key. */
export function gpClientNameKey(name: string): string {
  return name.replace(/\s+/g, " ").trim().toLowerCase();
}

export function collidingSiteLabels(
  rows: Array<{ id: string; to: string }>
): Array<{ key: string; ids: string[] }> {
  const byKey = new Map<string, string[]>();
  for (const row of rows) {
    const key = gpClientNameKey(row.to);
    if (!key) continue;
    const list = byKey.get(key) ?? [];
    list.push(row.id);
    byKey.set(key, list);
  }
  return [...byKey.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([key, ids]) => ({ key, ids }));
}
