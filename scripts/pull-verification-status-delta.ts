/**
 * One-shot: pull MAIN verificationstatus vs Directory and list verification-related deltas.
 * Local on-prem Supabase only (lib/etl/main-etl-env.ts).
 *   npx tsx scripts/pull-verification-status-delta.ts
 */
import { createClient } from "@supabase/supabase-js";
import sql from "mssql";
import {
  isLegacy201VerificationPassed,
  mapLegacyEmployeeStatus,
} from "../lib/directory/legacy-status";
import { loadMainEtlEnv, requiredEnv } from "../lib/etl/main-etl-env";

loadMainEtlEnv();
const required = requiredEnv;

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  const pool = await sql.connect({
    server: required("SQL_HOST"),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    options: { encrypt: false, trustServerCertificate: true },
    connectionTimeout: 15000,
    requestTimeout: 300000,
  });

  try {
    const barredRes = await pool
      .request()
      .query(`SELECT employeeid FROM dbo.barred`);
    const barredIds = new Set<number>(
      (barredRes.recordset as Array<{ employeeid: number }>)
        .map((r) => r.employeeid)
        .filter((id) => Number.isFinite(id))
    );

    const legacyRes = await pool.request().query(`
      SELECT Employee_id, status, employee_status, verificationstatus,
             verifiedforverification, finalpaystatus
      FROM dbo.Employee
      WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')
    `);

    type LegacyRow = {
      Employee_id: number;
      status: string | null;
      employee_status: string | null;
      verificationstatus: string | null;
      verifiedforverification: string | null;
      finalpaystatus: string | null;
    };

    const legacyById = new Map<number, LegacyRow>();
    const verifCounts: Record<string, number> = {};
    let passed = 0;
    let notPassed = 0;
    for (const row of legacyRes.recordset as LegacyRow[]) {
      legacyById.set(row.Employee_id, row);
      const raw = String(row.verificationstatus ?? "").trim();
      const label = raw || "(blank)";
      verifCounts[label] = (verifCounts[label] ?? 0) + 1;
      if (isLegacy201VerificationPassed(row.verificationstatus)) passed += 1;
      else notPassed += 1;
    }

    type DirRow = {
      id: string;
      legacy_id: number;
      status: string;
      last_name: string | null;
      first_name: string | null;
      employee_code: string | null;
      is_current_engagement: boolean | null;
    };

    const dirRows: DirRow[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await directory
        .from("employees")
        .select(
          "id, legacy_id, status, last_name, first_name, employee_code, is_current_engagement"
        )
        .order("legacy_id")
        .range(from, from + 999);
      if (error) throw error;
      if (!data?.length) break;
      dirRows.push(...(data as DirRow[]));
      if (data.length < 1000) break;
    }

    const transitions: Record<string, number> = {};
    const verifRelated: Array<Record<string, unknown>> = [];
    let stillVerifiedActive = 0;
    let nowPendingNeedsForVerification = 0;
    let wasForVerificationNowPassed = 0;

    for (const row of dirRows) {
      const legacy = legacyById.get(row.legacy_id);
      if (!legacy) continue;
      const normalized = mapLegacyEmployeeStatus(
        {
          Employee_id: legacy.Employee_id,
          status: legacy.status,
          employee_status: legacy.employee_status,
          verificationstatus: legacy.verificationstatus,
          verifiedforverification: legacy.verifiedforverification,
          finalpaystatus: legacy.finalpaystatus,
        },
        barredIds
      );

      const passedGate = isLegacy201VerificationPassed(
        legacy.verificationstatus
      );
      if (
        row.status === "active" &&
        passedGate &&
        normalized.status === "active"
      ) {
        stillVerifiedActive += 1;
      }

      if (row.status === normalized.status) continue;
      const key = `${row.status} → ${normalized.status}`;
      transitions[key] = (transitions[key] ?? 0) + 1;

      if (
        row.status === "for_verification" ||
        normalized.status === "for_verification"
      ) {
        if (
          normalized.status === "for_verification" &&
          row.status !== "for_verification"
        ) {
          nowPendingNeedsForVerification += 1;
        }
        if (
          row.status === "for_verification" &&
          normalized.status !== "for_verification"
        ) {
          wasForVerificationNowPassed += 1;
        }
        verifRelated.push({
          legacy_id: row.legacy_id,
          code: row.employee_code,
          name: [row.last_name, row.first_name].filter(Boolean).join(", "),
          from: row.status,
          to: normalized.status,
          main_verification: legacy.verificationstatus,
          verifiedforverification: legacy.verifiedforverification,
          current: row.is_current_engagement,
        });
      }
    }

    console.log(
      JSON.stringify(
        {
          main_verificationstatus_counts: Object.fromEntries(
            Object.entries(verifCounts).sort((a, b) => b[1] - a[1])
          ),
          main_passed_blank_or_Verified: passed,
          main_not_passed: notPassed,
          directory_still_active_and_main_verified: stillVerifiedActive,
          moving_into_for_verification: nowPendingNeedsForVerification,
          leaving_for_verification: wasForVerificationNowPassed,
          directory_status_transitions: Object.fromEntries(
            Object.entries(transitions).sort((a, b) => b[1] - a[1])
          ),
          verification_related_changes: verifRelated.length,
          verification_related: verifRelated,
        },
        null,
        2
      )
    );
  } finally {
    await pool.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
