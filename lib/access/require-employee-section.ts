import {
  canEmployeeSection,
  type EmployeeSection,
} from "@/lib/access/employee-sections";
import { loadActorEmployeeSectionAccess } from "@/lib/access/load-actor-employee-sections";
import type { DirectoryAuth } from "@/lib/directory/auth";
import { jsonError } from "@/lib/directory/auth";

export async function requireEmployeeSection(
  auth: DirectoryAuth,
  section: EmployeeSection
) {
  const access = await loadActorEmployeeSectionAccess(auth);
  if (!canEmployeeSection(access.sections, section)) {
    return {
      error: jsonError(
        `Forbidden: missing grant fn:employees.section.${section}`,
        403
      ),
      access,
    } as const;
  }
  return { access } as const;
}

export async function requireAnyEmployeeSection(
  auth: DirectoryAuth,
  sections: EmployeeSection[]
) {
  const access = await loadActorEmployeeSectionAccess(auth);
  const ok = sections.some((section) =>
    canEmployeeSection(access.sections, section)
  );
  if (!ok) {
    return {
      error: jsonError(
        `Forbidden: missing grant for ${sections
          .map((s) => `fn:employees.section.${s}`)
          .join(" or ")}`,
        403
      ),
      access,
    } as const;
  }
  return { access } as const;
}
