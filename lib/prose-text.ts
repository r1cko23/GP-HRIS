import { toTitleCaseWords } from "@/lib/utils";

const EMAIL_RE = /@/;

/** Mostly digits and punctuation — TIN, SSS, account numbers, phone, employee codes. */
const MOSTLY_IDENTIFIER_RE = /^[\d\s#\-./()+]+$/;

export function shouldPreserveRawText(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (EMAIL_RE.test(trimmed)) return true;
  if (MOSTLY_IDENTIFIER_RE.test(trimmed)) return true;
  return false;
}

/** Title-case each word on save/input (e.g. manila → Manila, quezon city → Quezon City). */
export function normalizeProseText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed || shouldPreserveRawText(trimmed)) return trimmed;
  return toTitleCaseWords(trimmed);
}

export function normalizeProseTextOrNull(
  value: string | null | undefined
): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return normalizeProseText(trimmed);
}

/** Read-only display for roster / 201 file fields. */
export function formatProseDisplay(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const s = String(value).trim();
  if (!s) return "—";
  if (shouldPreserveRawText(s)) return s;
  return toTitleCaseWords(s);
}
