/** Normalize employee names for matching across plantilla and register uploads. */
export function normalizeEmployeeName(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ")
    .replace(/[.,]+$/g, "");
}
