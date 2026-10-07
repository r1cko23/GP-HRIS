/**
 * Provision the multi-HR access matrix (Merry / Roxanne / Dyan / Regina / Ailyne / Emman).
 *
 * Usage:
 *   npx tsx scripts/provision-hr-access-packs.ts
 *   npx tsx scripts/provision-hr-access-packs.ts bizdev
 *
 * Creates missing Auth + public.users rows, replaces hris_user_grants for each pack,
 * and strips Delete from Merry/Roxanne. Prints one-time passwords for new accounts.
 * Optional argv filters to one pack id or email.
 */

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env.production.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function tempPassword(label: string): string {
  return `GpHr-${label}-${randomBytes(4).toString("hex")}!`;
}

/** Shared: no salary, no delete. */
const NO_SALARY = false;

const PEOPLE_DEPLOYED = [
  "page:employees",
  "page:people.clients",
  "page:people.employees",
  "fn:employees.create",
  "fn:employees.update",
  "fn:employees.section.core",
  "fn:employees.section.government_ids",
  "fn:employees.section.documents",
  "fn:employees.section.family",
  "fn:employees.section.history",
  "fn:employees.section.medical",
  "fn:employees.section.lifecycle",
  "fn:clients.roster.view",
] as const;

/**
 * Deployed encoder: add + view clients/rosters/201; encode for_verification
 * hires; no fn:employees.update (cannot edit Active roster).
 */
const PEOPLE_DEPLOYED_ENCODE_ONLY = [
  "page:employees",
  "page:people.clients",
  "page:people.employees",
  "fn:employees.create",
  "fn:employees.section.core",
  "fn:employees.section.government_ids",
  "fn:employees.section.documents",
  "fn:employees.section.family",
  "fn:employees.section.history",
  "fn:employees.section.medical",
  "fn:clients.roster.view",
] as const;

const BENEFITS_LOANS_ALLOWANCES_DEDUCTIONS = [
  "page:loans",
  "fn:loans.create",
  "fn:loans.update",
  "page:payslips",
  "fn:payslips.create",
  "fn:payslips.update",
] as const;

const BENEFITS_DEDUCTIONS_ONLY = [
  "page:payslips",
  "fn:payslips.create",
  "fn:payslips.update",
] as const;

const STATUTORY = [
  "page:employees",
  "page:people.employees",
  "fn:employees.create",
  "fn:employees.update",
  "fn:employees.section.core",
  "fn:employees.section.government_ids",
] as const;

const TIME_ATTENDANCE = [
  "page:timesheet",
  "page:time_entries",
  "fn:timesheet.update",
  "fn:time_entries.create",
  "fn:time_entries.update",
] as const;

/** Opens Reports hub (SSS / PhilHealth / Pag-IBIG style) without Payroll register. */
const STATUTORY_REPORTS = ["page:bir_reports", "page:loans"] as const;

const PACKS: Record<
  string,
  {
    email: string;
    fullName: string;
    role: "head_of_hr" | "hr_admin";
    canAccessSalary: boolean;
    /** When set, replace grants with this list. When null, only strip deletes. */
    grants: string[] | null;
  }
> = {
  merry: {
    email: "hrlrelations@greenpasture.ph",
    fullName: "Merry Budiongan",
    role: "head_of_hr",
    canAccessSalary: true,
    grants: null,
  },
  roxanne: {
    email: "ngoroxanne@greenpasture.ph",
    fullName: "Roxanne Ngo",
    role: "head_of_hr",
    canAccessSalary: true,
    grants: null,
  },
  dyan: {
    email: "dyanatutubo@greenpasture.ph",
    fullName: "Dyan Atutubo",
    role: "hr_admin",
    canAccessSalary: NO_SALARY,
    grants: [
      ...BENEFITS_LOANS_ALLOWANCES_DEDUCTIONS,
      ...STATUTORY,
      ...TIME_ATTENDANCE,
      ...STATUTORY_REPORTS,
    ],
  },
  regina: {
    email: "hrreception@greenpasture.ph",
    fullName: "Regina Jean Sanchez",
    role: "hr_admin",
    canAccessSalary: NO_SALARY,
    grants: [
      ...BENEFITS_LOANS_ALLOWANCES_DEDUCTIONS,
      ...STATUTORY,
      ...STATUTORY_REPORTS,
    ],
  },
  ailyne: {
    email: "hradmin@greenpasture.ph",
    fullName: "Ailyne Yangco",
    role: "hr_admin",
    canAccessSalary: NO_SALARY,
    grants: [
      ...BENEFITS_DEDUCTIONS_ONLY,
      ...PEOPLE_DEPLOYED,
      "fn:employees.section.government_ids",
    ],
  },
  emman: {
    email: "hrgeneralist@greenpasture.ph",
    fullName: "Emman",
    role: "hr_admin",
    canAccessSalary: NO_SALARY,
    grants: [
      ...STATUTORY,
      "page:people.clients",
      "fn:clients.roster.view",
      "fn:employees.section.documents",
      "fn:employees.section.family",
      "fn:employees.section.history",
      "fn:employees.section.medical",
      "fn:employees.section.lifecycle",
    ],
  },
  bizdev: {
    email: "businessdevelopment@greenpasture.ph",
    fullName: "Business Development",
    role: "hr_admin",
    canAccessSalary: NO_SALARY,
    grants: [...PEOPLE_DEPLOYED_ENCODE_ONLY],
  },
};

