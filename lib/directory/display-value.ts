export { formatProseDisplay, normalizeProseText } from "@/lib/prose-text";

/** Plain fallback for codes, IDs, and dates. */
export function dash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}
