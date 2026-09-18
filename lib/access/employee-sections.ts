/**
 * People 201 section grants (ABAC Functions under employees).
 * page:employees opens the hub; these keys control which parts of the file
 * the actor may see or change. Salary stays fn:salary.read.
 */

export const EMPLOYEE_SECTIONS = [
  "core",
  "government_ids",
  "documents",
  "pay_channel",
  "family",
  "history",
  "medical",
  "lifecycle",
] as const;

export type EmployeeSection = (typeof EMPLOYEE_SECTIONS)[number];

export type EmployeeSectionMap = Record<EmployeeSection, boolean>;

export const EMPLOYEE_SECTION_INFO: Array<{
  id: EmployeeSection;
  label: string;
  description: string;
  capabilityKey: `fn:employees.section.${EmployeeSection}`;
}> = [
  {
    id: "core",
    label: "Core 201",
    description: "Overview and job assignment (name, contact, hire dates)",
    capabilityKey: "fn:employees.section.core",
  },
  {
    id: "government_ids",
    label: "Government IDs",
    description: "TIN, SSS, PhilHealth, Pag-IBIG numbers",
    capabilityKey: "fn:employees.section.government_ids",
  },
  {
    id: "documents",
    label: "Documents",
    description: "ID scans and 201 attachments",
    capabilityKey: "fn:employees.section.documents",
  },
  {
    id: "pay_channel",
    label: "Pay channel",
    description: "Bank account and GCash",
    capabilityKey: "fn:employees.section.pay_channel",
  },
  {
    id: "family",
    label: "Family",
    description: "Emergency contacts and dependents",
    capabilityKey: "fn:employees.section.family",
  },
  {
    id: "history",
    label: "History",
    description: "Job history, movements, education, licenses, skills",
    capabilityKey: "fn:employees.section.history",
  },
  {
    id: "medical",
    label: "Medical",
    description: "Medical sheet (health PII)",
    capabilityKey: "fn:employees.section.medical",
  },
  {
    id: "lifecycle",
    label: "Lifecycle",
    description: "Transfer, rehire, and status lifecycle actions",
    capabilityKey: "fn:employees.section.lifecycle",
  },
];

export const SALARY_CAPABILITY_KEY = "fn:salary.read";

export const GOVERNMENT_ID_FIELDS = [
  "tin",
  "sss_number",
  "philhealth_number",
  "pagibig_number",
  "tax_status",
] as const;

export const PAY_CHANNEL_FIELDS = [
  "pay_through",
  "bank_name",
  "bank_account_no",
  "gcash",
] as const;

export const SALARY_FIELDS = [
  "daily_rate",
  "billing_daily_rate",
  "ecola",
] as const;

/** Patch keys that belong to core 201 (identity + assignment). */
export const CORE_PATCH_FIELDS = [
  "last_name",
  "first_name",
  "middle_name",
  "sex",
  "birth_date",
  "hire_date",
  "status",
  "branch_id",
  "department_id",
  "position_id",
  "email",
  "mobile",
  "address",
  "profile_picture_url",
] as const;

const HISTORY_SHEETS = new Set([
  "education",
  "job_history",
  "licenses",
  "movements",
  "skills",
]);

const HISTORY_TABLES = new Set([
  "employee_education",
  "employee_job_history",
  "employee_licenses",
  "employee_movements",
  "employee_skills",
]);

export function emptyEmployeeSections(): EmployeeSectionMap {
  return Object.fromEntries(
    EMPLOYEE_SECTIONS.map((id) => [id, false])
  ) as EmployeeSectionMap;
}

export function allEmployeeSections(): EmployeeSectionMap {
  return Object.fromEntries(
    EMPLOYEE_SECTIONS.map((id) => [id, true])
  ) as EmployeeSectionMap;
}

export function isEmployeeSection(value: string): value is EmployeeSection {
  return (EMPLOYEE_SECTIONS as readonly string[]).includes(value);
}

export function capabilityKeyForSection(
  section: EmployeeSection
): `fn:employees.section.${EmployeeSection}` {
  return `fn:employees.section.${section}`;
}

export function canEmployeeSection(
  sections: EmployeeSectionMap,
  section: EmployeeSection
): boolean {
  return sections[section] === true;
}

