/**
 * Person-file cleaning: keep every 201 row, pick one current engagement,
 * and queue ambiguous same-SSS / name+DOB groups for HR.
 *
 * Never deletes. Extra files are superseded and searchable via aliases.
 */
import { compareEngagements } from "@/lib/directory/legacy-status";
import {
  effectiveEngagementStatus,
  isAgedUnclaimedFinalPay,
} from "@/lib/directory/lifecycle";
import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";

export type DedupPersonRow = {
  id: string;
  organization_id?: string;
  person_key?: string | null;
  employee_code?: string | null;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  birth_date?: string | null;
  sss_number?: string | null;
  tin?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  bank_account_no?: string | null;
  status: string;
  hire_date?: string | null;
  first_hire_date?: string | null;
  resign_date?: string | null;
  last_payroll_end?: string | null;
  legacy_id?: number | null;
  is_current_engagement: boolean;
  superseded_by?: string | null;
  client_id?: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
};

export type DuplicateConfidence = "auto" | "review";

export type DuplicateKind =
  | "split_current"
  | "same_sss"
  | "same_tin"
  | "same_philhealth"
  | "same_pagibig"
  | "same_bank"
  | "name_dob";

export type DuplicateGroup = {
  kind: DuplicateKind;
  confidence: DuplicateConfidence;
  key: string;
  member_ids: string[];
  members: DedupPersonRow[];
};

export type DuplicateClassification = {
  split_current: DuplicateGroup[];
  same_sss: DuplicateGroup[];
  same_tin: DuplicateGroup[];
  same_philhealth: DuplicateGroup[];
  same_pagibig: DuplicateGroup[];
  same_bank: DuplicateGroup[];
  name_dob: DuplicateGroup[];
};

/** Auto-collapsible identity kinds (bank stays review-only). */
export const AUTO_ID_COLLAPSE_KINDS: DuplicateKind[] = [
  "split_current",
  "same_sss",
  "same_tin",
  "same_philhealth",
  "same_pagibig",
  "name_dob",
];

export type CollapseLoserPatch = {
  id: string;
  is_current_engagement: false;
  superseded_by: string;
};

export type CollapseMasterPatch = {
  is_current_engagement: true;
  superseded_by: null;
  status: string;
  hire_date: string | null;
  first_hire_date: string | null;
  resign_date: null;
  client_id?: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate?: number;
};

export type CollapseAlias = {
  alias_code: string | null;
  legacy_id: number | null;
  source_employee_id: string;
};

export type CollapsePlan =
  | { action: "noop" }
  | {
      action: "collapse";
      masterId: string;
      liveSourceId: string;
      keep_employee_code: string | null;
      masterPatch: CollapseMasterPatch;
      loserPatches: CollapseLoserPatch[];
      aliases: CollapseAlias[];
    };

export type HireIdentityMatch =
  | { action: "create" }
  | {
      action: "conflict";
      reason: "sss";
      existing: DedupPersonRow;
    };

export function idDigits(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\D/g, "");
}