const DELETE_KEYS = [
  "fn:employees.delete",
  "fn:schedules.delete",
  "fn:time_entries.delete",
];

async function ensurePeoplePageCapabilities() {
  const { error } = await admin.from("hris_capabilities").upsert(
    [
      {
        key: "page:people.clients",
        kind: "page",
        label: "People · Clients",
        description: "Client list, client CMS, positions, and roster view",
        sort_order: 21,
      },
      {
        key: "page:people.employees",
        kind: "page",
        label: "People · Employees",
        description: "Work queues, Add employee, and 201 lifecycle",
        sort_order: 22,
      },
    ],
    { onConflict: "key" }
  );
  if (error) throw new Error(`hris_capabilities upsert: ${error.message}`);
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await admin
    .from("users")
    .select("id")
    .ilike("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function ensureUser(input: {
  email: string;
  fullName: string;
  role: string;
  canAccessSalary: boolean;
  password: string;
}): Promise<{ id: string; created: boolean; password?: string }> {
  const existingId = await findUserIdByEmail(input.email);
  if (existingId) {
    const { error } = await admin
      .from("users")
      .update({
        full_name: input.fullName,
        role: input.role,
        is_active: true,
        can_access_salary: input.canAccessSalary,
      })
      .eq("id", existingId);
    if (error) throw new Error(`users update ${input.email}: ${error.message}`);
    return { id: existingId, created: false };
  }

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });
  if (authError || !authData.user) {
    throw new Error(
      `auth create ${input.email}: ${authError?.message ?? "unknown"}`
    );
  }

  const { error: insertError } = await admin.from("users").insert({
    id: authData.user.id,
    email: input.email.toLowerCase(),
    full_name: input.fullName,
    role: input.role,
    is_active: true,
    can_access_salary: input.canAccessSalary,
  });
  if (insertError) {
    await admin.auth.admin.deleteUser(authData.user.id);
    throw new Error(`users insert ${input.email}: ${insertError.message}`);
  }

  return { id: authData.user.id, created: true, password: input.password };
}

async function stripDeletes(userId: string) {
  const { error } = await admin
    .from("hris_user_grants")
    .delete()
    .eq("user_id", userId)
    .in("capability_key", DELETE_KEYS);
  if (error) throw new Error(`strip deletes: ${error.message}`);
}

async function replaceGrants(userId: string, keys: string[]) {
  const unique = [...new Set(keys)].filter((k) => !DELETE_KEYS.includes(k));
  const { error: delError } = await admin
    .from("hris_user_grants")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(`clear grants: ${delError.message}`);

  if (unique.length === 0) return;

  const { data: caps, error: capError } = await admin
    .from("hris_capabilities")
    .select("key")
    .in("key", unique);
  if (capError) throw new Error(`load capabilities: ${capError.message}`);
  const known = new Set((caps ?? []).map((c) => c.key as string));
  const missing = unique.filter((k) => !known.has(k));
  if (missing.length) {
    console.warn("Skipping unknown capability keys:", missing.join(", "));
  }
  const rows = unique
    .filter((k) => known.has(k))
    .map((capability_key) => ({ user_id: userId, capability_key }));

  const { error: insError } = await admin.from("hris_user_grants").insert(rows);
  if (insError) throw new Error(`insert grants: ${insError.message}`);
}

async function main() {
  await ensurePeoplePageCapabilities();

  const only = process.argv[2]?.trim().toLowerCase();
  const createdPasswords: Array<{ email: string; password: string }> = [];

  for (const [packId, pack] of Object.entries(PACKS)) {
    if (
      only &&
      packId !== only &&
      pack.email.toLowerCase() !== only
    ) {
      continue;
    }
    const password = tempPassword(packId);
    const user = await ensureUser({
      email: pack.email,
      fullName: pack.fullName,
      role: pack.role,
      canAccessSalary: pack.canAccessSalary,
      password,
    });

    if (pack.grants) {
      await replaceGrants(user.id, pack.grants);
    } else {
      await stripDeletes(user.id);
      // Ensure salary grant matches flag for Merry/Roxanne
      if (pack.canAccessSalary) {
        await admin.from("hris_user_grants").upsert(
          { user_id: user.id, capability_key: "fn:salary.read" },
          { onConflict: "user_id,capability_key" }
        );
      }
    }

    const { count } = await admin
      .from("hris_user_grants")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    console.log(
      `${pack.email}: ${user.created ? "CREATED" : "UPDATED"} role=${pack.role} salary=${pack.canAccessSalary} grants=${count ?? "?"}`
    );
    if (user.created && user.password) {
      createdPasswords.push({ email: pack.email, password: user.password });
    }
  }

  if (createdPasswords.length) {
    console.log("\nOne-time passwords (share securely, then force change):");
    for (const row of createdPasswords) {
      console.log(`  ${row.email}  ${row.password}`);
    }
  } else {
    console.log("\nNo new Auth users created (all already existed).");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