export function hasAnyEmployeeSection(sections: EmployeeSectionMap): boolean {
  return EMPLOYEE_SECTIONS.some((id) => sections[id]);
}

/** Parse `permissions.employee_sections` from the ACL JSON (Settings). */
export function parseEmployeeSectionsOverride(
  permissions: unknown
): EmployeeSectionMap | null {
  if (!permissions || typeof permissions !== "object") return null;
  const raw = (permissions as Record<string, unknown>).employee_sections;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const map = emptyEmployeeSections();
  let sawAny = false;
  for (const id of EMPLOYEE_SECTIONS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === "boolean") {
      map[id] = value;
      sawAny = true;
    }
  }
  return sawAny ? map : null;
}

/**
 * Resolve effective section access.
 * - Service key / full bypass → all sections + salary
 * - Explicit capability keys for sections → those only
 * - Else if employeesRead and no section keys → all (backward compatible)
 * - Else override from permissions.employee_sections when present
 * - Else none
 */
export function resolveEmployeeSectionAccess(input: {
  employeesRead: boolean;
  capabilityKeys?: Iterable<string> | null;
  sectionsOverride?: EmployeeSectionMap | null;
  /** When true (admin role or service key), ignore sparse grants. */
  fullAccess?: boolean;
}): { sections: EmployeeSectionMap; salary: boolean } {
  if (input.fullAccess) {
    return { sections: allEmployeeSections(), salary: true };
  }

  const keys = new Set(
    Array.from(input.capabilityKeys ?? []).map((k) => k.trim()).filter(Boolean)
  );
  const salary = keys.has(SALARY_CAPABILITY_KEY);

  const sectionKeysPresent = EMPLOYEE_SECTIONS.some((id) =>
    keys.has(capabilityKeyForSection(id))
  );

  if (sectionKeysPresent) {
    const sections = emptyEmployeeSections();
    for (const id of EMPLOYEE_SECTIONS) {
      sections[id] = keys.has(capabilityKeyForSection(id));
    }
    return { sections, salary };
  }

  if (input.sectionsOverride) {
    return {
      sections: input.employeesRead
        ? { ...input.sectionsOverride }
        : emptyEmployeeSections(),
      salary,
    };
  }

  if (input.employeesRead) {
    return { sections: allEmployeeSections(), salary };
  }

  return { sections: emptyEmployeeSections(), salary };
}

export function employeeSectionCapabilityKeys(
  sections: EmployeeSectionMap
): string[] {
  return EMPLOYEE_SECTIONS.filter((id) => sections[id]).map(
    capabilityKeyForSection
  );
}

export function sectionForChildSheet(
  sheetKey: string
): EmployeeSection | null {
  if (sheetKey === "dependents") return "family";
  if (sheetKey === "medical") return "medical";
  if (HISTORY_SHEETS.has(sheetKey)) return "history";
  return null;
}

export function sectionForChildTable(
  table: string
): EmployeeSection | null {
  if (table === "employee_contacts" || table === "employee_dependents") {
    return "family";
  }
  if (table === "employee_medical") return "medical";
  if (HISTORY_TABLES.has(table)) return "history";
  return null;
}

function redactFields(
  row: Record<string, unknown>,
  fields: readonly string[]
): void {
  for (const key of fields) {
    if (key in row) row[key] = null;
  }
}

/** Redact employee row fields the actor may not see. Mutates a shallow copy. */
export function redactEmployeeRecord<T extends Record<string, unknown>>(
  employee: T,
  access: { sections: EmployeeSectionMap; salary: boolean }
): T {
  const out: Record<string, unknown> = { ...employee };
  if (!canEmployeeSection(access.sections, "government_ids")) {
    redactFields(out, GOVERNMENT_ID_FIELDS);
  }
  if (!canEmployeeSection(access.sections, "pay_channel")) {
    redactFields(out, PAY_CHANNEL_FIELDS);
  }
  if (!access.salary) {
    redactFields(out, SALARY_FIELDS);
  }
  if (!canEmployeeSection(access.sections, "core")) {
    // Keep id/code/status for list chrome; strip personal + assignment detail.
    for (const key of [
      "middle_name",
      "sex",
      "birth_date",
      "email",
      "mobile",
      "address",
      "profile_picture_url",
      "hire_date",
      "first_hire_date",
      "regular_date",
      "resign_date",
      "branch_id",
      "department_id",
      "position_id",
    ]) {
      if (key in out) out[key] = null;
    }
  }
  return out as T;
}

