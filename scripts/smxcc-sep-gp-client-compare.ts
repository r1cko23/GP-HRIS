/**
 * SMXCC Sep 1–15: GP-Client ingested hours → draft register vs MAIN payroll_summary.
 * Debit-memo grain = net (and supporting gross / statutory / loans).
 *
 *   npx tsx scripts/smxcc-sep-gp-client-compare.ts
 */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import {
  compareRegisterToLegacy,
  type GpRegisterLineForParity,
  type LegacyPayrollSummaryRow,
} from "../lib/legacy-greenhrismain/payroll-summary-parity";

const CUTOFF_ID = "d6d1331c-9b64-445e-8137-1da3b05cc9da";
const RUN_ID = "b21c21a0-a446-4e4e-8dcc-42d46591343b";
const PERIOD_START = "2026-09-01";
const PERIOD_END = "2026-09-15";
const MAIN_DUMP = path.join(
  process.cwd(),
  "tmp",
  "sample-match",
  "smxcc-2026-09-01_2026-09-15-main.json"
);

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function csvEscape(value: unknown): string {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

async function main() {
  const publicDb = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directoryDb = publicDb.schema("directory");

  const { data: hourSources, error: srcErr } = await publicDb
    .from("cutoff_hours")
    .select("source_of_data")
    .eq("cutoff_period_id", CUTOFF_ID);
  if (srcErr) throw new Error(srcErr.message);
  const fromMain = (hourSources ?? []).filter((r) =>
    String(r.source_of_data ?? "")
      .toUpperCase()
      .includes("GREENHRISMAIN")
  ).length;
  const fromGpClient = (hourSources ?? []).filter((r) =>
    String(r.source_of_data ?? "")
      .toUpperCase()
      .includes("GP-CLIENT")
  ).length;
  if (fromMain > 0) {
    throw new Error(`Cutoff still has ${fromMain} MAIN-sourced hours`);
  }
  console.log(
    `Hours: total=${hourSources?.length ?? 0} GP-CLIENT=${fromGpClient} MAIN=${fromMain}`
  );

  const { data: lines, error: linesError } = await publicDb
    .from("payroll_register_lines")
    .select(
      "directory_employee_id, employee_code, last_name, first_name, gross_pay, net_pay, deductions"
    )
    .eq("run_id", RUN_ID)
    .order("last_name");
  if (linesError) throw new Error(linesError.message);

  const payload = JSON.parse(fs.readFileSync(MAIN_DUMP, "utf8")) as {
    rows: LegacyPayrollSummaryRow[];
    totals: Record<string, number>;
  };

  const dirIds = [
    ...new Set(
      (lines ?? [])
        .map((l) => l.directory_employee_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];
  const legacyIdByDirectoryId = new Map<string, number>();
  if (dirIds.length) {
    const { data: people } = await directoryDb
      .from("employees")
      .select("id, legacy_id")
      .in("id", dirIds);
    for (const row of people ?? []) {
      if (row.legacy_id != null) {
        legacyIdByDirectoryId.set(row.id as string, Number(row.legacy_id));
      }
    }
  }

  const gpLines: GpRegisterLineForParity[] = (lines ?? []).map((line) => ({
    directory_employee_id: line.directory_employee_id as string | null,
    employee_code: line.employee_code as string | null,
    last_name: line.last_name as string | null,
    first_name: line.first_name as string | null,
    gross_pay: Number(line.gross_pay) || 0,
    net_pay: Number(line.net_pay) || 0,
    deductions: (line.deductions ?? {}) as Record<string, number>,
  }));

  const { rows, summary } = compareRegisterToLegacy({
    gpLines,
    legacyRows: payload.rows,
    legacyIdByDirectoryId,
  });

  const outDir = path.join(process.cwd(), "tmp", "sample-match");
  fs.mkdirSync(outDir, { recursive: true });

  const mismatches = rows
    .filter((r) => r.status === "mismatch")
    .map((r) => ({ ...r, abs_net_delta: Math.abs(r.delta.net ?? 0) }))
    .sort((a, b) => b.abs_net_delta - a.abs_net_delta);

  const exactNet = rows.filter(
    (r) => r.status === "match" || (r.delta.net != null && Math.abs(r.delta.net) <= 0.02)
  ).length;
  const exactGross = rows.filter(
    (r) => r.delta.gross != null && Math.abs(r.delta.gross) <= 0.02
  ).length;

  const summaryPath = path.join(
    outDir,
    "smxcc-2026-09-01_2026-09-15-summary.json"
  );
  fs.writeFileSync(
    summaryPath,
    JSON.stringify(
      {
        client: "SMXCC",
        legacy_client_id: 164,
        cutoff_id: CUTOFF_ID,
        register_run_id: RUN_ID,
        period_start: PERIOD_START,
        period_end: PERIOD_END,
        hours_source: "GP-CLIENT",
        hours_count: hourSources?.length ?? 0,
        note:
          "Debit-memo grain is net. GP hours from Validated GP-Client ingest, not MAIN catalog.",
        summary,
        exact_gross_count: exactGross,
        exact_net_count: exactNet,
        top_mismatches: mismatches
          .slice(0, 15)
          .map(({ abs_net_delta: _, ...r }) => r),
      },
      null,
      2
    ),
    "utf8"
  );

  const csvPath = path.join(outDir, "smxcc-2026-09-01_2026-09-15.csv");
  const header = [
    "employee_code",
    "last_name",
    "first_name",
    "legacy_id",
    "status",
    "gp_gross",
    "legacy_gross",
    "delta_gross",
    "gp_sss",
    "legacy_sss",
    "delta_sss",
    "gp_philhealth",
    "legacy_philhealth",
    "delta_philhealth",
    "gp_pagibig",
    "legacy_pagibig",
    "delta_pagibig",
    "gp_wtax",
    "legacy_wtax",
    "delta_wtax",
    "gp_loans",
    "legacy_loans",
    "delta_loans",
    "gp_net",
    "legacy_net",
    "delta_net",
  ];
  const csvRows = [header.join(",")];
  for (const r of rows) {
    csvRows.push(
      [
        r.employee_code ?? "",
        r.last_name ?? "",
        r.first_name ?? "",
        r.legacy_employee_id ?? "",
        r.status,
        r.gp.gross,
        r.legacy.gross ?? "",
        r.delta.gross ?? "",
        r.gp.sss,
        r.legacy.sss ?? "",
        r.delta.sss ?? "",
        r.gp.philhealth,
        r.legacy.philhealth ?? "",
        r.delta.philhealth ?? "",
        r.gp.pagibig,
        r.legacy.pagibig ?? "",
        r.delta.pagibig ?? "",
        r.gp.wtax,
        r.legacy.wtax ?? "",
        r.delta.wtax ?? "",
        r.gp.loans,
        r.legacy.loans ?? "",
        r.delta.loans ?? "",
        r.gp.net,
        r.legacy.net ?? "",
        r.delta.net ?? "",
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  fs.writeFileSync(csvPath, csvRows.join("\n"), "utf8");

  console.log("\nParity", summary);
  console.log("exact gross", exactGross, "exact net", exactNet);
  console.log("\nTotals Δ (GP − MAIN) [debit-memo focus = net]:");
  console.log({
    gross: round2(summary.gp_totals.gross - summary.legacy_totals.gross),
    net: round2(summary.gp_totals.net - summary.legacy_totals.net),
    sss: round2(summary.gp_totals.sss - summary.legacy_totals.sss),
    philhealth: round2(
      summary.gp_totals.philhealth - summary.legacy_totals.philhealth
    ),
    pagibig: round2(summary.gp_totals.pagibig - summary.legacy_totals.pagibig),
    wtax: round2(summary.gp_totals.wtax - summary.legacy_totals.wtax),
    loans: round2(summary.gp_totals.loans - summary.legacy_totals.loans),
  });
  console.log(`Wrote ${summaryPath}`);
  console.log(`Wrote ${csvPath}`);
  if (mismatches.length) {
    console.log("\nTop net mismatches:");
    for (const m of mismatches.slice(0, 10)) {
      console.log(
        `  ${m.last_name}, ${m.first_name}  grossΔ=${m.delta.gross} wtaxΔ=${m.delta.wtax} loansΔ=${m.delta.loans} netΔ=${m.delta.net}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
