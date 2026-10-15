/**
 * Sync pay channel + bank/GCash details from GREENHRISMAIN → Directory.
 *
 * Source per person:
 *   - dbo.Employee: paythrough, gcash, bankname, bankaccountno
 *   - latest payroll_summary: payrollpaytype, gcashp, payrollatmno, empbankname
 *     (fills blanks / corrects channel when summary disagrees — e.g. Galvez)
 *
 * Only updates existing Directory rows matched by legacy_id.
 * Never clears a Directory value when MAIN is blank.
 *
 *   npx tsx scripts/etl-greenhrismain-pay-fields.ts
 *   npx tsx scripts/etl-greenhrismain-pay-fields.ts --apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sql from "mssql";
import { parseFundingPayThrough } from "../lib/payroll-register/funding-memo";
import { loadMainEtlEnv, requiredEnv } from "../lib/etl/main-etl-env";

type Row = Record<string, unknown>;

const APPLY = process.argv.includes("--apply");

loadMainEtlEnv();
const required = requiredEnv;

function asInt(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function digitsOnly(value: string | null | undefined): string {
  return String(value ?? "").replace(/\D/g, "");
}

/** Stable Directory spellings for the funding channels we know. */
function canonicalPayThrough(raw: string | null): string | null {
  if (!raw) return null;
  const ch = parseFundingPayThrough(raw);
  if (ch === "atm") return "Atm";
  if (ch === "gcash") return "GCash";
  if (ch === "cheque") return "Cash";
  if (ch === "hold") return "Hold";
  return raw;
}

function channelKey(raw: string | null | undefined): string {
  return parseFundingPayThrough(raw ?? null);
}

async function connectSql() {
  return sql.connect({
    server: required("SQL_HOST"),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    options: { encrypt: false, trustServerCertificate: true },
    port: Number(process.env.SQL_PORT || 1433),
    requestTimeout: 120000,
  });
}

function directoryAdmin(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  ).schema("directory");
}

async function loadDirectoryPayFields(admin: SupabaseClient) {
  const byLegacy = new Map<
    number,
    {
      id: string;
      organization_id: string | null;
      pay_through: string | null;
      gcash: string | null;
      bank_name: string | null;
      bank_account_no: string | null;
    }
  >();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("employees")
      .select(
        "id, organization_id, legacy_id, pay_through, gcash, bank_name, bank_account_no"
      )
      .not("legacy_id", "is", null)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      const legacyId = asInt(row.legacy_id);
      if (legacyId == null || !row.id) continue;
      byLegacy.set(legacyId, {
        id: row.id as string,
        organization_id: (row.organization_id as string | null) ?? null,
        pay_through: asText(row.pay_through),
        gcash: asText(row.gcash),
        bank_name: asText(row.bank_name),
        bank_account_no: asText(row.bank_account_no),
      });
    }
    if (data.length < page) break;
  }
  return byLegacy;
}

type Desired = {
  pay_through: string | null;
  gcash: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
};

function desiredFromMain(row: Row): Desired {
  const empThrough = asText(row.paythrough);
  const summaryThrough = asText(row.payrollpaytype);
  // Prefer latest posted pay type when present (ops truth); else employee master.
  const pay_through = canonicalPayThrough(summaryThrough ?? empThrough);

  const empGcash = asText(row.gcash);
  const summaryGcash = asText(row.gcashp);
  const gcash = empGcash ?? summaryGcash;

  const bank_name = asText(row.bankname) ?? asText(row.empbankname);
  const bank_account_no =
    asText(row.bankaccountno) ?? asText(row.payrollatmno);

  return { pay_through, gcash, bank_name, bank_account_no };
}

type Patch = Partial<Desired> & { reasons: string[] };

function buildPatch(
  current: {
    pay_through: string | null;
    gcash: string | null;
    bank_name: string | null;
    bank_account_no: string | null;
  },
  desired: Desired
): Patch | null {
  const patch: Patch = { reasons: [] };

  if (desired.pay_through) {
    const curCh = channelKey(current.pay_through);
    const wantCh = channelKey(desired.pay_through);
    const curBlank = !current.pay_through;
    if (curBlank || curCh !== wantCh) {
      patch.pay_through = desired.pay_through;
      patch.reasons.push(
        curBlank
          ? `pay_through blank→${desired.pay_through}`
          : `pay_through ${current.pay_through}→${desired.pay_through}`
      );
    }
  }

  if (desired.gcash) {
    if (digitsOnly(current.gcash) !== digitsOnly(desired.gcash)) {
      patch.gcash = desired.gcash;
      patch.reasons.push(
        current.gcash
          ? `gcash ${current.gcash}→${desired.gcash}`
          : `gcash blank→${desired.gcash}`
      );
    }
  }

  if (desired.bank_name) {
    if (
      (current.bank_name ?? "").toLowerCase() !==
      desired.bank_name.toLowerCase()
    ) {
      patch.bank_name = desired.bank_name;
      patch.reasons.push(
        current.bank_name
          ? `bank_name ${current.bank_name}→${desired.bank_name}`
          : `bank_name blank→${desired.bank_name}`
      );
    }
  }

  if (desired.bank_account_no) {
    if (
      digitsOnly(current.bank_account_no) !==
      digitsOnly(desired.bank_account_no)
    ) {
      patch.bank_account_no = desired.bank_account_no;
      patch.reasons.push(
        current.bank_account_no
          ? `bank_account_no ${current.bank_account_no}→${desired.bank_account_no}`
          : `bank_account_no blank→${desired.bank_account_no}`
      );
    }
  }

  if (!patch.reasons.length) return null;
  return patch;
}