export type FilePayloadLike = {
  employee: Record<string, unknown>;
  contacts?: unknown[];
  dependents?: unknown[];
  education?: unknown[];
  job_history?: unknown[];
  licenses?: unknown[];
  medical?: unknown[];
  movements?: unknown[];
  skills?: unknown[];
  tenures?: unknown[];
  duplicate_peers?: unknown[];
  [key: string]: unknown;
};

/** Apply section access to a 201 file payload (employee + children). */
export function redactEmployeeFilePayload<T extends FilePayloadLike>(
  payload: T,
  access: { sections: EmployeeSectionMap; salary: boolean }
): T {
  const out: FilePayloadLike = {
    ...payload,
    employee: redactEmployeeRecord(payload.employee, access),
  };

  if (!canEmployeeSection(access.sections, "family")) {
    out.contacts = [];
    out.dependents = [];
  }
  if (!canEmployeeSection(access.sections, "history")) {
    out.education = [];
    out.job_history = [];
    out.licenses = [];
    out.movements = [];
    out.skills = [];
  }
  if (!canEmployeeSection(access.sections, "medical")) {
    out.medical = [];
  }
  if (!canEmployeeSection(access.sections, "government_ids")) {
    out.duplicate_peers = [];
  }
  if (!access.salary && Array.isArray(out.tenures)) {
    out.tenures = out.tenures.map((row) => {
      if (!row || typeof row !== "object") return row;
      const t = { ...(row as Record<string, unknown>) };
      redactFields(t, ["daily_rate", "billing_daily_rate"]);
      return t;
    });
  }

  return out as T;
}

/**
 * Drop patch keys the actor cannot write. Returns error if they attempted a
 * forbidden field; otherwise the filtered patch.
 */
export function filterEmployeePatchBySections(
  patch: Record<string, unknown>,
  access: { sections: EmployeeSectionMap; salary: boolean }
): { ok: true; patch: Record<string, unknown> } | { ok: false; error: string } {
  const allowed = new Set<string>();
  if (canEmployeeSection(access.sections, "core")) {
    for (const key of CORE_PATCH_FIELDS) allowed.add(key);
  }
  if (canEmployeeSection(access.sections, "government_ids")) {
    for (const key of GOVERNMENT_ID_FIELDS) allowed.add(key);
  }
  if (canEmployeeSection(access.sections, "pay_channel")) {
    for (const key of PAY_CHANNEL_FIELDS) allowed.add(key);
  }
  if (access.salary) {
    for (const key of SALARY_FIELDS) allowed.add(key);
  }

  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (!allowed.has(key)) {
      return {
        ok: false,
        error: `Forbidden: no grant to update ${key}`,
      };
    }
    next[key] = value;
  }
  return { ok: true, patch: next };
}

/** UI tab ids on the 201 page → required section (documents tab needs either ids or docs). */
export function sectionsFor201Tab(
  tab: string
): EmployeeSection[] {
  switch (tab) {
    case "overview":
    case "job":
      return ["core"];
    case "documents":
      return ["government_ids", "documents"];
    case "bank":
      return ["pay_channel"];
    case "family":
      return ["family"];
    case "history":
      return ["history"];
    case "more":
      return ["history", "medical"];
    default:
      return ["core"];
  }
}

export function firstAllowed201Tab(
  sections: EmployeeSectionMap
): string | null {
  const order: Array<{ tab: string; need: EmployeeSection[] }> = [
    { tab: "overview", need: ["core"] },
    { tab: "job", need: ["core"] },
    { tab: "documents", need: ["government_ids", "documents"] },
    { tab: "bank", need: ["pay_channel"] },
    { tab: "family", need: ["family"] },
    { tab: "history", need: ["history"] },
    { tab: "more", need: ["history", "medical"] },
  ];
  for (const entry of order) {
    if (entry.need.some((s) => canEmployeeSection(sections, s))) {
      return entry.tab;
    }
  }
  return null;
}

export function tabAllowed(
  tab: string,
  sections: EmployeeSectionMap
): boolean {
  return sectionsFor201Tab(tab).some((s) => canEmployeeSection(sections, s));
}
