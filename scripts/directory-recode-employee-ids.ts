/**
 * Recode Directory (and linked office) employee IDs to YYYYMM-#####.
 *
 * - Basis: first_hire_date → hire_date → created_at (year-month)
 * - Only current engagements get a new live code
 * - Old codes (legacy + prior YYYYMMDD) → employee_code_aliases
 *
 *   npm run transform:directory:recode:dry
 *   npm run transform:directory:recode:apply
 *   npm run transform:directory:recode:organic:apply   # Organic org only (~140)
 *   npm run transform:directory:recode:deployed:dry    # Deployed org only (~29k)
 *   npm run transform:directory:recode:deployed:apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");
const ORGANIC_ONLY = process.argv.includes("--organic-only");
const DEPLOYED_ONLY = process.argv.includes("--deployed-only");
const NEW_CODE_RE = /^[0-9]{6}-[0-9]{5}$/;

function loadEnvFile(fileName: string) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
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

function toPrefix(date: string | null | undefined, fallback: string): string {
  const candidates = [date, fallback, "1970-01-01"];
  for (const raw of candidates) {
    if (!raw) continue;
    const slice = String(raw).slice(0, 10);
    const d = new Date(`${slice}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) continue;
    const y = d.getUTCFullYear();
    // Reject SQL Server sentinels / corrupt years for ID basis
    if (y < 1990 || y > 2100) continue;
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    return `${y}${m}`;
  }
  return "197001";
}

type DirRow = {
  id: string;
  organization_id: string;
  employee_code: string | null;
  legacy_id: number | null;
  first_hire_date: string | null;
  hire_date: string | null;
  created_at: string;
  is_current_engagement: boolean;
};

type OfficeRow = {
  id: string;
  employee_id: string | null;
  employee_code: string | null;
  hire_date: string | null;
  directory_employee_id: string | null;
};

async function fetchAllDirectory(directory: ReturnType<SupabaseClient["schema"]>) {
  const rows: DirRow[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select(
        "id, organization_id, employee_code, legacy_id, first_hire_date, hire_date, created_at, is_current_engagement"
      )
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as DirRow[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  const { data: orgs } = await directory.from("organizations").select("id, name");
  const organicOrgId =
    (orgs ?? []).find((o) => /organic/i.test(String(o.name)))?.id ?? null;
  const deployedOrgId =
    (orgs ?? []).find((o) => /deployed/i.test(String(o.name)))?.id ?? null;

  if (ORGANIC_ONLY && DEPLOYED_ONLY) {
    throw new Error("Use only one of --organic-only or --deployed-only");
  }
  if (ORGANIC_ONLY && !organicOrgId) {
    throw new Error("Organic organization not found");
  }
  if (DEPLOYED_ONLY && !deployedOrgId) {
    throw new Error("Deployed organization not found");
  }

  const all = await fetchAllDirectory(directory);
  const masters = all.filter((r) => {
    if (!r.is_current_engagement) return false;
    if (ORGANIC_ONLY) return r.organization_id === organicOrgId;
    if (DEPLOYED_ONLY) return r.organization_id === deployedOrgId;
    return true;
  });
  const already = masters.filter((r) => NEW_CODE_RE.test(r.employee_code ?? ""));
  const toRecode = masters.filter((r) => !NEW_CODE_RE.test(r.employee_code ?? ""));

  // Per-org per-prefix sequence, seeding from existing new-format codes
  const nextSeq = new Map<string, number>();
  for (const row of all) {
    const code = row.employee_code ?? "";
    if (!NEW_CODE_RE.test(code)) continue;
    const prefix = code.slice(0, 6);
    const seq = Number(code.slice(7));
    const key = `${row.organization_id}::${prefix}`;
    nextSeq.set(key, Math.max(nextSeq.get(key) ?? 0, seq));
  }

  type Assignment = {
    id: string;
    organization_id: string;
    old_code: string | null;
    legacy_id: number | null;
    new_code: string;
    prefix: string;
  };
  const assignments: Assignment[] = [];

  // Stable order within prefix for deterministic codes
  const sorted = [...toRecode].sort((a, b) => {
    const ap = toPrefix(
      a.first_hire_date ?? a.hire_date,
      a.created_at.slice(0, 10)
    );
    const bp = toPrefix(
      b.first_hire_date ?? b.hire_date,
      b.created_at.slice(0, 10)
    );
    if (a.organization_id !== b.organization_id) {
      return a.organization_id.localeCompare(b.organization_id);
    }
    if (ap !== bp) return ap.localeCompare(bp);
    const al = a.legacy_id ?? Number.MAX_SAFE_INTEGER;
    const bl = b.legacy_id ?? Number.MAX_SAFE_INTEGER;
    if (al !== bl) return al - bl;
    return a.id.localeCompare(b.id);
  });

  for (const row of sorted) {
    const prefix = toPrefix(
      row.first_hire_date ?? row.hire_date,
      row.created_at.slice(0, 10)
    );
    const key = `${row.organization_id}::${prefix}`;
    const seq = (nextSeq.get(key) ?? 0) + 1;
    nextSeq.set(key, seq);
    assignments.push({
      id: row.id,
      organization_id: row.organization_id,
      old_code: row.employee_code,
      legacy_id: row.legacy_id,
      new_code: `${prefix}-${String(seq).padStart(5, "0")}`,
      prefix,
    });
  }

  const { data: officeData, error: officeError } = await admin
    .from("employees")
    .select("id, employee_id, employee_code, hire_date, directory_employee_id");
  if (officeError) throw new Error(officeError.message);
  const office = (officeData ?? []) as OfficeRow[];

  const newByDirId = new Map(assignments.map((a) => [a.id, a.new_code]));
  // Already-new masters keep their code for office sync
  for (const row of already) {
    if (row.employee_code) newByDirId.set(row.id, row.employee_code);
  }

  const officeLinked = office.filter((o) => o.directory_employee_id);
  const officeUnlinked = office.filter((o) => !o.directory_employee_id);

  type OfficeAssign = {
    id: string;
    old_id: string | null;
    new_code: string;
    via: "directory" | "allocated";
  };
  const officeAssign: OfficeAssign[] = [];

  for (const row of officeLinked) {
    const linkedCode = newByDirId.get(row.directory_employee_id!);
    if (!linkedCode) continue;
    if (
      row.employee_code === linkedCode &&
      row.employee_id === linkedCode
    ) {
      continue;
    }
    officeAssign.push({
      id: row.id,
      old_id: row.employee_id ?? row.employee_code,
      new_code: linkedCode,
      via: "directory",
    });
  }

  if (organicOrgId) {
    for (const row of officeUnlinked) {
      if (ORGANIC_ONLY || DEPLOYED_ONLY) {
        // Only allocate unlinked office rows when doing full recode.
        continue;
      }
      if (NEW_CODE_RE.test(row.employee_code ?? "") || NEW_CODE_RE.test(row.employee_id ?? "")) {
        continue;
      }
      const prefix = toPrefix(row.hire_date, "1970-01-01");
      const key = `${organicOrgId}::${prefix}`;
      const seq = (nextSeq.get(key) ?? 0) + 1;
      nextSeq.set(key, seq);
      officeAssign.push({
        id: row.id,
        old_id: row.employee_id ?? row.employee_code,
        new_code: `${prefix}-${String(seq).padStart(5, "0")}`,
        via: "allocated",
      });
    }
  }

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    scope: ORGANIC_ONLY
      ? "organic-only"
      : DEPLOYED_ONLY
        ? "deployed-only"
        : "all-organizations",
    organic_org_id: organicOrgId,
    deployed_org_id: deployedOrgId,
    directory: {
      masters: masters.length,
      already_new_format: already.length,
      to_recode: assignments.length,
      sample: assignments.slice(0, 10).map((a) => ({
        old: a.old_code,
        new: a.new_code,
      })),
      no_hire_using_created_at: toRecode.filter(
        (r) => !r.first_hire_date && !r.hire_date
      ).length,
    },
    office: {
      total: office.length,
      linked_to_sync: officeAssign.filter((o) => o.via === "directory").length,
      unlinked_to_allocate: officeAssign.filter((o) => o.via === "allocated")
        .length,
      sample: officeAssign.slice(0, 8),
    },
    note: "Old Directory codes become aliases. Clock login IDs for office staff change to the new code.",
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  // 1) Aliases for old codes (before live code changes)
  let aliasesOk = 0;
  let aliasesSkip = 0;
  const aliasRows = assignments
    .filter((a) => a.old_code)
    .map((a) => ({
      organization_id: a.organization_id,
      employee_id: a.id,
      alias_code: a.old_code,
      legacy_id: a.legacy_id,
      source_employee_id: a.id,
      note: `Former live code before YYYYMM-##### recode → ${a.new_code}`,
    }));

  for (let i = 0; i < aliasRows.length; i += 200) {
    const chunk = aliasRows.slice(i, i + 200);
    const { error } = await directory.from("employee_code_aliases").insert(chunk);
    if (error) {
      for (const row of chunk) {
        const { error: rowError } = await directory
          .from("employee_code_aliases")
          .insert(row);
        if (rowError) {
          if (rowError.code === "23505" || /unique|duplicate/i.test(rowError.message)) {
            aliasesSkip += 1;
            continue;
          }
          throw new Error(`alias: ${rowError.message}`);
        }
        aliasesOk += 1;
      }
    } else {
      aliasesOk += chunk.length;
    }
  }

  // 2) Update Directory codes in parallel chunks
  let dirUpdated = 0;
  for (let i = 0; i < assignments.length; i += 100) {
    const chunk = assignments.slice(i, i + 100);
    await Promise.all(
      chunk.map(async (a) => {
        const { error } = await directory
          .from("employees")
          .update({
            employee_code: a.new_code,
            employee_code_source: "directory",
            updated_at: new Date().toISOString(),
          })
          .eq("id", a.id);
        if (error) throw new Error(`dir ${a.id}: ${error.message}`);
        dirUpdated += 1;
      })
    );
    if (i % 1000 === 0 && i > 0) {
      console.log(`directory updated ${dirUpdated}/${assignments.length}`);
    }
  }

  // 3) Office sync — one live row per directory person (unique company + employee_code)
  const officeByDir = new Map<string, OfficeAssign[]>();
  for (const row of officeAssign) {
    const office = officeLinked.find((o) => o.id === row.id);
    const dirId = office?.directory_employee_id;
    if (!dirId) {
      continue;
    }
    const list = officeByDir.get(dirId) ?? [];
    list.push(row);
    officeByDir.set(dirId, list);
  }

  const officeToApply: OfficeAssign[] = [];
  const officeSkippedDup: Array<{ directory_employee_id: string; kept: string; skipped: string[] }> =
    [];

  for (const [dirId, rows] of officeByDir) {
    if (rows.length === 1) {
      officeToApply.push(rows[0]);
      continue;
    }
    const sorted = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    officeToApply.push(sorted[0]);
    officeSkippedDup.push({
      directory_employee_id: dirId,
      kept: sorted[0].id,
      skipped: sorted.slice(1).map((r) => r.id),
    });
  }

  let officeUpdated = 0;
  for (const row of officeToApply) {
    const office = officeLinked.find((o) => o.id === row.id);
    const { data: conflict } = await admin
      .from("employees")
      .select("id")
      .eq("employee_code", row.new_code)
      .neq("id", row.id)
      .maybeSingle();
    if (conflict) {
      await admin
        .from("employees")
        .update({ directory_employee_id: null, directory_client_id: null })
        .eq("id", row.id);
      continue;
    }
    const { error } = await admin
      .from("employees")
      .update({
        employee_id: row.new_code,
        employee_code: row.new_code,
      })
      .eq("id", row.id);
    if (error) throw new Error(`office ${row.id}: ${error.message}`);
    officeUpdated += 1;
    void office;
  }

  // Unlink duplicate office rows so they do not block future syncs / logins
  for (const dup of officeSkippedDup) {
    for (const skipId of dup.skipped) {
      await admin
        .from("employees")
        .update({ directory_employee_id: null, directory_client_id: null })
        .eq("id", skipId);
    }
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        aliases_inserted: aliasesOk,
        aliases_skipped: aliasesSkip,
        directory_recoded: dirUpdated,
        office_recoded: officeUpdated,
        office_duplicate_rows_unlinked: officeSkippedDup.reduce(
          (n, d) => n + d.skipped.length,
          0
        ),
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