async function main() {
  console.log(APPLY ? "APPLY mode" : "Dry-run (pass --apply to write)");
  const pool = await connectSql();
  const admin = directoryAdmin();

  console.log("Loading MAIN employees + latest payroll pay type…");
  const result = await pool.request().query(`
    SELECT
      e.Employee_id,
      e.lname,
      e.fname,
      e.paythrough,
      e.gcash,
      e.bankname,
      e.bankaccountno,
      latest.payrollpaytype,
      latest.gcashp,
      latest.payrollatmno,
      latest.empbankname
    FROM dbo.Employee e
    OUTER APPLY (
      SELECT TOP 1
        ps.payrollpaytype,
        ps.gcashp,
        ps.payrollatmno,
        ps.empbankname
      FROM dbo.payroll_summary ps
      WHERE ps.Employee_id = e.Employee_id
      ORDER BY ps.payrolldate DESC, ps.idpayrollsum DESC
    ) latest
    WHERE ISNULL(e.tagdelete, '') NOT IN ('1', 'Y', 'y')
      AND (
        e.verificationstatus IS NULL
        OR LTRIM(RTRIM(CAST(e.verificationstatus AS nvarchar(100)))) = ''
        OR e.verificationstatus = 'Verified'
      )
    ORDER BY e.Employee_id
  `);
  const mainRows = result.recordset as Row[];
  console.log(`MAIN rows: ${mainRows.length}`);

  console.log("Loading Directory pay fields…");
  const directory = await loadDirectoryPayFields(admin);
  console.log(`Directory with legacy_id: ${directory.size}`);

  let matched = 0;
  let missing = 0;
  let unchanged = 0;
  let wouldChange = 0;
  let updated = 0;
  const byReason: Record<string, number> = {};
  const samples: Array<{
    legacy_id: number;
    name: string;
    changes: string[];
  }> = [];

  for (const row of mainRows) {
    const legacyId = asInt(row.Employee_id);
    if (legacyId == null) continue;
    const cur = directory.get(legacyId);
    if (!cur) {
      missing += 1;
      continue;
    }
    matched += 1;

    const desired = desiredFromMain(row);
    const patch = buildPatch(cur, desired);
    if (!patch) {
      unchanged += 1;
      continue;
    }

    wouldChange += 1;
    for (const reason of patch.reasons) {
      const key = reason.split(" ")[0]!;
      byReason[key] = (byReason[key] || 0) + 1;
    }
    if (samples.length < 25) {
      samples.push({
        legacy_id: legacyId,
        name: `${asText(row.lname) ?? "?"}, ${asText(row.fname) ?? "?"}`,
        changes: patch.reasons,
      });
    }

    if (!APPLY) continue;

    const updateBody: Record<string, string> = {};
    if (patch.pay_through) updateBody.pay_through = patch.pay_through;
    if (patch.gcash) updateBody.gcash = patch.gcash;
    if (patch.bank_name) updateBody.bank_name = patch.bank_name;
    if (patch.bank_account_no) updateBody.bank_account_no = patch.bank_account_no;

    let q = admin.from("employees").update(updateBody).eq("id", cur.id);
    if (cur.organization_id) {
      q = q.eq("organization_id", cur.organization_id);
    }
    const { error } = await q;
    if (error) throw error;
    updated += 1;
    if (updated % 500 === 0) console.log(`updated ${updated}`);
  }

  await pool.close();

  console.log(
    JSON.stringify(
      {
        mode: "pay-fields",
        apply: APPLY,
        main_rows: mainRows.length,
        matched_in_directory: matched,
        missing_in_directory: missing,
        unchanged,
        would_change: wouldChange,
        updated: APPLY ? updated : 0,
        by_field: byReason,
        samples,
      },
      null,
      2
    )
  );
  if (!APPLY) {
    console.log(
      "Dry-run only. Re-run with --apply to write pay_through / gcash / bank fields."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
