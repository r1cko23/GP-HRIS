/** Directory client fields mapped from GREENHRISMAIN dbo.client */

export type DirectoryClientStatus = "active" | "inactive";

export type DirectoryClientPayFrequency =
  | "weekly"
  | "semi-monthly"
  | "monthly"
  | "";

export type DirectoryClientFormData = {
  name: string;
  tin: string;
  status: DirectoryClientStatus;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  cut1_start: string;
  cut1_end: string;
  cut2_start: string;
  cut2_end: string;
  pay_frequency: DirectoryClientPayFrequency;
  statutory_schedule: string;
  wtax_schedule: string;
  sss_basis: string;
  philhealth_basis: string;
  wtax_basis: string;
  include_cola: boolean;
  include_sea: boolean;
  include_ctpa: boolean;
  admin_fee: string;
  vat: string;
  ewt: string;
  thirteenth_month_year: string;
};

export type DirectoryClientRow = {
  id: string;
  name: string;
  tin?: string | null;
  status?: string | null;
  contact_person?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  cut1_start?: number | null;
  cut1_end?: number | null;
  cut2_start?: number | null;
  cut2_end?: number | null;
  pay_frequency?: string | null;
  statutory_schedule?: string | null;
  wtax_schedule?: string | null;
  sss_basis?: string | null;
  philhealth_basis?: string | null;
  wtax_basis?: string | null;
  include_cola?: boolean | null;
  include_sea?: boolean | null;
  include_ctpa?: boolean | null;
  admin_fee?: number | null;
  vat?: number | null;
  ewt?: number | null;
  thirteenth_month_year?: number | null;
  legacy_id?: number | null;
};

export const CLIENT_FIELD_KEYS = [
  "name",
  "tin",
  "status",
  "contact_person",
  "email",
  "phone",
  "address",
  "cut1_start",
  "cut1_end",
  "cut2_start",
  "cut2_end",
  "pay_frequency",
  "statutory_schedule",
  "wtax_schedule",
  "sss_basis",
  "philhealth_basis",
  "wtax_basis",
  "include_cola",
  "include_sea",
  "include_ctpa",
  "admin_fee",
  "vat",
  "ewt",
  "thirteenth_month_year",
] as const;

export function emptyDirectoryClientForm(): DirectoryClientFormData {
  return {
    name: "",
    tin: "",
    status: "active",
    contact_person: "",
    email: "",
    phone: "",
    address: "",
    cut1_start: "",
    cut1_end: "",
    cut2_start: "",
    cut2_end: "",
    pay_frequency: "semi-monthly",
    statutory_schedule: "",
    wtax_schedule: "",
    sss_basis: "",
    philhealth_basis: "",
    wtax_basis: "",
    include_cola: false,
    include_sea: false,
    include_ctpa: false,
    admin_fee: "",
    vat: "",
    ewt: "",
    thirteenth_month_year: "",
  };
}

export function clientRowToForm(row: DirectoryClientRow): DirectoryClientFormData {
  const pay = row.pay_frequency;
  return {
    name: row.name ?? "",
    tin: row.tin ?? "",
    status: row.status === "inactive" ? "inactive" : "active",
    contact_person: row.contact_person ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    address: row.address ?? "",
    cut1_start: row.cut1_start != null ? String(row.cut1_start) : "",
    cut1_end: row.cut1_end != null ? String(row.cut1_end) : "",
    cut2_start: row.cut2_start != null ? String(row.cut2_start) : "",
    cut2_end: row.cut2_end != null ? String(row.cut2_end) : "",
    pay_frequency:
      pay === "weekly" || pay === "semi-monthly" || pay === "monthly"
        ? pay
        : "semi-monthly",
    statutory_schedule: row.statutory_schedule ?? "",
    wtax_schedule: row.wtax_schedule ?? "",
    sss_basis: row.sss_basis ?? "",
    philhealth_basis: row.philhealth_basis ?? "",
    wtax_basis: row.wtax_basis ?? "",
    include_cola: Boolean(row.include_cola),
    include_sea: Boolean(row.include_sea),
    include_ctpa: Boolean(row.include_ctpa),
    admin_fee: row.admin_fee != null ? String(row.admin_fee) : "",
    vat: row.vat != null ? String(row.vat) : "",
    ewt: row.ewt != null ? String(row.ewt) : "",
    thirteenth_month_year:
      row.thirteenth_month_year != null
        ? String(row.thirteenth_month_year)
        : "",
  };
}

function optionalInt(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function optionalNum(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function optionalText(raw: string): string | null {
  const t = raw.trim();
  return t || null;
}

/** Payload for Directory clients POST/PATCH (directory.clients columns). */
export function formToClientPayload(form: DirectoryClientFormData) {
  return {
    name: form.name.trim(),
    tin: optionalText(form.tin),
    status: form.status,
    contact_person: optionalText(form.contact_person),
    email: optionalText(form.email),
    phone: optionalText(form.phone),
    address: optionalText(form.address),
    cut1_start: optionalInt(form.cut1_start),
    cut1_end: optionalInt(form.cut1_end),
    cut2_start: optionalInt(form.cut2_start),
    cut2_end: optionalInt(form.cut2_end),
    pay_frequency: form.pay_frequency || null,
    statutory_schedule: optionalText(form.statutory_schedule),
    wtax_schedule: optionalText(form.wtax_schedule),
    sss_basis: optionalText(form.sss_basis),
    philhealth_basis: optionalText(form.philhealth_basis),
    wtax_basis: optionalText(form.wtax_basis),
    include_cola: form.include_cola,
    include_sea: form.include_sea,
    include_ctpa: form.include_ctpa,
    admin_fee: optionalNum(form.admin_fee),
    vat: optionalNum(form.vat),
    ewt: optionalNum(form.ewt),
    thirteenth_month_year: optionalInt(form.thirteenth_month_year),
  };
}

export function pickClientPatch(
  body: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of CLIENT_FIELD_KEYS) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      out[key] = body[key];
    }
  }
  return out;
}
