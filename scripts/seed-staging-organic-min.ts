/**
 * Minimal Organic staging seed (schema must already exist).
 * Creates org + house client, admin user, ~8 Active employees with Bundy rows,
 * and one draft cutoff. Safe to re-run (upserts / skips existing).
 *
 * Env (use Staging keys — never point this at production by accident):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   STAGING_ADMIN_EMAIL (default staging.admin@greenpasture.local)
 *   STAGING_ADMIN_PASSWORD (default StagingAdmin!234)
 *   STAGING_ADMIN_NAME (default Staging Admin)
 *
 * Usage:
 *   npx dotenv -e .env.staging.local -- npx tsx scripts/seed-staging-organic-min.ts
 *   npx dotenv -e .env.staging.local -- npx tsx scripts/seed-staging-organic-min.ts --apply
 *
 * Dry-run by default (prints plan only). Pass --apply to write.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const APPLY = process.argv.includes("--apply");

/** Stable IDs matching production Organic so hardcoded helpers keep working. */
const ORG_ID = "5edc1024-c785-4044-9a7e-758d422ccba6";
const CLIENT_ID = "16556bfe-6893-49ae-b98d-fd82d7292348";

const SAMPLE_EMPLOYEES = [
  { code: "202607-90001", last: "Reyes", first: "Ana", daily: 846.15 },
  { code: "202607-90002", last: "Santos", first: "Ben", daily: 695.0 },
  { code: "202607-90003", last: "Cruz", first: "Carla", daily: 769.23 },
  { code: "202607-90004", last: "Garcia", first: "Diego", daily: 730.77 },
  { code: "202607-90005", last: "Lopez", first: "Elena", daily: 884.62 },
  { code: "202607-90006", last: "Torres", first: "Felix", daily: 697.23 },
  { code: "202607-90007", last: "Mendoza", first: "Gina", daily: 769.23 },
  { code: "202607-90008", last: "Ramos", first: "Hugo", daily: 1346.15 },
] as const;

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

loadEnvFile(".env.staging.local");
loadEnvFile(".env.local");
loadEnvFile(".env");

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function assertNotProdUrl(url: string) {
  // Production project ref from this workspace — refuse unless --force-prod
  if (
    url.includes("wavweetmtjoxzdirnfva") &&
    !process.argv.includes("--force-prod")
  ) {
    throw new Error(
      `Refusing to seed production URL (${url}). Use Staging keys in .env.staging.local, or pass --force-prod if you really mean it.`
    );
  }
}

async function ensureOrg(directory: SupabaseClient) {
  const { data: existing } = await directory
    .from("organizations")
    .select("id, name, slug")
    .eq("id", ORG_ID)
    .maybeSingle();
  if (existing) {
    console.log(`org: exists ${existing.slug} (${existing.id})`);
    return existing;
  }
  console.log(`org: create organic (${ORG_ID})`);
  if (!APPLY) return { id: ORG_ID, name: "Organic", slug: "organic" };
  const { data, error } = await directory
    .from("organizations")
    .insert({
      id: ORG_ID,
      name: "Organic",
      slug: "organic",
      is_active: true,
    })
    .select("id, name, slug")
    .single();
  if (error) throw new Error(`org insert: ${error.message}`);
  return data;
}

async function ensureClient(directory: SupabaseClient) {
  const { data: existing } = await directory
    .from("clients")
    .select("id, name, bundy_enabled")
    .eq("id", CLIENT_ID)
    .maybeSingle();
  if (existing) {
    console.log(`client: exists ${existing.name} (bundy=${existing.bundy_enabled})`);
    if (APPLY && !existing.bundy_enabled) {
      await directory
        .from("clients")
        .update({ bundy_enabled: true, updated_at: new Date().toISOString() })
        .eq("id", CLIENT_ID);
      console.log("client: set bundy_enabled=true");
    }
    return existing;
  }
  console.log(`client: create house client (${CLIENT_ID})`);
  if (!APPLY) {
    return {
      id: CLIENT_ID,
      name: "GREEN PASTURE PEOPLE MANAGEMENT INC.",
      bundy_enabled: true,
    };
  }
  const { data, error } = await directory
    .from("clients")
    .insert({
      id: CLIENT_ID,
      organization_id: ORG_ID,
      name: "GREEN PASTURE PEOPLE MANAGEMENT INC.",
      status: "active",
      bundy_enabled: true,
      pay_frequency: "semi-monthly",
      cut1_start: 1,
      cut1_end: 15,
      cut2_start: 16,
      cut2_end: 30,
      statutory_schedule: "Monthly",
      wtax_schedule: "Semi-Monthly",
      include_cola: false,
      include_sea: false,
      include_ctpa: false,
    })
    .select("id, name, bundy_enabled")
    .single();
  if (error) throw new Error(`client insert: ${error.message}`);
  return data;
}

