/** Shared Redis key names (legacy fixed keys; prefer epoch-scoped cachedJson). */

export const CACHE_KEYS = {
  auditCompaniesActive: "gp:audit:companies:active:v1",
  epoch: "gp:cache:epoch",
} as const;