/** Statutory / bank IDs that are too short or dummy (all zeros / one repeating digit). */
export function isUsableIdDigits(
  value: string | null | undefined,
  minLength: number
): boolean {
  const digits = idDigits(value);
  if (digits.length < minLength) return false;
  if (/^0+$/.test(digits)) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/** SSS numbers that are too short or dummy (all zeros / one repeating digit). */
export function isUsableSss(value: string | null | undefined): boolean {
  return isUsableIdDigits(value, 8);
}

export function isUsableTin(value: string | null | undefined): boolean {
  return isUsableIdDigits(value, 9);
}

export function isUsablePhilhealth(value: string | null | undefined): boolean {
  return isUsableIdDigits(value, 10);
}

export function isUsablePagibig(value: string | null | undefined): boolean {
  return isUsableIdDigits(value, 8);
}

export function isUsableBank(value: string | null | undefined): boolean {
  return isUsableIdDigits(value, 8);
}

function asRate(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return roundDailyRate4(n);
}

function dateKey(value: string | null | undefined): string {
  return value ? String(value).slice(0, 10) : "";
}

/** SQL Server empty dates land as 1900-01-01 (and similar). Not a real hire. */
function realDate(value: string | null | undefined): string {
  const key = dateKey(value);
  if (!key) return "";
  const year = Number(key.slice(0, 4));
  if (!Number.isFinite(year) || year < 1990 || year > 2100) return "";
  return key;
}

function earliestHire(row: DedupPersonRow): string {
  return realDate(row.first_hire_date) || realDate(row.hire_date);
}

function personNameKey(row: DedupPersonRow): string | null {
  const last = (row.last_name ?? "").trim().toUpperCase();
  const first = (row.first_name ?? "").trim().toUpperCase();
  if (!last || !first) return null;
  return `${last}|${first}`;
}

function currentNamesAgree(members: DedupPersonRow[]): boolean {
  const current = members.filter((row) => row.is_current_engagement);
  if (current.length < 2) return false;
  const keys = current.map(personNameKey);
  if (keys.some((key) => !key)) return false;
  return new Set(keys).size === 1;
}

function nameDobKey(row: DedupPersonRow): string | null {
  const last = (row.last_name ?? "").trim().toUpperCase();
  const first = (row.first_name ?? "").trim().toUpperCase();
  const dob = dateKey(row.birth_date);
  if (!last || !first || !dob) return null;
  return `${last}|${first}|${dob}`;
}

function lastPayKey(row: DedupPersonRow): string {
  return realDate(row.last_payroll_end);
}

/** Exactly one current 201 has a last payout — that file is the person. */
function payrollPointsToOnePerson(members: DedupPersonRow[]): boolean {
  const current = members.filter((row) => row.is_current_engagement);
  if (current.length < 2) return false;
  return current.filter((row) => lastPayKey(row)).length === 1;
}

/** Unpaid or aged for-release is not a live final-pay file. */
function rankingStatus(row: DedupPersonRow, asOf: Date): string {
  if (row.status === "for_release") {
    if (isAgedUnclaimedFinalPay(row.last_payroll_end, asOf)) return "barred";
    if (!lastPayKey(row)) return "barred";
  }
  return row.status;
}

function pickIdentityMaster(current: DedupPersonRow[]): DedupPersonRow {
  return [...current].sort((a, b) => {
    const ah = earliestHire(a);
    const bh = earliestHire(b);
    if (ah && bh && ah !== bh) return ah.localeCompare(bh);
    if (ah && !bh) return -1;
    if (!ah && bh) return 1;
    const ap = lastPayKey(a) ? 0 : 1;
    const bp = lastPayKey(b) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    const al = a.legacy_id ?? Number.MAX_SAFE_INTEGER;
    const bl = b.legacy_id ?? Number.MAX_SAFE_INTEGER;
    if (al !== bl) return al - bl;
    return a.id.localeCompare(b.id);
  })[0];
}

function pickLiveSource(group: DedupPersonRow[], asOf: Date): DedupPersonRow {
  return [...group].sort((a, b) => {
    const statusCmp = compareEngagements(
      { status: rankingStatus(a, asOf), hire_date: null, legacy_id: 0 },
      { status: rankingStatus(b, asOf), hire_date: null, legacy_id: 0 }
    );
    if (statusCmp !== 0) return statusCmp;
    const ap = lastPayKey(a);
    const bp = lastPayKey(b);
    if (ap && bp && ap !== bp) return bp.localeCompare(ap);
    if (ap && !bp) return -1;
    if (!ap && bp) return 1;
    return compareEngagements(
      {
        status: rankingStatus(a, asOf),
        hire_date: realDate(a.hire_date) || a.hire_date,
        legacy_id: a.legacy_id,
        employee_code: a.employee_code,
      },
      {
        status: rankingStatus(b, asOf),
        hire_date: realDate(b.hire_date) || b.hire_date,
        legacy_id: b.legacy_id,
        employee_code: b.employee_code,
      }
    );
  })[0];
}

function earliestFirstHire(group: DedupPersonRow[]): string | null {
  let earliest: string | null = null;
  for (const row of group) {
    const hire = earliestHire(row);
    if (!hire) continue;
    if (!earliest || hire < earliest) earliest = hire;
  }
  return earliest;
}

/**
 * Same person_key, more than one current 201: keep the existing master UUID,
 * copy the live engagement onto it, park extras. Does not delete.
 * Live status uses last payout: aged for-release (≥ 3 years unclaimed) is barred.
 */
export function planCollapseSplitCurrent(
  group: DedupPersonRow[],
  options?: { asOf?: Date }
): CollapsePlan {
  if (group.length <= 1) return { action: "noop" };

  const asOf = options?.asOf ?? new Date();
  const current = group.filter((row) => row.is_current_engagement);
  if (current.length <= 1) return { action: "noop" };

  const master = pickIdentityMaster(current);
  const live = pickLiveSource(current, asOf);
  const extras = current.filter((row) => row.id !== master.id);
  const firstHire = earliestFirstHire(group);

  const masterPatch: CollapseMasterPatch = {
    is_current_engagement: true,
    superseded_by: null,
    status: effectiveEngagementStatus(live.status, live.last_payroll_end, asOf),
    hire_date: realDate(live.hire_date) || realDate(master.hire_date) || null,
    first_hire_date: firstHire,
    resign_date: null,
  };

  if (live.id !== master.id) {
    masterPatch.client_id = live.client_id ?? master.client_id ?? null;
    masterPatch.branch_id = live.branch_id ?? master.branch_id ?? null;
    masterPatch.position_id = live.position_id ?? master.position_id ?? null;
    const lifted = asRate(live.daily_rate);
    if (lifted != null) masterPatch.daily_rate = lifted;
  }

  const aliases: CollapseAlias[] = extras
    .filter((row) => row.employee_code || row.legacy_id != null)
    .map((row) => ({
      alias_code: row.employee_code ?? null,
      legacy_id: row.legacy_id ?? null,
      source_employee_id: row.id,
    }));

  return {
    action: "collapse",
    masterId: master.id,
    liveSourceId: live.id,
    keep_employee_code: master.employee_code ?? null,
    masterPatch,
    loserPatches: extras.map((row) => ({
      id: row.id,
      is_current_engagement: false as const,
      superseded_by: master.id,
    })),
    aliases,
  };
}

function groupKey(prefix: string, row: DedupPersonRow, rest: string | null): string | null {
  if (!rest) return null;
  return `${row.organization_id ?? ""}|${prefix}|${rest}`;
}

function groupBy<T>(items: T[], keyOf: (item: T) => string | null): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(item);
    map.set(key, list);
  }
  return map;
}

