/**
 * Directory employee write policy (Pages + Functions).
 *
 * - Create: fn:employees.create
 * - Update existing roster: fn:employees.update
 * - Encode a new hire: create-only actors may PATCH while status is
 *   for_verification (hire wizard / incomplete encode). They may not
 *   change Active or other lifecycle statuses without update.
 * - Cancel hire: create (or update/delete) may discard for_verification
 *   drafts so Cancel leaves no roster row.
 */

import { actorHasCapability } from "@/lib/access/load-actor-capabilities";

export const FN_EMPLOYEES_CREATE = "fn:employees.create" as const;
export const FN_EMPLOYEES_UPDATE = "fn:employees.update" as const;
export const FN_EMPLOYEES_DELETE = "fn:employees.delete" as const;

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

/**
 * Cancel on Onboard discards the draft 201. Create-only encoders who can
 * start a hire may also undo it while still for_verification.
 */
export function canDiscardUnverifiedHire(input: {
  capabilityKeys: Iterable<string>;
  employeeStatus: string | null | undefined;
}): boolean {
  if (input.employeeStatus !== ENCODER_WRITABLE_STATUS) return false;
  return (
    actorHasCapability(input.capabilityKeys, FN_EMPLOYEES_CREATE) ||
    actorHasCapability(input.capabilityKeys, FN_EMPLOYEES_UPDATE) ||
    actorHasCapability(input.capabilityKeys, FN_EMPLOYEES_DELETE)
  );
}
