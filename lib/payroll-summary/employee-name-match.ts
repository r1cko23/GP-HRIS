import { normalizeEmployeeName } from "./normalize-name";

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);

/** Minimum similarity to treat as a rename instead of add+remove. */
export const RENAME_MATCH_THRESHOLD = 0.72;

function tokenize(name: string): string[] {
  return normalizeEmployeeName(name)
    .replace(/,/g, " ")
    .replace(/\./g, "")
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !NAME_SUFFIXES.has(token));
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);

  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }

  return prev[b.length];
}

function tokenJaccard(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function compactSimilarity(a: string, b: string): number {
  const na = normalizeEmployeeName(a).replace(/\s+/g, "");
  const nb = normalizeEmployeeName(b).replace(/\s+/g, "");
  if (!na || !nb) return 0;
  const distance = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return maxLen === 0 ? 0 : 1 - distance / maxLen;
}

/**
 * Score how likely two register names refer to the same person (0–1).
 * Handles reordering ("DELA CRUZ, JUAN" vs "JUAN DELA CRUZ") via token overlap.
 */
export function employeeNameSimilarity(a: string, b: string): number {
  const na = normalizeEmployeeName(a);
  const nb = normalizeEmployeeName(b);
  if (na === nb) return 1;

  const jaccard = tokenJaccard(a, b);
  const compact = compactSimilarity(a, b);

  const ta = tokenize(a);
  const tb = tokenize(b);
  let lastNameBoost = 0;
  if (ta.length > 0 && tb.length > 0) {
    const lastA = ta[ta.length - 1];
    const lastB = tb[tb.length - 1];
    if (lastA === lastB && jaccard >= 0.4) {
      lastNameBoost = 0.15;
    }
  }

  return Math.min(1, Math.max(jaccard, compact * 0.95) + lastNameBoost);
}

export interface RenameMatch<T> {
  current: T;
  previous: T;
  score: number;
}

/**
 * Greedy one-to-one pairing of likely renames among unmatched employees.
 */
export function findRenamePairs<T extends { name: string }>(
  currentUnmatched: T[],
  previousUnmatched: T[],
  threshold = RENAME_MATCH_THRESHOLD
): RenameMatch<T>[] {
  const candidates: Array<RenameMatch<T> & { currentIdx: number; previousIdx: number }> =
    [];

  for (let ci = 0; ci < currentUnmatched.length; ci++) {
    for (let pi = 0; pi < previousUnmatched.length; pi++) {
      const score = employeeNameSimilarity(
        currentUnmatched[ci].name,
        previousUnmatched[pi].name
      );
      if (score >= threshold) {
        candidates.push({
          current: currentUnmatched[ci],
          previous: previousUnmatched[pi],
          score,
          currentIdx: ci,
          previousIdx: pi,
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  const usedCurrent = new Set<number>();
  const usedPrevious = new Set<number>();
  const pairs: RenameMatch<T>[] = [];

  for (const candidate of candidates) {
    if (usedCurrent.has(candidate.currentIdx) || usedPrevious.has(candidate.previousIdx)) {
      continue;
    }
    usedCurrent.add(candidate.currentIdx);
    usedPrevious.add(candidate.previousIdx);
    pairs.push({
      current: candidate.current,
      previous: candidate.previous,
      score: candidate.score,
    });
  }

  return pairs;
}