function classifySharedIdGroups(
  rows: DedupPersonRow[],
  kind: Exclude<DuplicateKind, "split_current" | "name_dob">,
  prefix: string,
  digitsOf: (row: DedupPersonRow) => string | null,
  confidenceOf: (members: DedupPersonRow[]) => DuplicateConfidence
): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const byId = groupBy(rows, (row) => groupKey(prefix, row, digitsOf(row)));
  for (const [key, members] of byId) {
    if (members.length <= 1) continue;
    const currentCount = members.filter((row) => row.is_current_engagement).length;
    if (currentCount <= 1) continue;
    const personKeys = new Set(
      members.map((row) => row.person_key ?? row.id).filter(Boolean)
    );
    if (personKeys.size <= 1) continue;
    groups.push({
      kind,
      confidence: confidenceOf(members),
      key,
      member_ids: members.map((row) => row.id),
      members,
    });
  }
  return groups;
}

export function classifyDuplicateGroups(
  rows: DedupPersonRow[]
): DuplicateClassification {
  const split_current: DuplicateGroup[] = [];
  const byPerson = groupBy(
    rows.filter((row) => row.person_key),
    (row) => groupKey("pk", row, row.person_key ?? null)
  );
  for (const [key, members] of byPerson) {
    const currentCount = members.filter((row) => row.is_current_engagement).length;
    if (currentCount <= 1) continue;
    split_current.push({
      kind: "split_current",
      confidence: "auto",
      key,
      member_ids: members.map((row) => row.id),
      members,
    });
  }

  const nameConfidence = (members: DedupPersonRow[]): DuplicateConfidence =>
    currentNamesAgree(members) ? "auto" : "review";

  const same_sss = classifySharedIdGroups(
    rows,
    "same_sss",
    "sss",
    (row) => (isUsableSss(row.sss_number) ? idDigits(row.sss_number) : null),
    nameConfidence
  );
  const same_tin = classifySharedIdGroups(
    rows,
    "same_tin",
    "tin",
    (row) => (isUsableTin(row.tin) ? idDigits(row.tin) : null),
    nameConfidence
  );
  const same_philhealth = classifySharedIdGroups(
    rows,
    "same_philhealth",
    "ph",
    (row) =>
      isUsablePhilhealth(row.philhealth_number)
        ? idDigits(row.philhealth_number)
        : null,
    nameConfidence
  );
  const same_pagibig = classifySharedIdGroups(
    rows,
    "same_pagibig",
    "hdmf",
    (row) =>
      isUsablePagibig(row.pagibig_number) ? idDigits(row.pagibig_number) : null,
    nameConfidence
  );
  const same_bank = classifySharedIdGroups(
    rows,
    "same_bank",
    "bank",
    (row) =>
      isUsableBank(row.bank_account_no) ? idDigits(row.bank_account_no) : null,
    () => "review"
  );

  const name_dob: DuplicateGroup[] = [];
  const byNameDob = groupBy(rows, (row) =>
    groupKey("nd", row, nameDobKey(row))
  );
  for (const [key, members] of byNameDob) {
    if (members.length <= 1) continue;
    const currentCount = members.filter((row) => row.is_current_engagement).length;
    if (currentCount <= 1) continue;
    const personKeys = new Set(
      members.map((row) => row.person_key ?? row.id).filter(Boolean)
    );
    if (personKeys.size <= 1) continue;
    name_dob.push({
      kind: "name_dob",
      confidence: payrollPointsToOnePerson(members) ? "auto" : "review",
      key,
      member_ids: members.map((row) => row.id),
      members,
    });
  }

  return {
    split_current,
    same_sss,
    same_tin,
    same_philhealth,
    same_pagibig,
    same_bank,
    name_dob,
  };
}

