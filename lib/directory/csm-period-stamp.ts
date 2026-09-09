/** Stamp GP-Client period employees with CSM Verified Directory ids. Never creates a 201. */

export type PeriodStampRow = {
  id: string;
  full_name: string;
  directory_employee_id: string | null;
};

export type VerifiedStampPerson = {
  employee_name: string;
  directory_employee_id: string;
};

export type PeriodStampPlan =
  | { action: "keep"; id: string; directory_employee_id: string }
  | {
      action: "stamp";
      id: string;
      directory_employee_id: string;
      reason: "name";
    }
  | { action: "skip"; id: string; full_name: string; reason: string };

function fold(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[_.,]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lastAndTokens(name: string): { last: string; tokens: string[] } {
  const trimmed = name.trim();
  const [lastRaw, rest = ""] = trimmed.includes(",")
    ? trimmed.split(",", 2)
    : [trimmed.split(/\s+/)[0] ?? "", trimmed.split(/\s+/).slice(1).join(" ")];
  const last = fold(lastRaw);
  const tokens = fold(`${lastRaw} ${rest}`)
    .split(" ")
    .filter((token) => token.length > 1);
  return { last, tokens };
}

function firstTokens(parsed: { last: string; tokens: string[] }): string[] {
  return parsed.tokens.filter((token) => token !== parsed.last);
}

function uniqueVerifiedMatch(
  fullName: string,
  verified: VerifiedStampPerson[],
  claimed: Set<string>
): VerifiedStampPerson | null {
  const available = verified.filter((person) => {
    const id = person.directory_employee_id.trim();
    return Boolean(id) && !claimed.has(id);
  });
  const query = lastAndTokens(fullName);
  if (!query.last) return null;

  const lastHits = available.filter(
    (person) => lastAndTokens(person.employee_name).last === query.last
  );
  if (lastHits.length === 1) return lastHits[0] ?? null;

  const firstHits = lastHits.filter((person) => {
    const theirs = firstTokens(lastAndTokens(person.employee_name));
    return firstTokens(query).some((token) => theirs.includes(token));
  });
  if (firstHits.length === 1) return firstHits[0] ?? null;
  return null;
}

export function planPeriodDirectoryStamps(
  period: PeriodStampRow[],
  verified: VerifiedStampPerson[]
): PeriodStampPlan[] {
  const verifiedIds = new Set(
    verified.map((person) => person.directory_employee_id.trim()).filter(Boolean)
  );
  const claimed = new Set<string>();
  const out: PeriodStampPlan[] = [];

  for (const row of period) {
    const existing = row.directory_employee_id?.trim() || "";
    if (existing && verifiedIds.has(existing) && !claimed.has(existing)) {
      claimed.add(existing);
      out.push({
        action: "keep",
        id: row.id,
        directory_employee_id: existing,
      });
      continue;
    }

    const hit = uniqueVerifiedMatch(row.full_name, verified, claimed);
    if (!hit) {
      out.push({
        action: "skip",
        id: row.id,
        full_name: row.full_name,
        reason: existing ? "no_verified_match" : "no_verified_match",
      });
      continue;
    }

    claimed.add(hit.directory_employee_id);
    out.push({
      action: "stamp",
      id: row.id,
      directory_employee_id: hit.directory_employee_id,
      reason: "name",
    });
  }

  return out;
}
