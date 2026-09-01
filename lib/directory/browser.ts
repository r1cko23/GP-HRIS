export const DIRECTORY_ORG_KEY = "gp_directory_org_id";
export const DIRECTORY_CLIENT_KEY = "gp_directory_client";
export const DIRECTORY_TENANT_EVENT = "gp-directory-tenant";

export type DirectoryClientMemory = {
  id: string;
  name: string;
};

type OrgRow = { id: string; name: string };

function emitTenantChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(DIRECTORY_TENANT_EVENT));
}

export function readDirectoryOrgId(): string {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(DIRECTORY_ORG_KEY) ?? "";
}

export function writeDirectoryOrgId(id: string) {
  sessionStorage.setItem(DIRECTORY_ORG_KEY, id);
  emitTenantChange();
}

export function readDirectoryClient(): DirectoryClientMemory | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(DIRECTORY_CLIENT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DirectoryClientMemory;
    if (!parsed?.id || !parsed?.name) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeDirectoryClient(client: DirectoryClientMemory | null) {
  if (client) {
    sessionStorage.setItem(DIRECTORY_CLIENT_KEY, JSON.stringify(client));
  } else {
    sessionStorage.removeItem(DIRECTORY_CLIENT_KEY);
  }
  emitTenantChange();
}

export function pickDirectoryOrg(
  orgs: OrgRow[],
  storedId: string,
  preferHint?: string | null
): OrgRow | undefined {
  const hint = (preferHint ?? "").trim().toLowerCase();
  if (hint) {
    const byHint = orgs.find(
      (org) =>
        org.name.toLowerCase().includes(hint) ||
        org.name.toLowerCase() === hint
    );
    if (byHint) return byHint;
  }
  if (storedId) {
    const match = orgs.find((org) => org.id === storedId);
    if (match) return match;
  }
  return (
    orgs.find((org) => org.name.toLowerCase() === "deployed") ?? orgs[0]
  );
}

/** UI label for org switcher — Deployed = client sites, Organic = GP house / bundy-eligible. */
export function directoryOrgLabel(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("organic")) return "Organic · GP house";
  if (n.includes("deployed")) return "Deployed · clients";
  return name;
}

export function directoryOrgHint(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("organic")) {
    return "GP house. Bundy under Time → Enrollment.";
  }
  if (n.includes("deployed")) {
    return "Client sites. Hours via Payroll Timekeeping until bundy enroll.";
  }
  return "";
}

export async function loadDirectoryOrganizations(): Promise<OrgRow[]> {
  const res = await fetch("/api/directory/organizations");
  const json = (await res.json()) as { data?: OrgRow[]; error?: string };
  if (!res.ok) throw new Error(json.error || "Organizations failed");
  return json.data ?? [];
}

export async function ensureDirectoryOrgId(): Promise<string> {
  const orgs = await loadDirectoryOrganizations();
  const org = pickDirectoryOrg(orgs, readDirectoryOrgId());
  if (!org) throw new Error("No organization");
  writeDirectoryOrgId(org.id);
  return org.id;
}

export function directoryHeaders(organizationId: string): HeadersInit {
  return { "x-organization-id": organizationId };
}

export async function directoryJson<T>(
  path: string,
  organizationId: string,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...directoryHeaders(organizationId),
      ...(init?.headers ?? {}),
    },
  });
  const json = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json;
}
