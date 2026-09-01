/**
 * Compare GP payroll register lines to GREENHRISMAIN payroll_summary.
 * Diagnostic only — legacy amounts are not an oracle (ADR 0009).
 */

import sql from "mssql";
import { withLegacyPool } from "./sql";

const round2 = (n: number) => Math.round(n * 100) / 100;

export type LegacyPayrollSummaryRow = {
  employee_id: number;
  last_name: string | null;
  first_name: string | null;
  period_start: string;
  period_end: string;
  gross: number;
  sss_ee: number;
  philhealth_ee: number;
  pagibig_ee: number;
  wtax: number;
  salary_loan: number;
  pagibig_loan: number;
  net: number;
};

export type GpRegisterLineForParity = {
  directory_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  gross_pay: number;
  net_pay: number;
  deductions: Record<string, number>;
};

export type ParityStatus =
  | "match"
  | "mismatch"
  | "gp_only"
  | "legacy_only"
  | "gp_no_legacy_link";

export type PayrollParityRow = {
  status: ParityStatus;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  legacy_employee_id: number | null;
  gp: {
    gross: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    wtax: number;
    loans: number;
    net: number;
  };
  legacy: {
    gross: number | null;
    sss: number | null;
    philhealth: number | null;
    pagibig: number | null;
    wtax: number | null;
    loans: number | null;
    net: number | null;
  };
  delta: {
    gross: number | null;
    sss: number | null;
    philhealth: number | null;
    pagibig: number | null;
    wtax: number | null;
    loans: number | null;
    net: number | null;
  };
};

export type PayrollParitySummary = {
  rows: number;
  match: number;
  mismatch: number;
  gp_only: number;
  legacy_only: number;
  gp_no_legacy_link: number;
  gp_totals: {
    gross: number;
    net: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    wtax: number;
    loans: number;
  };
  legacy_totals: {
    gross: number;
    net: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    wtax: number;
    loans: number;
  };
};

