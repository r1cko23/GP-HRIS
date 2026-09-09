/**
 * Infer Directory Branch (site) from a GREENHRISMAIN job title
 * like "Tr-Ebo(Batangas 600)" while Branch is still "Manila".
 */

const SITE_CANON: Array<{ match: string; name: string }> = [
  { match: "head office", name: "Head Office" },
  { match: "las pinas", name: "Las Piñas" },
  { match: "las piñas", name: "Las Piñas" },
  { match: "batangas", name: "Batangas" },
  { match: "laguna", name: "Laguna" },
  { match: "lucena", name: "Lucena" },
  { match: "cavite", name: "Cavite" },
  { match: "palawan", name: "Palawan" },
  { match: "taytay", name: "Taytay" },
  { match: "baesa", name: "Baesa" },
  { match: "bicol", name: "Bicol" },
  { match: "provincial", name: "Provincial" },
];

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_.,]+/g, " ")
    .replace(/\bprov\.?\b/g, "provincial")
    .replace(/\s+/g, " ")
    .trim();
}

function siteIn(haystack: string): string | null {
  const text = fold(haystack);
  const ranked = [...SITE_CANON].sort((a, b) => b.match.length - a.match.length);
  for (const site of ranked) {
    if (text.includes(site.match)) return site.name;
  }
  return null;
}

/** Titles with no plant in the name — Head Office. */
const HEAD_OFFICE_TITLES = new Set(
  [
    "finance assistant",
    "marketing assistant",
    "sales supervisor",
    "scm assistant",
    "cashier",
  ].map(fold)
);

export const NABATI_SITE_NAMES = [
  "Baesa",
  "Batangas",
  "Bicol",
  "Cavite",
  "Head Office",
  "Laguna",
  "Las Piñas",
  "Lucena",
  "Palawan",
  "Provincial",
  "Taytay",
] as const;

export function siteFromJobTitle(jobTitle: string | null | undefined): string | null {
  const raw = (jobTitle ?? "").trim();
  if (!raw) return null;

  const folded = fold(raw);
  if (/\bhead\s*office\b/.test(folded) || /\bh\.?\s*o\.?\b/.test(folded)) {
    return "Head Office";
  }

  const paren = raw.match(/\(([^)]*)\)/);
  if (paren?.[1]) {
    const fromParen = siteIn(paren[1].replace(/\d+(\.\d+)?/g, " "));
    if (fromParen) return fromParen;
  }

  const fromTitle = siteIn(raw.replace(/\d+(\.\d+)?/g, " "));
  if (fromTitle) return fromTitle;

  if (HEAD_OFFICE_TITLES.has(folded.replace(/\s*\([^)]*\)\s*/g, "").trim())) {
    return "Head Office";
  }

  return null;
}
