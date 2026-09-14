import { toTitleCaseWords } from "@/lib/utils";

/** Header display: first name + last name (e.g. Jericko Razal). */
export function formatProfileDisplayName(
  fullName: string | null | undefined
): string {
  if (!fullName?.trim()) return "";

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return toTitleCaseWords(parts[0]);

  return `${toTitleCaseWords(parts[0])} ${toTitleCaseWords(parts[parts.length - 1])}`;
}