function ymd(value: Date | string): string {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function delta(gp: number, legacy: number | null): number | null {
  if (legacy == null) return null;
  return round2(gp - legacy);
}

function amountsMatch(gp: number, legacy: number | null, tolerance = 0.02): boolean {
  if (legacy == null) return false;
  return Math.abs(gp - legacy) <= tolerance;
}

export async function fetchLegacyPayrollSummary(
  legacyClientId: number,
  periodStart: string,
  periodEnd: string
): Promise<LegacyPayrollSummaryRow[]> {
  return withLegacyPool(async (pool) => {
    const result = await pool
      .request()
      .input("clientId", sql.Int, legacyClientId)
      .input("start", sql.Date, periodStart)
      .input("end", sql.Date, periodEnd).query(`
        SELECT
          Employee_id,
          lname2,
          fname2,
          Date_Start,
          Date_End,
          grossalary,
          contributionSSSEE,
          contributionphilhealthEE,
          contributionPagibigEE,
          Wtax,
          Salary_Loan,
          Pagibig_Loan,
          netamount
        FROM dbo.payroll_summary
        WHERE idclientp = @clientId
          AND Date_Start = @start
          AND Date_End = @end
        ORDER BY lname2, fname2
      `);

    return (result.recordset as Array<Record<string, unknown>>).map((row) => ({
      employee_id: Number(row.Employee_id),
      last_name: (row.lname2 as string | null) ?? null,
      first_name: (row.fname2 as string | null) ?? null,
      period_start: ymd(row.Date_Start as Date | string),
      period_end: ymd(row.Date_End as Date | string),
      gross: Number(row.grossalary) || 0,
      sss_ee: Number(row.contributionSSSEE) || 0,
      philhealth_ee: Number(row.contributionphilhealthEE) || 0,
      pagibig_ee: Number(row.contributionPagibigEE) || 0,
      wtax: Number(row.Wtax) || 0,
      salary_loan: Number(row.Salary_Loan) || 0,
      pagibig_loan: Number(row.Pagibig_Loan) || 0,
      net: Number(row.netamount) || 0,
    }));
  });
}

export function compareRegisterToLegacy(input: {
  gpLines: GpRegisterLineForParity[];
  legacyRows: LegacyPayrollSummaryRow[];
  legacyIdByDirectoryId: Map<string, number>;
}): { rows: PayrollParityRow[]; summary: PayrollParitySummary } {
  const legacyByEmp = new Map<number, LegacyPayrollSummaryRow>();
  for (const row of input.legacyRows) {
    legacyByEmp.set(row.employee_id, row);
  }
  const usedLegacy = new Set<number>();
  const out: PayrollParityRow[] = [];

  const pushRow = (
    status: ParityStatus,
    gpLine: GpRegisterLineForParity | null,
    legacy: LegacyPayrollSummaryRow | null,
    legacyEmployeeId: number | null
  ) => {
    const d = gpLine?.deductions ?? {};
    const gpGross = gpLine ? round2(gpLine.gross_pay) : 0;
    const gpNet = gpLine ? round2(gpLine.net_pay) : 0;
    const gpSss = round2(Number(d.sss) || 0);
    const gpPhil = round2(Number(d.philhealth) || 0);
    const gpPag = round2(Number(d.pagibig) || 0);
    const gpWtax = round2(Number(d.withholding_tax) || 0);
    const gpLoans = round2(Number(d.loans) || 0);

    const legGross = legacy ? round2(legacy.gross) : null;
    const legNet = legacy ? round2(legacy.net) : null;
    const legSss = legacy ? round2(legacy.sss_ee) : null;
    const legPhil = legacy ? round2(legacy.philhealth_ee) : null;
    const legPag = legacy ? round2(legacy.pagibig_ee) : null;
    const legWtax = legacy ? round2(legacy.wtax) : null;
    const legLoans = legacy
      ? round2(legacy.salary_loan + legacy.pagibig_loan)
      : null;

    out.push({
      status,
      employee_code: gpLine?.employee_code ?? null,
      last_name: gpLine?.last_name ?? legacy?.last_name ?? null,
      first_name: gpLine?.first_name ?? legacy?.first_name ?? null,
      legacy_employee_id: legacyEmployeeId,
      gp: {
        gross: gpGross,
        sss: gpSss,
        philhealth: gpPhil,
        pagibig: gpPag,
        wtax: gpWtax,
        loans: gpLoans,
        net: gpNet,
      },
      legacy: {
        gross: legGross,
        sss: legSss,
        philhealth: legPhil,
        pagibig: legPag,
        wtax: legWtax,
        loans: legLoans,
        net: legNet,
      },
      delta: {
        gross: delta(gpGross, legGross),
        sss: delta(gpSss, legSss),
        philhealth: delta(gpPhil, legPhil),
        pagibig: delta(gpPag, legPag),
        wtax: delta(gpWtax, legWtax),
        loans: delta(gpLoans, legLoans),
        net: delta(gpNet, legNet),
      },
    });
  };

  for (const gp of input.gpLines) {
    const legacyId = gp.directory_employee_id
      ? input.legacyIdByDirectoryId.get(gp.directory_employee_id)
      : undefined;
    if (legacyId == null) {
      pushRow("gp_no_legacy_link", gp, null, null);
      continue;
    }
    const legacy = legacyByEmp.get(legacyId);
    if (!legacy) {
      pushRow("gp_only", gp, null, legacyId);
      continue;
    }
    usedLegacy.add(legacyId);
    const grossOk = amountsMatch(gp.gross_pay, legacy.gross);
    const netOk = amountsMatch(gp.net_pay, legacy.net);
    const match = grossOk && netOk;
    pushRow(match ? "match" : "mismatch", gp, legacy, legacyId);
  }

  for (const [legacyId, legacy] of legacyByEmp) {
    if (usedLegacy.has(legacyId)) continue;
    pushRow("legacy_only", null, legacy, legacyId);
  }

  const summary: PayrollParitySummary = {
    rows: out.length,
    match: out.filter((r) => r.status === "match").length,
    mismatch: out.filter((r) => r.status === "mismatch").length,
    gp_only: out.filter((r) => r.status === "gp_only").length,
    legacy_only: out.filter((r) => r.status === "legacy_only").length,
    gp_no_legacy_link: out.filter((r) => r.status === "gp_no_legacy_link").length,
    gp_totals: {
      gross: round2(out.reduce((a, r) => a + r.gp.gross, 0)),
      net: round2(out.reduce((a, r) => a + r.gp.net, 0)),
      sss: round2(out.reduce((a, r) => a + r.gp.sss, 0)),
      philhealth: round2(out.reduce((a, r) => a + r.gp.philhealth, 0)),
      pagibig: round2(out.reduce((a, r) => a + r.gp.pagibig, 0)),
      wtax: round2(out.reduce((a, r) => a + r.gp.wtax, 0)),
      loans: round2(out.reduce((a, r) => a + r.gp.loans, 0)),
    },
    legacy_totals: {
      gross: round2(
        out.reduce((a, r) => a + (r.legacy.gross ?? 0), 0)
      ),
      net: round2(out.reduce((a, r) => a + (r.legacy.net ?? 0), 0)),
      sss: round2(out.reduce((a, r) => a + (r.legacy.sss ?? 0), 0)),
      philhealth: round2(
        out.reduce((a, r) => a + (r.legacy.philhealth ?? 0), 0)
      ),
      pagibig: round2(out.reduce((a, r) => a + (r.legacy.pagibig ?? 0), 0)),
      wtax: round2(out.reduce((a, r) => a + (r.legacy.wtax ?? 0), 0)),
      loans: round2(out.reduce((a, r) => a + (r.legacy.loans ?? 0), 0)),
    },
  };

  return { rows: out, summary };
}

export function parityRowsToCsv(rows: PayrollParityRow[]): string {
  const header = [
    "status",
    "employee_code",
    "last_name",
    "first_name",
    "legacy_employee_id",
    "gp_gross",
    "legacy_gross",
    "delta_gross",
    "gp_net",
    "legacy_net",
    "delta_net",
    "gp_sss",
    "legacy_sss",
    "delta_sss",
    "gp_wtax",
    "legacy_wtax",
    "delta_wtax",
  ];
  const escape = (value: unknown) => {
    const s = value == null ? "" : String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = rows.map((row) =>
    [
      row.status,
      row.employee_code,
      row.last_name,
      row.first_name,
      row.legacy_employee_id,
      row.gp.gross,
      row.legacy.gross ?? "",
      row.delta.gross ?? "",
      row.gp.net,
      row.legacy.net ?? "",
      row.delta.net ?? "",
      row.gp.sss,
      row.legacy.sss ?? "",
      row.delta.sss ?? "",
      row.gp.wtax,
      row.legacy.wtax ?? "",
      row.delta.wtax ?? "",
    ]
      .map(escape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}
