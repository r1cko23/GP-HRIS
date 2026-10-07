import { escapeIlikePattern } from "@/lib/directory/employee-search";
import {
  normalizeProseText,
  normalizeProseTextOrNull,
} from "@/lib/prose-text";

export const CANDIDATE_STAGES = [
  "prospect",
  "applicant",
  "screening",
  "submitted",
  "selected",
  "placed",
  "withdrawn",
  "rejected",
  "archived",
] as const;

export type CandidateStage = (typeof CANDIDATE_STAGES)[number];

const candidateTransitions: Record<CandidateStage, readonly CandidateStage[]> = {
  prospect: ["applicant", "archived"],
  applicant: ["screening", "withdrawn", "rejected", "archived"],
  screening: ["applicant", "submitted", "withdrawn", "rejected"],
  submitted: ["screening", "selected", "withdrawn", "rejected"],
  selected: ["screening", "placed", "withdrawn"],
  placed: ["archived"],
  withdrawn: [],
  rejected: [],
  archived: [],
};

export function canTransitionCandidate(
  from: CandidateStage,
  to: CandidateStage
): boolean {
  return candidateTransitions[from].includes(to);
}

export const CANDIDATE_CONSENT_STATUSES = [
  "pending",
  "granted",
  "withdrawn",
  "expired",
] as const;

export type CandidateConsentStatus =
  (typeof CANDIDATE_CONSENT_STATUSES)[number];

export type CandidateConversionBlocker =
  | "candidate_not_selected"
  | "consent_not_granted"
  | "identity_incomplete"
  | "already_converted";

export function isCandidateStage(value: unknown): value is CandidateStage {
  return (
    typeof value === "string" &&
    (CANDIDATE_STAGES as readonly string[]).includes(value)
  );
}

export function candidateStageLabel(stage: CandidateStage): string {
  return stage.charAt(0).toUpperCase() + stage.slice(1);
}

export function assessCandidateConversionReadiness(input: {
  status: string;
  consent_status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  mobile: string | null;
  employee_id: string | null;
}): { ready: boolean; blockers: CandidateConversionBlocker[] } {
  const blockers: CandidateConversionBlocker[] = [];
  if (input.status !== "selected") blockers.push("candidate_not_selected");
  if (input.consent_status !== "granted") blockers.push("consent_not_granted");
  if (
    !input.first_name?.trim() ||
    !input.last_name?.trim() ||
    (!input.email?.trim() && !input.mobile?.trim())
  ) {
    blockers.push("identity_incomplete");
  }
  if (input.employee_id) blockers.push("already_converted");
  return { ready: blockers.length === 0, blockers };
}

export type CandidateCreateInput = {
  first_name?: unknown;
  middle_name?: unknown;
  last_name?: unknown;
  email?: unknown;
  mobile?: unknown;
  source?: unknown;
  status?: unknown;
  consent_status?: unknown;
  available_from?: unknown;
};

export type NormalizedCandidateCreate = {
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  mobile: string | null;
  source: string | null;
  status: CandidateStage;
  consent_status: CandidateConsentStatus;
  consent_recorded_at: string | null;
  available_from: string | null;
};

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function normalizeCandidateEmail(value: unknown): string | null {
  const email = optionalString(value)?.trim().toLowerCase() ?? "";
  if (!email) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid email address");
  }
  return email;
}

export function normalizeCandidateMobile(value: unknown): string | null {
  const raw = optionalString(value)?.trim() ?? "";
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    throw new Error("Enter a valid mobile number");
  }
  return `${hasPlus ? "+" : ""}${digits}`;
}

export function normalizeCandidateCreateInput(
  input: CandidateCreateInput,
  recordedAt = new Date().toISOString()
): NormalizedCandidateCreate {
  const firstName = normalizeProseTextOrNull(optionalString(input.first_name));
  const lastName = normalizeProseTextOrNull(optionalString(input.last_name));
  if (!firstName) throw new Error("First name is required");
  if (!lastName) throw new Error("Last name is required");

  const status = input.status ?? "prospect";
  if (!isCandidateStage(status)) throw new Error("Invalid candidate stage");

  const consentStatus = input.consent_status ?? "pending";
  if (
    typeof consentStatus !== "string" ||
    !(CANDIDATE_CONSENT_STATUSES as readonly string[]).includes(consentStatus)
  ) {
    throw new Error("Invalid consent status");
  }

  const availableFrom = optionalString(input.available_from)?.trim() || null;
  if (availableFrom && !/^\d{4}-\d{2}-\d{2}$/.test(availableFrom)) {
    throw new Error("Enter a valid available date");
  }

  return {
    first_name: firstName,
    middle_name: normalizeProseTextOrNull(optionalString(input.middle_name)),
    last_name: lastName,
    email: normalizeCandidateEmail(input.email),
    mobile: normalizeCandidateMobile(input.mobile),
    source: optionalString(input.source)?.trim()
      ? normalizeProseText(optionalString(input.source)!)
      : null,
    status,
    consent_status: consentStatus as CandidateConsentStatus,
    consent_recorded_at:
      consentStatus === "granted" || consentStatus === "withdrawn"
        ? recordedAt
        : null,
    available_from: availableFrom,
  };
}

export function parseCandidateListParams(params: URLSearchParams): {
  limit: number;
  offset: number;
  q: string | null;
  stage: CandidateStage | null;
} {
  const rawLimit = Number(params.get("limit") ?? 50);
  const rawOffset = Number(params.get("offset") ?? 0);
  const limit = Math.min(
    Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 50, 1),
    200
  );
  const offset = Math.max(
    Number.isFinite(rawOffset) ? Math.floor(rawOffset) : 0,
    0
  );
  const q = params.get("q")?.trim() || null;
  const stageValue = params.get("stage")?.trim() || null;
  let stage: CandidateStage | null = null;
  if (stageValue) {
    if (!isCandidateStage(stageValue)) {
      throw new Error("Invalid candidate stage");
    }
    stage = stageValue;
  }
  return { limit, offset, q, stage };
}

export function candidateSearchFilter(q: string): string | null {
  const trimmed = q.trim();
  if (!trimmed) return null;
  const pattern = escapeIlikePattern(trimmed);
  return [
    "candidate_number",
    "first_name",
    "middle_name",
    "last_name",
    "email",
    "mobile",
  ]
    .map((column) => `${column}.ilike.%${pattern}%`)
    .join(",");
}
