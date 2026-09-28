/** First active client by name — default report scope instead of “All clients”. */

export function pickFirstClientAlphabetically<T extends { id: string; name: string }>(
  clients: T[]
): T | null {
  if (!clients.length) return null;
  const sorted = [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
  return sorted[0] ?? null;
}

export function sortClientsAlphabetically<T extends { name: string }>(
  clients: T[]
): T[] {
  return [...clients].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}
