export type SheetField = {
  key: string;
  label: string;
  type?: "text" | "date" | "textarea";
  required?: boolean;
};

export type ChildSheetConfig = {
  table: string;
  title: string;
  description: string;
  fields: SheetField[];
  columns: Array<{ key: string; label: string }>;
};

export const DIRECTORY_CHILD_SHEETS = {
  dependents: {
    table: "employee_dependents",
    title: "Dependents",
    description: "Family members on the 201 file.",
    fields: [
      { key: "first_name", label: "First name" },
      { key: "last_name", label: "Last name", required: true },
      { key: "relationship", label: "Relationship" },
      { key: "birth_date", label: "Birth date", type: "date" },
      { key: "gender", label: "Gender" },
      { key: "occupation", label: "Occupation" },
    ],
    columns: [
      { key: "last_name", label: "Last name" },
      { key: "first_name", label: "First name" },
      { key: "relationship", label: "Relationship" },
      { key: "birth_date", label: "Birth date" },
    ],
  },
  education: {
    table: "employee_education",
    title: "Education",
    description: "Schools and levels on the 201.",
    fields: [
      { key: "school", label: "School", required: true },
      { key: "level", label: "Level" },
      { key: "degree", label: "Degree" },
      { key: "from_year", label: "From year" },
      { key: "to_year", label: "To year" },
      { key: "honors", label: "Honors" },
    ],
    columns: [
      { key: "school", label: "School" },
      { key: "level", label: "Level" },
      { key: "degree", label: "Degree" },
    ],
  },
  job_history: {
    table: "employee_job_history",
    title: "Job history",
    description: "Prior employers on the 201.",
    fields: [
      { key: "company", label: "Company", required: true },
      { key: "position_held", label: "Position" },
      { key: "from_year", label: "From year" },
      { key: "to_year", label: "To year" },
      { key: "reason_for_leaving", label: "Reason for leaving", type: "textarea" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      { key: "company", label: "Company" },
      { key: "position_held", label: "Position" },
      { key: "from_year", label: "From" },
      { key: "to_year", label: "To" },
    ],
  },
  licenses: {
    table: "employee_licenses",
    title: "Licenses",
    description: "Training and license records.",
    fields: [
      { key: "license_no", label: "License no." },
      { key: "course", label: "Course", required: true },
      { key: "awarded_on", label: "Awarded on" },
      { key: "expires_on", label: "Expires on" },
    ],
    columns: [
      { key: "license_no", label: "License" },
      { key: "course", label: "Course" },
      { key: "expires_on", label: "Expires" },
    ],
  },
  medical: {
    table: "employee_medical",
    title: "Medical",
    description: "Medical clearances on file.",
    fields: [
      { key: "medical_type", label: "Type", required: true },
      { key: "medical_status", label: "Status" },
      { key: "medical_date", label: "Date" },
      { key: "expires_on", label: "Expires on" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      { key: "medical_type", label: "Type" },
      { key: "medical_status", label: "Status" },
      { key: "medical_date", label: "Date" },
    ],
  },
  movements: {
    table: "employee_movements",
    title: "Movements",
    description: "Status and assignment changes.",
    fields: [
      { key: "date_from", label: "From" },
      { key: "date_to", label: "To" },
      { key: "status", label: "Status" },
      { key: "department", label: "Department" },
      { key: "position", label: "Position" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      { key: "status", label: "Status" },
      { key: "position", label: "Position" },
      { key: "date_from", label: "From" },
    ],
  },
  skills: {
    table: "employee_skills",
    title: "Skills",
    description: "Skills listed on the 201.",
    fields: [
      { key: "skill", label: "Skill", required: true },
      { key: "proficiency", label: "Proficiency" },
      { key: "years_experience", label: "Years experience" },
      { key: "remarks", label: "Remarks", type: "textarea" },
    ],
    columns: [
      { key: "skill", label: "Skill" },
      { key: "proficiency", label: "Proficiency" },
      { key: "years_experience", label: "Years" },
    ],
  },
} as const satisfies Record<string, ChildSheetConfig>;

export type ChildSheetKey = keyof typeof DIRECTORY_CHILD_SHEETS;

export function isChildSheetKey(value: string): value is ChildSheetKey {
  return value in DIRECTORY_CHILD_SHEETS;
}

export function parseChildSheetBody(
  config: ChildSheetConfig,
  body: Record<string, unknown>
): Record<string, unknown> | { error: string } {
  const out: Record<string, unknown> = {};
  for (const field of config.fields) {
    const raw = body[field.key];
    if (field.required) {
      const text =
        typeof raw === "string" ? raw.trim() : raw == null ? "" : String(raw);
      if (!text) return { error: `${field.label} is required` };
      out[field.key] = text;
    } else if (raw === null || raw === undefined || raw === "") {
      out[field.key] = null;
    } else if (typeof raw === "string") {
      out[field.key] = raw.trim() || null;
    } else {
      out[field.key] = raw;
    }
  }
  return out;
}
