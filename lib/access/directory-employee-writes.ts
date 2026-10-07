/**
 * Directory employee write policy (Pages + Functions).
 *
 * - Create: fn:employees.create
 * - Update existing roster: fn:employees.update
 * - Encode a new hire: create-only actors may PATCH while status is
 *   for_verification (hire wizard / incomplete encode). They may not
 *   change Active or other lifecycle statuses without update.
 */

import { actorHasCapability } from "@/lib/access/load-actor-capabilities";

export const FN_EMPLOYEES_CREATE = "fn:employees.create" as const;
export const FN_EMPLOYEES_UPDATE = "fn:employees.update" as const;

/** Status where create-only encoders may still write 201 fields. */
export const ENCODER_WRITABLE_STATUS = "for_verification" as const;

export function canCreateDirectoryEmployee(
  capabilityKeys: Iterable<string>
): boolean {
  return actorHasCapability(capabilityKeys, FN_EMPLOYEES_CREATE);
}

/**
 * Whether the actor may PATCH this employee row.
 * Update grant ⇒ any status. Create-only ⇒ for_verification only.
 */
export function canPatchDirectoryEmployee(input: {
  capabilityKeys: Iterable<string>;
  employeeStatus: string | null | undefined;
}): boolean {
  if (actorHasCapability(input.capabilityKeys, FN_EMPLOYEES_UPDATE)) {
    return true;
  }
  if (!actorHasCapability(input.capabilityKeys, FN_EMPLOYEES_CREATE)) {
    return false;
  }
  return input.employeeStatus === ENCODER_WRITABLE_STATUS;
}
