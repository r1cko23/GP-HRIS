/**
 * Government ID / 201 document types for Directory uploads.
 */

export const EMPLOYEE_DOCUMENT_TYPES = [
  "sss_id",
  "tin_id",
  "philhealth_id",
  "pagibig_id",
  "nbi_clearance",
  "police_clearance",
  "barangay_clearance",
  "psa_birth",
  "government_id",
  "medical_clearance",
  "employment_contract",
  "other",
] as const;

export type EmployeeDocumentType = (typeof EMPLOYEE_DOCUMENT_TYPES)[number];

export const STATUTORY_SCAN_TYPES: EmployeeDocumentType[] = [
  "sss_id",
  "tin_id",
  "philhealth_id",
  "pagibig_id",
];

export const EMPLOYEE_DOCUMENT_LABELS: Record<EmployeeDocumentType, string> = {
  sss_id: "SSS ID",
  tin_id: "TIN ID",
  philhealth_id: "PhilHealth ID",
  pagibig_id: "Pag-IBIG ID",
  nbi_clearance: "NBI clearance",
  police_clearance: "Police clearance",
  barangay_clearance: "Barangay clearance",
  psa_birth: "PSA birth certificate",
  government_id: "Government ID",
  medical_clearance: "Medical clearance",
  employment_contract: "Employment contract",
  other: "Other",
};

/** Types HR can tick when one scan holds several IDs (excludes the Other mode itself). */
export const COMBINED_SCAN_TICK_TYPES: EmployeeDocumentType[] =
  EMPLOYEE_DOCUMENT_TYPES.filter((type) => type !== "other");

export const EMPLOYEE_DOCUMENTS_BUCKET = "employee-documents";
export const EMPLOYEE_DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const EMPLOYEE_DOCUMENT_ALLOWED_MIME = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

const TYPE_SET = new Set<string>(EMPLOYEE_DOCUMENT_TYPES);
const MIME_SET = new Set<string>(EMPLOYEE_DOCUMENT_ALLOWED_MIME);

export function isEmployeeDocumentType(
  value: string
): value is EmployeeDocumentType {
  return TYPE_SET.has(value);
}

export function parseEmployeeDocumentType(
  value: unknown
): EmployeeDocumentType | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return isEmployeeDocumentType(trimmed) ? trimmed : null;
}

/** Unique valid types from a JSON array, comma list, or string[]. */
export function parseEmployeeDocumentTypes(
  value: unknown
): EmployeeDocumentType[] | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        raw = JSON.parse(trimmed);
      } catch {
        return null;
      }
    } else {
      raw = trimmed.split(",").map((part) => part.trim());
    }
  }
  if (!Array.isArray(raw)) return null;
  const out: EmployeeDocumentType[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const type = parseEmployeeDocumentType(item);
    if (!type) return null;
    if (seen.has(type)) continue;
    seen.add(type);
    out.push(type);
  }
  return out;
}

/**
 * Other + ticks → one row per ticked ID (combined scan).
 * Other + no ticks → misc `other`.
 * Any other primary type → that single type.
 */
export function resolveUploadDocTypes(input: {
  docType: unknown;
  containedTypes?: unknown;
}): { ok: true; types: EmployeeDocumentType[] } | { ok: false; error: string } {
  const primary = parseEmployeeDocumentType(input.docType);
  if (!primary) {
    return { ok: false, error: "Invalid document type" };
  }

  if (primary !== "other") {
    return { ok: true, types: [primary] };
  }

  if (input.containedTypes == null) {
    return { ok: true, types: ["other"] };
  }

  const contained = parseEmployeeDocumentTypes(input.containedTypes);
  if (contained == null) {
    return { ok: false, error: "Invalid document type in this file" };
  }

  const ticks = contained.filter((type) => type !== "other");
  if (ticks.length === 0) {
    return { ok: true, types: ["other"] };
  }
  return { ok: true, types: ticks };
}

export function assertEmployeeDocumentUpload(input: {
  docType: unknown;
  mimeType: unknown;
  fileSize: unknown;
}): { ok: true } | { ok: false; error: string } {
  if (!parseEmployeeDocumentType(input.docType)) {
    return { ok: false, error: "Invalid document type" };
  }
  if (typeof input.mimeType !== "string" || !MIME_SET.has(input.mimeType)) {
    return {
      ok: false,
      error: "File must be PDF, JPEG, PNG, or WebP",
    };
  }
  if (
    typeof input.fileSize !== "number" ||
    !Number.isFinite(input.fileSize) ||
    input.fileSize <= 0
  ) {
    return { ok: false, error: "File is empty" };
  }
  if (input.fileSize > EMPLOYEE_DOCUMENT_MAX_BYTES) {
    return { ok: false, error: "File must be 10 MB or smaller" };
  }
  return { ok: true };
}

export function employeeDocumentStoragePath(input: {
  organizationId: string;
  employeeId: string;
  docType: EmployeeDocumentType | "bundle";
  fileId: string;
  extension: string;
}): string {
  const ext = input.extension.replace(/^\./, "").toLowerCase() || "bin";
  return `${input.organizationId}/${input.employeeId}/${input.docType}/${input.fileId}.${ext}`;
}

export function combinedScanNotes(types: EmployeeDocumentType[]): string | null {
  if (types.length < 2) return null;
  return `Combined scan: ${types.map((type) => EMPLOYEE_DOCUMENT_LABELS[type]).join(", ")}.`;
}

export function mimeToExtension(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "bin";
}

export function computeDocumentInspection(presentTypes: string[]): {
  score: number;
  total: number;
  missing: EmployeeDocumentType[];
} {
  const have = new Set(presentTypes.filter(isEmployeeDocumentType));
  const missing = STATUTORY_SCAN_TYPES.filter((type) => !have.has(type));
  return {
    score: STATUTORY_SCAN_TYPES.length - missing.length,
    total: STATUTORY_SCAN_TYPES.length,
    missing,
  };
}
