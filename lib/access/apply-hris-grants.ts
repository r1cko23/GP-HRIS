/**
 * Build effective module permissions from role defaults + hris_user_grants.
 *
 * When the user has any Page/Function grant rows, those rows are the source of
 * truth (ABAC). Role-default matrices must not keep Payroll/Time/Reports open
 * for a narrowly granted HR Admin.
 *
 * When there are no grant rows, role defaults remain (legacy accounts).
 */

import type { ActionName, ModuleName, UserPermissions } from "@/lib/hooks/usePermissions";

const CRUD: ActionName[] = ["create", "read", "update", "delete"];

export function emptyUserPermissions(
  moduleKeys: readonly ModuleName[]
): UserPermissions {
  return Object.fromEntries(
    moduleKeys.map((module) => [
      module,
      { create: false, read: false, update: false, delete: false },
    ])
  ) as UserPermissions;
}

export function applyCapabilityKeysToPermissions(
  base: UserPermissions,
  capabilityKeys: readonly string[]
): UserPermissions {
  const merged = { ...base } as UserPermissions;
  for (const key of capabilityKeys) {
    if (key.startsWith("page:")) {
      const mod = key.slice(5) as ModuleName;
      if (merged[mod]) {
        merged[mod] = { ...merged[mod], read: true };
      }
      continue;
    }
    if (!key.startsWith("fn:") || !key.includes(".")) continue;
    const rest = key.slice(3);
    const dot = rest.lastIndexOf(".");
    const mod = rest.slice(0, dot) as ModuleName;
    const action = rest.slice(dot + 1) as ActionName;
    if (!merged[mod] || !(CRUD as string[]).includes(action)) continue;
    merged[mod] = { ...merged[mod], [action]: true };
  }
  return merged;
}

/**
 * @param roleDefaults — from get_user_permissions / getDefaultPermissionsForRole
 * @param capabilityKeys — rows from hris_user_grants
 * @param moduleKeys — MODULES values
 */
export function resolvePermissionsFromRoleAndGrants(input: {
  roleDefaults: UserPermissions;
  capabilityKeys: readonly string[];
  moduleKeys: readonly ModuleName[];
}): UserPermissions {
  const keys = input.capabilityKeys.filter(
    (key) => key.startsWith("page:") || key.startsWith("fn:")
  );
  if (keys.length === 0) {
    return input.roleDefaults;
  }
  return applyCapabilityKeysToPermissions(
    emptyUserPermissions(input.moduleKeys),
    keys
  );
}
