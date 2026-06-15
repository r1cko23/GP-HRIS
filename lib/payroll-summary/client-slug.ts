/** URL-safe slug for payroll audit clients (unique key on companies.slug). */
export function slugifyClientName(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

  return base || "client";
}

export function normalizeClientSlug(slug: string): string {
  return slugifyClientName(slug.replace(/-/g, " "));
}
