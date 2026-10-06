/**
 * Advisory deployment checklist by client industry.
 * Never hard-blocks Rehire / Activate — NBI + medical do that.
 */

import {
  EMPLOYEE_DOCUMENT_LABELS,
  type EmployeeDocumentType,
  type FitnessClearanceDocument,
} from "@/lib/directory/documents";

export type ClientIndustry = "HOTEL" | "NON-HOTEL";

export type ClientPackItemDef = {
  key: EmployeeDocumentType;
  label: string;
  required: false;
};

const HOTEL_PACK: ClientPackItemDef[] = [
  {
    key: "employment_contract",
    label: EMPLOYEE_DOCUMENT_LABELS.employment_contract,
    required: false,
  },
  {
    key: "government_id",
    label: EMPLOYEE_DOCUMENT_LABELS.government_id,
    required: false,
  },
  {
    key: "police_clearance",
    label: EMPLOYEE_DOCUMENT_LABELS.police_clearance,
    required: false,
  },
];

const NON_HOTEL_PACK: ClientPackItemDef[] = [
  {
    key: "employment_contract",
    label: EMPLOYEE_DOCUMENT_LABELS.employment_contract,
    required: false,
  },
  {
    key: "barangay_clearance",
    label: EMPLOYEE_DOCUMENT_LABELS.barangay_clearance,
    required: false,
  },
  {
    key: "government_id",
    label: EMPLOYEE_DOCUMENT_LABELS.government_id,
    required: false,
  },
];

export function normalizeClientIndustry(
  value: string | null | undefined
): ClientIndustry {
  return String(value ?? "").trim().toUpperCase() === "HOTEL"
    ? "HOTEL"
    : "NON-HOTEL";
}

export function clientPackForIndustry(
  industry: string | null | undefined
): ClientPackItemDef[] {
  return normalizeClientIndustry(industry) === "HOTEL"
    ? HOTEL_PACK
    : NON_HOTEL_PACK;
}

function dateOnly(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  const iso = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : null;
}

function docCoversAsOf(
  doc: FitnessClearanceDocument | undefined,
  asOfDate: string | null
): boolean {
  if (!doc) return false;
  if (doc.superseded_at != null && String(doc.superseded_at).trim() !== "") {
    return false;
  }
  const expiresOn = dateOnly(doc.expires_on);
  if (asOfDate && expiresOn && expiresOn < asOfDate) return false;
  return true;
}

export type ClientPackStatusItem = ClientPackItemDef & { ok: boolean };

export type ClientPackStatus = {
  industry: ClientIndustry;
  industryLabel: string;
  items: ClientPackStatusItem[];
  /** Always false — packs are advisory. */
  blocks: false;
};

/** Checklist status for UI. Never sets blocks. */
export function clientPackStatus(input: {
  industry: string | null | undefined;
  documents: FitnessClearanceDocument[];
  asOfDate?: string | null;
}): ClientPackStatus {
  const industry = normalizeClientIndustry(input.industry);
  const asOfDate = dateOnly(input.asOfDate ?? null);
  const defs = clientPackForIndustry(industry);
  const items = defs.map((def) => {
    const current = input.documents.find((doc) => doc.doc_type === def.key);
    return {
      ...def,
      ok: docCoversAsOf(current, asOfDate),
    };
  });
  return {
    industry,
    industryLabel: industry === "HOTEL" ? "Hotel" : "Non-Hotel",
    items,
    blocks: false,
  };
}
