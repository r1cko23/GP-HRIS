/**
 * Transform migrated GREENHRISMAIN rehire chains onto person-as-master (ADR 0006).
 *
 * For each person_key group:
 * - Keep the current engagement as the live master (does not rewrite employee_code)
 * - Set first_hire_date = earliest hire in the chain
 * - Register superseded codes / legacy_ids as employee_code_aliases
 * - Append a movement row on the master for each prior engagement
 *
 * Does NOT delete superseded 201 rows (audit). New hires later get YYYYMM-#####.
 *
 *   npm run transform:directory:person:dry
 *   npm run transform:directory:person:apply
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");

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

type Emp = {
  id: string;
  organization_id: string;
  person_key: string | null;
  is_current_engagement: boolean;
  superseded_by: string | null;
  employee_code: string | null;
  legacy_id: number | null;
  hire_date: string | null;
  resign_date: string | null;
  status: string;
  first_hire_date: string | null;
  employee_code_source: string | null;
  client_id: string | null;
};

async function fetchAllEmployees(admin: SupabaseClient): Promise<Emp[]> {
  const directory = admin.schema("directory");
  const pageSize = 1000;
  const rows: Emp[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await directory
      .from("employees")
      .select(
        "id, organization_id, person_key, is_current_engagement, superseded_by, employee_code, legacy_id, hire_date, resign_date, status, first_hire_date, employee_code_source, client_id"
      )
      .order("id")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as Emp[];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

function earlierDate(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a <= b ? a : b;
}

async function main() {
  const admin = createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const directory = admin.schema("directory");

  const employees = await fetchAllEmployees(admin);
  console.log(`Loaded ${employees.length} directory employees`);

  const byPerson = new Map<string, Emp[]>();
  const noKey: Emp[] = [];
  for (const row of employees) {
    if (!row.person_key) {
      noKey.push(row);
      continue;
    }
    const key = `${row.organization_id}::${row.person_key}`;
    const list = byPerson.get(key) ?? [];
    list.push(row);
    byPerson.set(key, list);
  }

  type AliasInsert = {
    organization_id: string;
    employee_id: string;
    alias_code: string | null;
    legacy_id: number | null;
    source_employee_id: string;
    note: string;
  };
  type MovementInsert = {
    organization_id: string;
    employee_id: string;
    date_from: string | null;
    date_to: string | null;
    status: string;
    remarks: string;
  };
  type MasterPatch = {
    id: string;
    first_hire_date: string | null;
    employee_code_source: string;
  };

  const aliases: AliasInsert[] = [];
  const movements: MovementInsert[] = [];
  const masterPatches: MasterPatch[] = [];
  let chains = 0;
  let singles = 0;
  let alreadyTransformed = 0;

  for (const group of byPerson.values()) {
    const master =
      group.find((r) => r.is_current_engagement) ??
      group.slice().sort((a, b) => {
        const ah = a.hire_date ?? "";
        const bh = b.hire_date ?? "";
        return bh.localeCompare(ah);
      })[0];
    if (!master) continue;

    let firstHire = master.hire_date;
    for (const row of group) {
      firstHire = earlierDate(firstHire, row.hire_date);
    }

    const priors = group.filter((r) => r.id !== master.id);
    if (priors.length === 0) {
      singles += 1;
      if (
        master.first_hire_date === firstHire &&
        (master.employee_code_source === "legacy" ||
          master.employee_code_source === "directory")
      ) {
        alreadyTransformed += 1;
        continue;
      }
      masterPatches.push({
        id: master.id,
        first_hire_date: firstHire,
        employee_code_source: master.employee_code_source ?? "legacy",
      });
      continue;
    }

    chains += 1;
    masterPatches.push({
      id: master.id,
      first_hire_date: firstHire,
      employee_code_source: master.employee_code_source ?? "legacy",
    });

    for (const prior of priors) {
      if (prior.employee_code || prior.legacy_id != null) {
        aliases.push({
          organization_id: prior.organization_id,
          employee_id: master.id,
          alias_code: prior.employee_code,
          legacy_id: prior.legacy_id,
          source_employee_id: prior.id,
          note: `Prior engagement collapsed under person master (status=${prior.status})`,
        });
      }
      movements.push({
        organization_id: prior.organization_id,
        employee_id: master.id,
        date_from: prior.hire_date,
        date_to: prior.resign_date,
        status: "PRIOR_ENGAGEMENT",
        remarks: [
          "GREENHRISMAIN rehire episode collapsed to person master.",
          prior.employee_code ? `code=${prior.employee_code}` : null,
          prior.legacy_id != null ? `legacy_id=${prior.legacy_id}` : null,
          `source_row=${prior.id}`,
          `status=${prior.status}`,
        ]
          .filter(Boolean)
          .join(" · "),
      });
    }
  }

  // Singletons without person_key still get first_hire_date.
  for (const row of noKey) {
    if (
      row.first_hire_date === (row.hire_date ?? row.first_hire_date) &&
      row.employee_code_source
    ) {
      alreadyTransformed += 1;
      continue;
    }
    masterPatches.push({
      id: row.id,
      first_hire_date: row.hire_date ?? row.first_hire_date,
      employee_code_source: row.employee_code_source ?? "legacy",
    });
  }

  const report = {
    mode: APPLY ? "apply" : "dry-run",
    employees: employees.length,
    people_with_person_key: byPerson.size,
    multi_engagement_chains: chains,
    single_engagement_people: singles,
    no_person_key: noKey.length,
    master_patches: masterPatches.length,
    aliases_to_insert: aliases.length,
    movements_to_insert: movements.length,
    already_looked_transformed: alreadyTransformed,
    sample_aliases: aliases.slice(0, 8),
    sample_masters: masterPatches.slice(0, 5),
  };
  console.log(JSON.stringify(report, null, 2));

  if (!APPLY) {
    console.log("Dry-run only. Re-run with --apply to write.");
    return;
  }

  // Chunked parallel updates (idempotent). Prefer SQL bulk when applying at full scale.
  const chunkSize = 200;
  let patched = 0;
  for (let i = 0; i < masterPatches.length; i += chunkSize) {
    const chunk = masterPatches.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (patch) => {
        const { error } = await directory
          .from("employees")
          .update({
            first_hire_date: patch.first_hire_date,
            employee_code_source: patch.employee_code_source,
            updated_at: new Date().toISOString(),
          })
          .eq("id", patch.id);
        if (error) throw new Error(`master patch ${patch.id}: ${error.message}`);
        patched += 1;
      })
    );
  }

  let aliasesOk = 0;
  let aliasesSkip = 0;
  for (let i = 0; i < aliases.length; i += chunkSize) {
    const chunk = aliases.slice(i, i + chunkSize);
    const { error } = await directory.from("employee_code_aliases").insert(chunk);
    if (error) {
      for (const row of chunk) {
        const { error: rowError } = await directory
          .from("employee_code_aliases")
          .insert(row);
        if (rowError) {
          if (
            rowError.code === "23505" ||
            /unique|duplicate/i.test(rowError.message)
          ) {
            aliasesSkip += 1;
            continue;
          }
          throw new Error(`alias insert: ${rowError.message}`);
        }
        aliasesOk += 1;
      }
    } else {
      aliasesOk += chunk.length;
    }
  }

  let movementsOk = 0;
  for (let i = 0; i < movements.length; i += 100) {
    const chunk = movements.slice(i, i + 100);
    const { error } = await directory.from("employee_movements").insert(chunk);
    if (error) {
      for (const row of chunk) {
        const { data: existing } = await directory
          .from("employee_movements")
          .select("id")
          .eq("employee_id", row.employee_id)
          .eq("status", "PRIOR_ENGAGEMENT")
          .ilike("remarks", `%source_row=${row.remarks.match(/source_row=([^ ·]+)/)?.[1] ?? ""}%`)
          .limit(1);
        if (existing && existing.length > 0) continue;
        const { error: rowError } = await directory
          .from("employee_movements")
          .insert(row);
        if (rowError) continue;
        movementsOk += 1;
      }
      continue;
    }
    movementsOk += chunk.length;
  }

  console.log(
    JSON.stringify(
      {
        applied: true,
        masters_patched: patched,
        aliases_inserted: aliasesOk,
        aliases_skipped_duplicate: aliasesSkip,
        movements_inserted: movementsOk,
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
