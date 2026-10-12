/**
 * 201 file completeness — agencies need gov IDs + pay channel before remittance.
 */

export type CompletenessItem = {
  key: string;
  label: string;
  ok: boolean;
  group: "identity" | "government" | "assignment" | "pay";
};

export type CompletenessReport = {
  score: number;
  total: number;
  missing: CompletenessItem[];
  items: CompletenessItem[];
  ready_for_payroll: boolean;
};

export type CompletenessAccess = {
  /** When false, omit daily_rate (actor cannot see salary — redacted null is not a gap). */
  includeSalary?: boolean;
  /** When false, omit bank/GCash (actor cannot see pay channel). */
  includePayChannel?: boolean;
};

function present(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  return true;
}

function positiveRate(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

export function compute201Completeness(
  employee: {
    last_name?: string | null;
    first_name?: string | null;
    birth_date?: string | null;
    hire_date?: string | null;
    sex?: string | null;
    tin?: string | null;
    sss_number?: string | null;
    philhealth_number?: string | null;
    pagibig_number?: string | null;
    client_id?: string | null;
    position_id?: string | null;
    daily_rate?: number | string | null;
    bank_account_no?: string | null;
    gcash?: string | null;
    pay_through?: string | null;
    mobile?: string | null;
  },
  access: CompletenessAccess = {}
): CompletenessReport {
  const includeSalary = access.includeSalary !== false;
  const includePayChannel = access.includePayChannel !== false;

  const items: CompletenessItem[] = [
    {
      key: "name",
      label: "Full name",
      ok: present(employee.last_name) && present(employee.first_name),
      group: "identity",
    },
    {
      key: "birth_date",
      label: "Birth date",
      ok: present(employee.birth_date),
      group: "identity",
    },
    {
      key: "sex",
      label: "Sex",
      ok: present(employee.sex),
      group: "identity",
    },
    {
      key: "hire_date",
      label: "Hire date",
      ok: present(employee.hire_date),
      group: "identity",
    },
    {
      key: "mobile",
      label: "Mobile",
      ok: present(employee.mobile),
      group: "identity",
    },
    {
      key: "tin",
      label: "TIN",
      ok: present(employee.tin),
      group: "government",
    },
    {
      key: "sss",
      label: "SSS",
      ok: present(employee.sss_number),
      group: "government",
    },
    {
      key: "philhealth",
      label: "PhilHealth",
      ok: present(employee.philhealth_number),
      group: "government",
    },
    {
      key: "pagibig",
      label: "Pag-IBIG",
      ok: present(employee.pagibig_number),
      group: "government",
    },
    {
      key: "client",
      label: "Client assignment",
      ok: present(employee.client_id),
      group: "assignment",
    },
    {
      key: "position",
      label: "Position",
      ok: present(employee.position_id),
      group: "assignment",
    },
  ];

  if (includeSalary) {
    items.push({
      key: "daily_rate",
      label: "Daily rate",
      ok: positiveRate(employee.daily_rate),
      group: "pay",
    });
  }
  if (includePayChannel) {
    items.push({
      key: "pay_channel",
      label: "Bank account or GCash",
      ok: present(employee.bank_account_no) || present(employee.gcash),
      group: "pay",
    });
  }

  const missing = items.filter((i) => !i.ok);
  const score = items.filter((i) => i.ok).length;
  const govOk = items
    .filter((i) => i.group === "government")
    .every((i) => i.ok);
  const payItems = items.filter((i) => i.group === "pay");
  const payOk = payItems.length === 0 || payItems.every((i) => i.ok);
  const assignOk = items
    .filter((i) => i.group === "assignment")
    .every((i) => i.ok);

  return {
    score,
    total: items.length,
    missing,
    items,
    ready_for_payroll: govOk && payOk && assignOk && present(employee.hire_date),
  };
}
