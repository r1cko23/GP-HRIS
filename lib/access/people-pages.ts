/**
 * People hub Page grants: Clients vs Employees surfaces.
 *
 * Legacy `page:employees` aliases to both surfaces during migrate.
 * `page:people.clients` alone does not open 201 / work queues.
 */

export const PAGE_PEOPLE_CLIENTS = "page:people.clients" as const;
export const PAGE_PEOPLE_EMPLOYEES = "page:people.employees" as const;
export const PAGE_PEOPLE_TALENT = "page:people.talent" as const;
/** @deprecated Prefer page:people.clients / page:people.employees */
export const PAGE_EMPLOYEES_LEGACY = "page:employees" as const;

export type PeopleSurface = "clients" | "employees";
export type PeopleLandingSurface = PeopleSurface | "talent";

function keySet(capabilityKeys: Iterable<string>): Set<string> {
  return new Set(
    Array.from(capabilityKeys)
      .map((k) => k.trim())
      .filter(Boolean)
  );
}

export function actorHasAdminSystem(capabilityKeys: Iterable<string>): boolean {
  return keySet(capabilityKeys).has("fn:admin.system");
}

/** Any grant that opens the People hub chrome. */
export function canPeopleHub(capabilityKeys: Iterable<string>): boolean {
  const keys = keySet(capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  return (
    keys.has(PAGE_PEOPLE_CLIENTS) ||
    keys.has(PAGE_PEOPLE_EMPLOYEES) ||
    keys.has(PAGE_PEOPLE_TALENT) ||
    keys.has(PAGE_EMPLOYEES_LEGACY)
  );
}

/** Clients tab + client CMS / roster shell. */
export function canPeopleClients(capabilityKeys: Iterable<string>): boolean {
  const keys = keySet(capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  return keys.has(PAGE_PEOPLE_CLIENTS) || keys.has(PAGE_EMPLOYEES_LEGACY);
}

/**
 * Employees tab, work queues, and 201 section resolution path.
 * Clients-only packs must not get this.
 */
export function canPeopleEmployees(capabilityKeys: Iterable<string>): boolean {
  const keys = keySet(capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  return keys.has(PAGE_PEOPLE_EMPLOYEES) || keys.has(PAGE_EMPLOYEES_LEGACY);
}

/** Candidate pipeline. Employees grants retain access for existing HR packs. */
export function canPeopleTalent(capabilityKeys: Iterable<string>): boolean {
  const keys = keySet(capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  return (
    keys.has(PAGE_PEOPLE_TALENT) ||
    keys.has(PAGE_PEOPLE_EMPLOYEES) ||
    keys.has(PAGE_EMPLOYEES_LEGACY)
  );
}

/**
 * Default surface when landing on /people.
 * Employees when that page is granted (HR daily path); else Clients.
 */
export function defaultPeopleSurface(
  capabilityKeys: Iterable<string>
): PeopleLandingSurface | null {
  const clients = canPeopleClients(capabilityKeys);
  const employees = canPeopleEmployees(capabilityKeys);
  if (employees) return "employees";
  if (clients) return "clients";
  if (canPeopleTalent(capabilityKeys)) return "talent";
  return null;
}

/**
 * Module `employees.read` for hub nav: either People Page opens the hub.
 * Used by applyCapabilityKeysToPermissions for dotted page keys.
 */
export function peoplePageOpensEmployeesModule(pageKey: string): boolean {
  return (
    pageKey === PAGE_PEOPLE_CLIENTS ||
    pageKey === PAGE_PEOPLE_EMPLOYEES ||
    pageKey === PAGE_PEOPLE_TALENT ||
    pageKey === PAGE_EMPLOYEES_LEGACY
  );
}

/**
 * When grant rows include any People Page, 201 sections follow Employees
 * page (not Clients-only). With no People Pages, fall back to module read
 * (legacy role defaults).
 */
export function employeesReadForSections(input: {
  capabilityKeys: Iterable<string>;
  moduleEmployeesRead: boolean;
}): boolean {
  const keys = keySet(input.capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  const hasPeoplePage =
    keys.has(PAGE_PEOPLE_CLIENTS) ||
    keys.has(PAGE_PEOPLE_EMPLOYEES) ||
    keys.has(PAGE_EMPLOYEES_LEGACY);
  if (hasPeoplePage) return canPeopleEmployees(keys);
  return input.moduleEmployeesRead;
}

/** /people/clients list — encode packs must not open this surface. */
export function canOpenPeopleClientsList(
  capabilityKeys: Iterable<string>
): boolean {
  return canPeopleClients(capabilityKeys);
}

/**
 * Client roster / Departments / Positions shell.
 * Employees-only encode packs hire via the hub wizard — not this CMS.
 */
export function canOpenClientRosterShell(
  capabilityKeys: Iterable<string>
): boolean {
  const keys = keySet(capabilityKeys);
  if (keys.has("fn:admin.system")) return true;
  if (keys.has("fn:clients.roster.view")) return true;
  return canPeopleClients(keys);
}

/**
 * Cancel / hub back from hire or onboard: Employees when that page is
 * granted; Clients only for clients-only packs.
 */
export function peopleHubListPath(
  capabilityKeys: Iterable<string>
): "/people/clients" | "/people/employees" {
  if (canPeopleEmployees(capabilityKeys)) return "/people/employees";
  if (canPeopleClients(capabilityKeys)) return "/people/clients";
  return "/people/employees";
}

/**
 * Breadcrumb link under a client name. Null = plain label (no roster leak).
 */
export function peopleClientBreadcrumbHref(
  capabilityKeys: Iterable<string>,
  clientId: string
): string | null {
  if (!clientId.trim()) return null;
  if (!canOpenClientRosterShell(capabilityKeys)) return null;
  return `/people/c/${clientId.trim()}?status=active`;
}