export type RequestedCollapse =
  | { ok: true; plan: Extract<CollapsePlan, { action: "collapse" }> }
  | {
      ok: false;
      error: string;
      status: number;
      keep_id?: string;
      keep_employee_code?: string | null;
    };

/**
 * HR asked to park extras under `requestedMasterId`.
 * Identity master must stay the original 201 (ADR 0006).
 */
export function collapseFromRequestedMaster(
  rows: DedupPersonRow[],
  requestedMasterId: string
): RequestedCollapse {
  const plan = planCollapseSplitCurrent(rows);
  if (plan.action !== "collapse") {
    return {
      ok: false,
      error: "These files are not two current engagements for the same person",
      status: 409,
    };
  }
  if (plan.masterId !== requestedMasterId) {
    return {
      ok: false,
      error: `Keep the original 201 as the live file (${plan.keep_employee_code ?? plan.masterId}). Open that 201 and park the extra from there.`,
      status: 409,
      keep_id: plan.masterId,
      keep_employee_code: plan.keep_employee_code,
    };
  }
  return { ok: true, plan };
}

function autoGroupsForKind(
  classified: DuplicateClassification,
  kind: DuplicateKind
): DuplicateGroup[] {
  switch (kind) {
    case "split_current":
      return classified.split_current;
    case "same_sss":
      return classified.same_sss.filter((group) => group.confidence === "auto");
    case "same_tin":
      return classified.same_tin.filter((group) => group.confidence === "auto");
    case "same_philhealth":
      return classified.same_philhealth.filter(
        (group) => group.confidence === "auto"
      );
    case "same_pagibig":
      return classified.same_pagibig.filter(
        (group) => group.confidence === "auto"
      );
    case "same_bank":
      return []; // bank is always review
    case "name_dob":
      return classified.name_dob.filter((group) => group.confidence === "auto");
  }
}

export function collapsePlansForRows(
  rows: DedupPersonRow[],
  options?: { kinds?: DuplicateKind[] }
): Array<Extract<CollapsePlan, { action: "collapse" }>> {
  const kinds = options?.kinds ?? [
    "split_current",
    "same_sss",
    "same_tin",
    "same_philhealth",
    "same_pagibig",
    "name_dob",
  ];
  const classified = classifyDuplicateGroups(rows);
  const groups = kinds.flatMap((kind) => autoGroupsForKind(classified, kind));
  const parked = new Set<string>();
  const plans: Array<Extract<CollapsePlan, { action: "collapse" }>> = [];
  for (const group of groups) {
    const effective = group.members.map((member) =>
      parked.has(member.id)
        ? { ...member, is_current_engagement: false }
        : member
    );
    const plan = planCollapseSplitCurrent(effective);
    if (plan.action !== "collapse") continue;
    plans.push(plan);
    for (const loser of plan.loserPatches) parked.add(loser.id);
  }
  return plans;
}

export function matchExistingPersonForHire(
  input: {
    last_name: string;
    first_name: string;
    sss_number?: string | null;
    force_create?: boolean;
  },
  existing: DedupPersonRow[]
): HireIdentityMatch {
  if (input.force_create) return { action: "create" };
  if (!isUsableSss(input.sss_number)) return { action: "create" };

  const want = idDigits(input.sss_number);
  const hits = existing.filter(
    (row) => isUsableSss(row.sss_number) && idDigits(row.sss_number) === want
  );
  if (hits.length === 0) return { action: "create" };

  const preferred =
    hits.find((row) => row.is_current_engagement) ??
    hits.find((row) => row.status === "active") ??
    hits[0];

  return { action: "conflict", reason: "sss", existing: preferred };
}

export function hireConflictMessage(match: Extract<HireIdentityMatch, { action: "conflict" }>): string {
  const code = match.existing.employee_code
    ? ` (${match.existing.employee_code})`
    : "";
  return `Person already on file${code}. Open their 201 and use Rehire — do not create a second employee.`;
}

/**
 * Extra 201 codes are often already aliased to themselves.
 * Retarget that row onto the master. Never steal a code owned by a third person.
 */
export function aliasConflictAction(
  existingEmployeeId: string,
  masterId: string,
  extraIds: string[]
): "retarget" | "skip" {
  if (existingEmployeeId === masterId) return "skip";
  if (extraIds.includes(existingEmployeeId)) return "retarget";
  return "skip";
}
