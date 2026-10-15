/**
 * SMXCC Sep 16–25: posted catalog register vs MAIN Excel + live funding.
 *
 *   ETL_SUPABASE_URL=http://127.0.0.1:8000 npx tsx scripts/smxcc-sep16-25-compare.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import XLSX from "xlsx";
import {
  buildCutoffSummaryBreakdown,
  fundingPeopleFromRegisterLines,
} from "../lib/payroll-register/cutoff-summary-breakdown";
import { fetchDirectoryEmployeesByIds } from "../lib/directory/fetch-employees-by-ids";

const PERIOD_START = "2026-09-16";
const PERIOD_END = "2026-09-25";
const LEGACY_CLIENT = 164;
const EXCEL = path.join(process.cwd(), "smxcc- sept 16-25.xlsx");

function loadEnvFile(fileName: string, override = false) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (override || !process.env[key]) process.env[key] = value;
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.production.local", true);

const r2 = (n: number) => Math.round(n * 100) / 100;
const n = (x: unknown) => Number(x) || 0;

function loadMainExcel() {
  const wb = XLSX.readFile(EXCEL);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
    header: 1,
    defval: "",
  }) as unknown[][];
  const total = rows[2] as unknown[];
  const people: {
    last: string;
    name: string;
    gross: number;
    sss: number;
    ph: number;
    pag: number;
    sssLoan: number;
    pagLoan: number;
    sssCal: number;
    pagCal: number;
    other: number;
    totalDed: number;
    net: number;
  }[] = [];
  for (let i = 3; i <= 63; i++) {
    const name = String(rows[i]?.[0] ?? "").trim();
    if (!name || !name.includes(",")) continue;
    people.push({
      last: name.split(",")[0]!.trim().toUpperCase(),
      name,
      gross: n(rows[i]![13]),
      sss: n(rows[i]![14]),
      ph: n(rows[i]![15]),
      pag: n(rows[i]![16]),
      sssLoan: n(rows[i]![17]),
      pagLoan: n(rows[i]![18]),
      sssCal: n(rows[i]![19]),
      pagCal: n(rows[i]![20]),
      other: n(rows[i]![21]),
      totalDed: n(rows[i]![22]),
      net: n(rows[i]![23]),
    });
  }
  const footer = rows[66] as unknown[];
  return {
    totals: {
      gross: n(total[13]),
      sss: n(total[14]),
      philhealth: n(total[15]),
      pagibig: n(total[16]),
      sssLoan: n(total[17]),
      pagLoan: n(total[18]),
      sssCal: n(total[19]),
      pagCal: n(total[20]),
      other: n(total[21]),
      totalDed: n(total[22]),
      net: n(total[23]),
      salaryCredit: n(footer[29]),
      gcash: n(footer[35]),
      cashInBank: n(footer[20]),
    },
    people,
  };
}

async function main() {
  const url = process.env.ETL_SUPABASE_URL || "http://127.0.0.1:8000";
  const db = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const dir = db.schema("directory");
  const main = loadMainExcel();

  const { data: clients } = await dir
    .from("clients")
    .select("id, name")
    .eq("legacy_id", LEGACY_CLIENT);
  const clientId = clients![0].id;
  const { data: cutoffs } = await db
    .from("cutoff_periods")
    .select("id, status, source_app")
    .eq("client_id", clientId)
    .eq("period_start", PERIOD_START)
    .eq("period_end", PERIOD_END);
  const cutoff = cutoffs![0];
  const { data: runs } = await db
    .from("payroll_register_runs")
    .select("id, status, totals, notes, updated_at")
    .eq("cutoff_period_id", cutoff.id)
    .order("updated_at", { ascending: false })
    .limit(1);
  const run = runs![0];
  const { data: lines } = await db
    .from("payroll_register_lines")
    .select(
      "directory_employee_id, last_name, first_name, employee_code, gross_pay, net_pay, total_deductions, deductions, earnings, loan_lines"
    )
    .eq("run_id", run.id)
    .order("last_name");

  const dirIds = [
    ...new Set(
      (lines || [])
        .map((l) => l.directory_employee_id)
        .filter(Boolean) as string[]
    ),
  ];
  const payThroughByDir = new Map<
    string,
    {
      pay_through?: string | null;
      bank_account_no?: string | null;
      gcash?: string | null;
    }
  >();
  const { data: dirEmps } = await fetchDirectoryEmployeesByIds(
    dir as any,
    dirIds,
    "id, pay_through, bank_account_no, gcash"
  );
  for (const row of dirEmps ?? []) {
    payThroughByDir.set(row.id as string, {
      pay_through: (row.pay_through as string | null) ?? null,
      bank_account_no: (row.bank_account_no as string | null) ?? null,
      gcash: (row.gcash as string | null) ?? null,
    });
  }

  const breakdown = buildCutoffSummaryBreakdown({
    lines: lines as any,
    fundingPeople: fundingPeopleFromRegisterLines(
      lines as any,
      payThroughByDir
    ),
    periodEnd: PERIOD_END,
  });
  const earn = Object.fromEntries(
    breakdown.earnings.items.map((i) => [i.key, i.amount])
  );
  const ded = Object.fromEntries(
    breakdown.deductions.items.map((i) => [i.key, i.amount])
  );

  let gpGross = 0;
  let gpNet = 0;
  let gpDed = 0;
  let gpSss = 0;
  let gpPh = 0;
  let gpPag = 0;
  let gpLoans = 0;
  let gpHmo = 0;
  for (const l of lines || []) {
    gpGross += n(l.gross_pay);
    gpNet += n(l.net_pay);
    gpDed += n(l.total_deductions);
    const d = (l.deductions || {}) as Record<string, number>;
    gpSss += n(d.sss);
    gpPh += n(d.philhealth);
    gpPag += n(d.pagibig);
    gpLoans += n(d.loans);
    for (const row of l.loan_lines || []) {
      if (String(row.particular || "").toLowerCase().includes("hmo")) {
        gpHmo += n(row.amount);
      }
    }
  }

  const mainByLast = new Map(main.people.map((p) => [p.last, p]));
  const mismatches: unknown[] = [];
  for (const l of lines || []) {
    const last = String(l.last_name || "").toUpperCase();
    const m = mainByLast.get(last);
    const d = (l.deductions || {}) as Record<string, number>;
    let hmo = 0;
    let sssLoan = 0;
    let pagLoan = 0;
    let sssCal = 0;
    let pagCal = 0;
    for (const row of l.loan_lines || []) {
      const amt = n(row.amount);
      const p = String(row.particular || "").toLowerCase();
      const t = String(row.loan_type || "").toLowerCase();
      if (p.includes("hmo")) hmo += amt;
      else if (t === "sss" || p.includes("sss loan") && !p.includes("calam"))
        sssLoan += amt;
      else if (t === "sss_calamity" || p.includes("calamity") && p.includes("sss"))
        sssCal += amt;
      else if (t === "pagibig_calamity" || (p.includes("calam") && p.includes("pag")))
        pagCal += amt;
      else if (t === "pagibig" || p.includes("pag")) pagLoan += amt;
    }
    if (!m) {
      mismatches.push({ last, status: "gp_only" });
      continue;
    }
    const delta = {
      gross: r2(n(l.gross_pay) - m.gross),
      net: r2(n(l.net_pay) - m.net),
      sss: r2(n(d.sss) - m.sss),
      ph: r2(n(d.philhealth) - m.ph),
      pag: r2(n(d.pagibig) - m.pag),
      other_hmo: r2(hmo - m.other),
      sssLoan: r2(sssLoan - m.sssLoan),
      pagLoan: r2(pagLoan - m.pagLoan),
      sssCal: r2(sssCal - m.sssCal),
      pagCal: r2(pagCal - m.pagCal),
    };
    const bad = Object.values(delta).some((v) => Math.abs(v) > 0.02);
    if (bad) mismatches.push({ last, name: `${l.last_name}, ${l.first_name}`, delta });
    mainByLast.delete(last);
  }
  for (const [last] of mainByLast) {
    mismatches.push({ last, status: "main_only" });
  }

  const report = {
    client: "SMXCC",
    period: `${PERIOD_START}…${PERIOD_END}`,
    cutoff_id: cutoff.id,
    cutoff_status: cutoff.status,
    source_app: cutoff.source_app,
    run_id: run.id,
    run_status: run.status,
    updated_at: run.updated_at,
    line_count: { gp: (lines || []).length, main: main.people.length },
    totals: {
      main: main.totals,
      gp_run: run.totals,
      gp_line_sums: {
        gross: r2(gpGross),
        net: r2(gpNet),
        total_deductions: r2(gpDed),
        sss: r2(gpSss),
        philhealth: r2(gpPh),
        pagibig: r2(gpPag),
        loans: r2(gpLoans),
        hmo_other: r2(gpHmo),
      },
      gp_summary: {
        salaries_and_wages: earn.salaries_and_wages,
        salary_credit: earn.salary_credit,
        gcash: earn.gcash,
        cash_in_bank: earn.cash_in_bank,
        other_deduction: ded.other_deduction,
        sss_loan: ded.sss_loan,
        pagibig_loan: ded.pagibig_loan,
        sss_calamity_loan: ded.sss_calamity_loan,
        pagibig_calamity_loan: ded.pagibig_calamity_loan,
      },
      delta_gp_minus_main: {
        gross: r2(gpGross - main.totals.gross),
        net: r2(gpNet - main.totals.net),
        total_deductions: r2(gpDed - main.totals.totalDed),
        sss: r2(gpSss - main.totals.sss),
        philhealth: r2(gpPh - main.totals.philhealth),
        pagibig: r2(gpPag - main.totals.pagibig),
        other_hmo: r2(gpHmo - main.totals.other),
        salary_credit: r2(
          Number(earn.salary_credit || 0) - main.totals.salaryCredit
        ),
        gcash: r2(Number(earn.gcash || 0) - main.totals.gcash),
      },
    },
    person_mismatches: mismatches.length,
    mismatches,
  };

  const outDir = path.join(process.cwd(), "tmp", "sample-match");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(
    outDir,
    "smxcc-2026-09-16_2026-09-25-summary.json"
  );
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2), "utf8");

  console.log("\n=== SMXCC Sep 16–25 MAIN vs GP ===\n");
  console.log(
    `Cutoff ${cutoff.id} · ${cutoff.status} · ${cutoff.source_app}`
  );
  console.log(`Run ${run.id} · ${run.status} · lines ${report.line_count.gp}`);
  console.log("\nTotals Δ (GP − MAIN):");
  console.table(report.totals.delta_gp_minus_main);
  console.log(
    `\nPerson mismatches: ${mismatches.length} of ${report.line_count.gp}`
  );
  if (mismatches.length) {
    console.log(JSON.stringify(mismatches.slice(0, 10), null, 2));
  }
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
