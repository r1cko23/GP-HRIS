/** Shared Redis key names (bump version suffix to cold-flush a namespace). */

export const CACHE_KEYS = {
  auditCompaniesActive: "gp:audit:companies:active:v1",
} as const;