async function ensureAdmin(publicDb: SupabaseClient, directory: SupabaseClient) {
  const email =
    process.env.STAGING_ADMIN_EMAIL?.trim() || "staging.admin@greenpasture.local";
  const password =
    process.env.STAGING_ADMIN_PASSWORD?.trim() || "StagingAdmin!234";
  const fullName = process.env.STAGING_ADMIN_NAME?.trim() || "Staging Admin";

  console.log(`admin: ${email}`);

  // Find existing auth user by listing (small staging DB) or create.
  let userId: string | null = null;
  const listed = await publicDb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (listed.error) throw new Error(`listUsers: ${listed.error.message}`);
  const found = listed.data.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (found) {
    userId = found.id;
    console.log(`admin: auth user exists (${userId})`);
  } else {
    console.log("admin: create auth user");
    if (APPLY) {
      const created = await publicDb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (created.error) throw new Error(`createUser: ${created.error.message}`);
      userId = created.data.user.id;
    } else {
      userId = "dry-run-admin-id";
    }
  }

  if (!APPLY || !userId || userId === "dry-run-admin-id") {
    return { userId, email, password };
  }

  const { data: pubUser } = await publicDb
    .from("users")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  if (!pubUser) {
    const { error } = await publicDb.from("users").insert({
      id: userId,
      email,
      full_name: fullName,
      role: "admin",
      is_active: true,
      can_access_salary: true,
    });
    if (error) throw new Error(`public.users insert: ${error.message}`);
    console.log("admin: public.users inserted");
  } else if (pubUser.role !== "admin") {
    await publicDb
      .from("users")
      .update({ role: "admin", is_active: true, can_access_salary: true })
      .eq("id", userId);
    console.log("admin: promoted to admin");
  }

  const sync = await publicDb.rpc("sync_hris_user_grants", {
    p_user_id: userId,
  });
  if (sync.error) {
    console.warn(`admin: sync_hris_user_grants skipped (${sync.error.message})`);
  } else {
    console.log("admin: grants synced");
  }

  const { data: member } = await directory
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", ORG_ID)
    .eq("user_id", userId)
    .maybeSingle();
  if (!member) {
    const { error } = await directory.from("organization_members").insert({
      organization_id: ORG_ID,
      user_id: userId,
      role: "admin",
      is_active: true,
    });
    if (error) throw new Error(`organization_members: ${error.message}`);
    console.log("admin: organization_members linked");
  }

  return { userId, email, password };
}

