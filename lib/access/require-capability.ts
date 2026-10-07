import { jsonError, type DirectoryAuth } from "@/lib/directory/auth";
import {
  actorHasCapability,
  loadActorCapabilityKeys,
} from "@/lib/access/load-actor-capabilities";
import {
  canPeopleClients,
  canPeopleEmployees,
  canPeopleTalent,
  PAGE_EMPLOYEES_LEGACY,
  PAGE_PEOPLE_CLIENTS,
  PAGE_PEOPLE_EMPLOYEES,
  PAGE_PEOPLE_TALENT,
} from "@/lib/access/people-pages";

export async function requireCapability(
  auth: DirectoryAuth,
  capabilityKey: string
) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (!actorHasCapability(capabilityKeys, capabilityKey)) {
    return {
      error: jsonError(`Forbidden: missing grant ${capabilityKey}`, 403),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}

export async function requireAnyCapability(
  auth: DirectoryAuth,
  capabilityKeysNeeded: string[]
) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  const ok = capabilityKeysNeeded.some((key) =>
    actorHasCapability(capabilityKeys, key)
  );
  if (!ok) {
    return {
      error: jsonError(
        `Forbidden: missing grant for ${capabilityKeysNeeded.join(" or ")}`,
        403
      ),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}

/** Clients tab / client CMS / roster shell. */
export async function requirePeopleClientsPage(auth: DirectoryAuth) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (!canPeopleClients(capabilityKeys)) {
    return {
      error: jsonError(
        `Forbidden: missing grant ${PAGE_PEOPLE_CLIENTS} or ${PAGE_EMPLOYEES_LEGACY}`,
        403
      ),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}

/** Employees tab / work queues / 201. */
export async function requirePeopleEmployeesPage(auth: DirectoryAuth) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (!canPeopleEmployees(capabilityKeys)) {
    return {
      error: jsonError(
        `Forbidden: missing grant ${PAGE_PEOPLE_EMPLOYEES} or ${PAGE_EMPLOYEES_LEGACY}`,
        403
      ),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}

/** Candidates list — dedicated Talent or broader Employees page. */
export async function requirePeopleTalentPage(auth: DirectoryAuth) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (!canPeopleTalent(capabilityKeys)) {
    return {
      error: jsonError(
        `Forbidden: missing grant ${PAGE_PEOPLE_TALENT} or ${PAGE_PEOPLE_EMPLOYEES}`,
        403
      ),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}

/**
 * Roster list (client-scoped employees) — Clients or Employees page.
 * Org-wide queues must use requirePeopleEmployeesPage.
 */
export async function requirePeopleClientsOrEmployeesPage(
  auth: DirectoryAuth
) {
  const capabilityKeys = await loadActorCapabilityKeys(auth);
  if (
    !canPeopleClients(capabilityKeys) &&
    !canPeopleEmployees(capabilityKeys)
  ) {
    return {
      error: jsonError(
        `Forbidden: missing People Clients or Employees page grant`,
        403
      ),
      capabilityKeys,
    } as const;
  }
  return { capabilityKeys } as const;
}
