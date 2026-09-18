/**
 * Parse ZKTeco OPERLOG / USERINFO bodies for PIN + Name.
 * Lines look like:
 *   USER PIN=11\tName=Juan Dela Cruz\tPri=0\t...
 *   PIN=11\tName=Juan Dela Cruz\tPrivilege=0\t...
 */

export type ZkDeviceUser = {
  deviceUserId: string;
  displayName: string;
  rawLine: string;
};

function parseKeyValues(line: string): Record<string, string> {
  let work = line.trim();
  if (!work) return {};
  // Strip leading "USER " prefix (OPERLOG enroll lines)
  if (/^USER\s+/i.test(work)) {
    work = work.replace(/^USER\s+/i, "");
  }

  const fields: Record<string, string> = {};
  const parts = work.includes("\t")
    ? work.split("\t")
    : work.split(/\s+/).filter(Boolean);

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

export function parseOperlogUsers(body: string): ZkDeviceUser[] {
  const out: ZkDeviceUser[] = [];
  const seen = new Set<string>();

  for (const line of body.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip pure OPLOG operation rows (no PIN=)
    if (!/PIN=/i.test(trimmed)) continue;

    const fields = parseKeyValues(trimmed);
    const pin = (fields.PIN ?? "").trim();
    if (!pin || seen.has(pin)) continue;
    seen.add(pin);

    const name = (fields.Name ?? fields.name ?? "").trim();
    out.push({
      deviceUserId: pin,
      displayName: name,
      rawLine: trimmed,
    });
  }
  return out;
}