async function ensureEmployees(
  directory: SupabaseClient,
  publicDb: SupabaseClient,
  adminUserId: string | null
) {
  const hireDate = "2026-01-15";
  let created = 0;
  let enrolled = 0;

  for (const sample of SAMPLE_EMPLOYEES) {
    const { data: existing } = await directory
      .from("employees")
      .select("id, employee_code")
      .eq("organization_id", ORG_ID)
      .eq("employee_code", sample.code)
      .maybeSingle();

    let directoryEmployeeId = existing?.id as string | undefined;
    if (!directoryEmployeeId) {
      console.log(`employee: create ${sample.code} ${sample.last}, ${sample.first}`);
      if (APPLY) {
        const { data, error } = await directory
          .from("employees")
          .insert({
            organization_id: ORG_ID,
            client_id: CLIENT_ID,
            employee_code: sample.code,
            employee_code_source: "directory",
            last_name: sample.last,
            first_name: sample.first,
            hire_date: hireDate,
            first_hire_date: hireDate,
            status: "active",
            is_current_engagement: true,
            daily_rate: sample.daily,
            monthly_rate: Math.round(sample.daily * 26 * 100) / 100,
          })
          .select("id")
          .single();
        if (error) throw new Error(`dir employee ${sample.code}: ${error.message}`);
        directoryEmployeeId = data.id as string;
        created += 1;
      }
    } else {
      console.log(`employee: exists ${sample.code}`);
    }

    if (!directoryEmployeeId || !APPLY) continue;

    const { data: office } = await publicDb
      .from("employees")
      .select("id")
      .eq("directory_employee_id", directoryEmployeeId)
      .maybeSingle();

    if (office?.id) continue;

    const fullName = `${sample.first} ${sample.last}`;
    const { error: officeError } = await publicDb.from("employees").insert({
      employee_id: sample.code,
      employee_code: sample.code,
      directory_employee_id: directoryEmployeeId,
      directory_client_id: CLIENT_ID,
      organization_id: ORG_ID,
      first_name: sample.first,
      last_name: sample.last,
      full_name: fullName,
      status: "active",
      is_active: true,
      employee_type: "office-based",
      daily_rate: sample.daily,
      per_day: sample.daily,
      monthly_rate: Math.round(sample.daily * 26 * 100) / 100,
      hire_date: hireDate,
      portal_password: sample.code,
      created_by: adminUserId,
      updated_by: adminUserId,
    });
    if (officeError) {
      throw new Error(`bundy ${sample.code}: ${officeError.message}`);
    }
    enrolled += 1;
    console.log(`bundy: enrolled ${sample.code}`);
  }

  return { created, enrolled };
}

async function ensureCutoff(publicDb: SupabaseClient) {
  const periodStart = "2026-09-01";
  const periodEnd = "2026-09-15";
  const { data: existing } = await publicDb
    .from("cutoff_periods")
    .select("id, status")
    .eq("organization_id", ORG_ID)
    .eq("client_id", CLIENT_ID)
    .eq("period_start", periodStart)
    .eq("period_end", periodEnd)
    .maybeSingle();
  if (existing) {
    console.log(`cutoff: exists ${periodStart}→${periodEnd} (${existing.status})`);
    return existing;
  }
  console.log(`cutoff: create draft ${periodStart}→${periodEnd}`);
  if (!APPLY) return null;
  const { data, error } = await publicDb
    .from("cutoff_periods")
    .insert({
      organization_id: ORG_ID,
      client_id: CLIENT_ID,
      period_start: periodStart,
      period_end: periodEnd,
      payroll_date: "2026-09-20",
      pay_frequency: "semi-monthly",
      source_app: "gp-hris-staging-seed",
      status: "draft",
      notes: "Staging organic min seed",
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`cutoff: ${error.message}`);
  return data;
}

async function main() {
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  assertNotProdUrl(url);
  const key = required("SUPABASE_SERVICE_ROLE_KEY");

  console.log(`target: ${url}`);
  console.log(`mode: ${APPLY ? "APPLY" : "DRY-RUN (pass --apply to write)"}`);

  const publicDb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const directory = publicDb.schema("directory");

  await ensureOrg(directory);
  await ensureClient(directory);
  const admin = await ensureAdmin(publicDb, directory);
  const employees = await ensureEmployees(
    directory,
    publicDb,
    admin.userId === "dry-run-admin-id" ? null : admin.userId
  );
  const cutoff = await ensureCutoff(publicDb);

  console.log("\n--- summary ---");
  console.log(`employees created: ${employees.created}`);
  console.log(`bundy enrolled: ${employees.enrolled}`);
  console.log(`cutoff: ${cutoff ? cutoff.id ?? "planned" : "planned"}`);
  console.log(`login email: ${admin.email}`);
  if (APPLY) {
    console.log(`login password: ${admin.password}`);
    console.log("Open Staging app, sign in, set x-organization-id / tenant to Organic.");
  } else {
    console.log("Re-run with --apply against Staging env to write rows.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
