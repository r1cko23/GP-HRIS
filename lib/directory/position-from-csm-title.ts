import { roundDailyRate4 } from "@/lib/ph-payroll/rate-precision";
import { siteFromJobTitle } from "./site-from-job-title";

export type DirectoryPositionCard = {
  id: string;
  job_title: string;
  payroll_daily_rate: number | string | null;
};

export type PositionFromCsmPlan =
  | { action: "noop" }
  | { action: "skip"; reason: string }
  | {
      action: "assign";
      employeeId: string;
      position_id: string;
      job_title: string;
      daily_rate: number;
      keep_employee_code: string | null;
    };

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function rankFrom(text: string): "jr" | "sr" | null {
  const f = fold(text);
  if (/\b(jr|junior)\b/.test(f)) return "jr";
  if (/\b(sr|senior)\b/.test(f)) return "sr";
  return null;
}

function familyFrom(text: string): string {
  return fold(text)
    .replace(/\b(jr|junior|sr|senior)\b/g, " ")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\d+(\.\d+)?/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asRate(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map a CSM Verified position *text* onto a Directory position card at the
 * destination site. Does not invent a card or a rate. Does not copy billing.
 */
export function planPositionFromCsmTitle(input: {
  employeeId: string;
  employee_code: string | null;
  current_position_id: string | null;
  daily_rate: number | string | null;
  csm_position: string | null | undefined;
  destination_site: string;
  cards: DirectoryPositionCard[];
}): PositionFromCsmPlan {
  const csmTitle = (input.csm_position ?? "").trim();
  if (!csmTitle) return { action: "skip", reason: "no_csm_title" };

  const rank = rankFrom(csmTitle);
  const family = familyFrom(csmTitle);
  if (!family) return { action: "skip", reason: "no_match" };

  const site = input.destination_site.trim();
  const matches = input.cards.filter((card) => {
    if (siteFromJobTitle(card.job_title) !== site) return false;
    if (familyFrom(card.job_title) !== family) return false;
    if (rank && rankFrom(card.job_title) !== rank) return false;
    return true;
  });

  if (matches.length === 0) return { action: "skip", reason: "no_match" };
  if (matches.length > 1) return { action: "skip", reason: "ambiguous" };

  const card = matches[0]!;
  const cardRate = roundDailyRate4(asRate(card.payroll_daily_rate));
  if (cardRate <= 0) return { action: "skip", reason: "no_position_rate" };

  if (input.current_position_id === card.id) {
    const person = roundDailyRate4(asRate(input.daily_rate));
    if (Math.abs(person - cardRate) < 0.0001) return { action: "noop" };
  }

  return {
    action: "assign",
    employeeId: input.employeeId,
    position_id: card.id,
    job_title: card.job_title,
    daily_rate: cardRate,
    keep_employee_code: input.employee_code,
  };
}
