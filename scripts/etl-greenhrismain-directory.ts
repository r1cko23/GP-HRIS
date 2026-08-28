/**
 * Read-only ETL from GREENHRISMAIN → GP-HRIS schema directory
 * (same Supabase project as clock / leave / OT).
 * Default is dry-run (counts only). Pass --apply to upsert.
 * Pass --apply --resume to skip employees already in Directory (after a crash).
 * Pass --apply --children-only to load 201 children + barred using existing
 * Directory employees (skips org/client/employee upserts). Use when employees
 * are already loaded and SQL was unreachable during the first apply.
 *
 * Env: SQL_HOST, SQL_USER, SQL_PASSWORD, SQL_DATABASE,
 *      NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import sql from "mssql";
import {
  buildPersonKey,
  mapLegacyEmployeeStatus,
} from "../lib/directory/legacy-status";

type Row = Record<string, unknown>;

const APPLY = process.argv.includes("--apply");
const RESUME = process.argv.includes("--resume");
const CHILDREN_ONLY = process.argv.includes("--children-only");

async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 6): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const wait = Math.min(2000 * 2 ** i, 30000);
      console.warn(`${label} failed (${i + 1}/${attempts}), retry in ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw last;
}

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

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "organization";
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asInt(value: unknown): number | null {
  const n = asNumber(value);
  return n === null ? null : Math.trunc(n);
}

function asText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
}

function asBool(value: unknown): boolean {
  const text = String(value ?? "").trim().toLowerCase();
  return text === "1" || text === "y" || text === "yes" || text === "true";
}

function asDate(value: unknown): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function isDeleted(tag: unknown): boolean {
  const text = String(tag ?? "").trim().toLowerCase();
  return text === "1" || text === "y" || text === "yes" || text === "true";
}

function payFrequency(row: Row): string | null {
  const freq = asText(row.frequencypayment)?.toLowerCase();
  if (freq?.includes("week")) return "weekly";
  if (freq?.includes("semi")) return "semi-monthly";
  if (freq?.includes("month")) return "monthly";
  if (asNumber(row.semimonthly)) return "semi-monthly";
  if (asNumber(row.monthly)) return "monthly";
  return null;
}

async function query(pool: Awaited<ReturnType<typeof sql.connect>>, text: string): Promise<Row[]> {
  const result = await pool.request().query(text);
  return result.recordset as Row[];
}

async function upsert(
  admin: SupabaseClient,
  table: string,
  organizationId: string,
  legacyId: number,
  row: Row,
  extraMatch: Record<string, unknown> = {}
): Promise<string> {
  return withRetry(`${table}:${legacyId}`, async () => {
    let lookup = admin
      .from(table)
      .select("id")
      .eq("organization_id", organizationId)
      .eq("legacy_id", legacyId);
    for (const [key, value] of Object.entries(extraMatch)) {
      lookup = lookup.eq(key, value);
    }
    const { data: existing, error: lookupError } = await lookup.maybeSingle();
    if (lookupError) throw lookupError;
    if (existing?.id) {
      const { error } = await admin.from(table).update(row).eq("id", existing.id);
      if (error) throw error;
      return existing.id as string;
    }
    const { data, error } = await admin
      .from(table)
      .insert({
        organization_id: organizationId,
        legacy_id: legacyId,
        ...row,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  });
}

async function existingEmployeeLegacyIds(
  admin: SupabaseClient
): Promise<{ ids: Map<number, string>; orgs: Map<string, string> }> {
  const ids = new Map<number, string>();
  const orgs = new Map<string, string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await admin
      .from("employees")
      .select("id, legacy_id, organization_id")
      .not("legacy_id", "is", null)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data?.length) break;
    for (const row of data) {
      if (row.legacy_id == null || !row.id) continue;
      ids.set(Number(row.legacy_id), row.id as string);
      if (row.organization_id) orgs.set(row.id as string, row.organization_id as string);
    }
    if (data.length < page) break;
  }
  return { ids, orgs };
}

async function connectSql() {
  const config = {
    server: process.env.SQL_HOST || "10.0.0.222",
    port: Number(process.env.SQL_PORT || 1433),
    user: required("SQL_USER"),
    password: required("SQL_PASSWORD"),
    database: process.env.SQL_DATABASE || "GREENHRISMAIN",
    connectionTimeout: Number(process.env.SQL_CONNECTION_TIMEOUT_MS || 60000),
    requestTimeout: Number(process.env.SQL_REQUEST_TIMEOUT_MS || 300000),
    options: { encrypt: false, trustServerCertificate: true },
  };
  return withRetry(
    "sql.connect",
    () => sql.connect(config),
    Number(process.env.SQL_CONNECT_ATTEMPTS || 8)
  );
}

function directoryAdmin(): SupabaseClient {
  return createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  ).schema("directory") as unknown as SupabaseClient;
}

async function syncChildrenAndBarred(
  pool: Awaited<ReturnType<typeof sql.connect>>,
  admin: SupabaseClient,
  employeeIdByLegacy: Map<number, string>,
  employeeOrgId: Map<string, string>,
  defaultOrgId: string,
  barredRows: Row[]
) {
  async function loadChildren(
    table: string,
    sqlTable: string,
    legacyKey: string,
    mapRow: (row: Row, employeeId: string) => Row,
    employeeKey = "Employee_id"
  ) {
    const rows = await query(pool, `SELECT * FROM dbo.${sqlTable}`);
    let n = 0;
    for (const row of rows) {
      const empLegacy = asInt(row[employeeKey] ?? row.employee_id ?? row.Employee_id);
      const legacyId = asInt(row[legacyKey]);
      if (empLegacy === null || legacyId === null) continue;
      const employeeId = employeeIdByLegacy.get(empLegacy);
      if (!employeeId) continue;
      const orgId = employeeOrgId.get(employeeId) ?? defaultOrgId;
      await upsert(admin, table, orgId, legacyId, {
        employee_id: employeeId,
        ...mapRow(row, employeeId),
      });
      n += 1;
    }
    console.log(`${table}: ${n}`);
  }

  await loadChildren("employee_contacts", "emp_contacts", "idcontacts", (row) => ({
    name: asText(row.contacts_name),
    relationship: asText(row.relationship),
    phone: asText(row.Tel_Numbers),
    mobile: asText(row.mobile),
    email: asText(row.email),
    address: asText(row.address),
    city: asText(row.city),
  }));
  await loadChildren("employee_dependents", "emp_dependents", "iddependent", (row) => ({
    first_name: asText(row.firstname),
    last_name: asText(row.lastname),
    relationship: asText(row.relationship),
    birth_date: asDate(row.birthday),
    gender: asText(row.gender),
    occupation: asText(row.occupation),
  }));
  await loadChildren("employee_education", "emp_education", "ideducation", (row) => ({
    school: asText(row.school),
    degree: asText(row.degree),
    level: asText(row.Education_Level),
    from_year: asText(row.Date_FromYear),
    to_year: asText(row.Date_EndYear),
    honors: asText(row.honors),
  }));
  await loadChildren("employee_job_history", "emp_jobhistory", "idjobhistory", (row) => ({
    company: asText(row.company),
    position_held: asText(row.position_held),
    from_year: asText(row.date_fromyear),
    to_year: asText(row.date_endyear),
    reason_for_leaving: asText(row.reasons_for_leaving),
    remarks: asText(row.Remarks),
  }));
  await loadChildren("employee_licenses", "emp_license", "idlicense", (row) => ({
    license_no: asText(row.license_no),
    course: asText(row.trainingcourse),
    awarded_on: asText(row.date_awarded),
    expires_on: asText(row.date_expired),
  }));
  await loadChildren("employee_medical", "emp_medical", "idmedical", (row) => ({
    medical_type: asText(row.medical_type),
    medical_status: asText(row.medical_status),
    medical_date: asText(row.medical_date),
    expires_on: asText(row.date_expired),
    remarks: asText(row.remarks),
  }));
  await loadChildren(
    "employee_movements",
    "emp_movement",
    "idmovement",
    (row) => ({
      date_from: asText(row.mmdatefrom),
      date_to: asText(row.mmdateto),
      status: asText(row.mmstatus),
      department: asText(row.mmdepartment),
      position: asText(row.mmposition),
      remarks: asText(row.mmremarks),
    }),
    "employee_id"
  );
  await loadChildren("employee_skills", "emp_skills", "idskill", (row) => ({
    skill: asText(row.skills),
    proficiency: asText(row.proficiency),
    years_experience: asText(row.years_of_experienced),
    remarks: asText(row.remarks),
  }));

  let barredCount = 0;
  for (const row of barredRows) {
    const empLegacy = asInt(row.employeeid);
    const employeeId = empLegacy !== null ? employeeIdByLegacy.get(empLegacy) ?? null : null;
    const orgId = employeeId ? employeeOrgId.get(employeeId) ?? defaultOrgId : defaultOrgId;
    const { data: existing } = await admin
      .from("barred_employees")
      .select("id")
      .eq("organization_id", orgId)
      .eq("legacy_employee_id", empLegacy)
      .maybeSingle();
    const payload = {
      organization_id: orgId,
      employee_id: employeeId,
      last_name: asText(row.lname),
      first_name: asText(row.fname),
      middle_name: asText(row.mname),
      client_name: asText(row.companyname),
      department_name: asText(row.departmentname),
      last_payroll: asDate(row.lastpayroll),
      status: asText(row.status),
      legacy_employee_id: empLegacy,
    };
    if (existing?.id) {
      await admin.from("barred_employees").update(payload).eq("id", existing.id);
    } else {
      await admin.from("barred_employees").insert(payload);
    }
    barredCount += 1;
  }
  console.log(`barred_employees: ${barredCount}`);
}

async function main() {
  if (CHILDREN_ONLY && !APPLY) {
    throw new Error("--children-only requires --apply");
  }

  const pool = await connectSql();
  const admin = directoryAdmin();

  if (CHILDREN_ONLY) {
    const barredRows = await query(pool, `SELECT * FROM dbo.barred`);
    const childCounts: Record<string, number> = {};
    for (const [label, table] of [
      ["contacts", "emp_contacts"],
      ["dependents", "emp_dependents"],
      ["education", "emp_education"],
      ["job_history", "emp_jobhistory"],
      ["licenses", "emp_license"],
      ["medical", "emp_medical"],
      ["movements", "emp_movement"],
      ["skills", "emp_skills"],
    ] as const) {
      const rows = await query(pool, `SELECT COUNT(*) AS n FROM dbo.${table}`);
      childCounts[label] = asInt(rows[0]?.n) ?? 0;
    }
    console.log(
      JSON.stringify(
        { mode: "children-only", barred: barredRows.length, children: childCounts },
        null,
        2
      )
    );

    const { ids: employeeIdByLegacy, orgs: employeeOrgId } =
      await existingEmployeeLegacyIds(admin);
    if (employeeIdByLegacy.size === 0) {
      throw new Error("No Directory employees found — run full etl:directory:apply first");
    }
    const orgIds = [...new Set(employeeOrgId.values())];
    const defaultOrgId = orgIds[0];
    if (!defaultOrgId) throw new Error("No organization_id on Directory employees");

    console.log(
      `children-only: mapping ${employeeIdByLegacy.size} employees across ${orgIds.length} org(s)`
    );
    await syncChildrenAndBarred(
      pool,
      admin,
      employeeIdByLegacy,
      employeeOrgId,
      defaultOrgId,
      barredRows
    );
    await pool.close();
    console.log(JSON.stringify({ applied: true, mode: "children-only" }, null, 2));
    return;
  }

  const orgs = await query(
    pool,
    `SELECT idorganization, organizationname FROM dbo.tblorganization`
  );
  const clients = await query(
    pool,
    `SELECT * FROM dbo.client WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')`
  );
  const branches = await query(
    pool,
    `SELECT * FROM dbo.client_branch WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')`
  );
  const positions = await query(
    pool,
    `SELECT * FROM dbo.client_branch_position WHERE ISNULL(tagpositiondelete, '') NOT IN ('1', 'Y', 'y')`
  );
  const barredRows = await query(pool, `SELECT * FROM dbo.barred`);
  const barredIds = new Set(
    barredRows.map((row) => asInt(row.employeeid)).filter((id): id is number => id !== null)
  );
  const employees = await query(
    pool,
    `SELECT * FROM dbo.Employee WHERE ISNULL(tagdelete, '') NOT IN ('1', 'Y', 'y')
     ORDER BY CASE WHEN status = 'Active' THEN 0 ELSE 1 END, Employee_id`
  );

  const childCounts: Record<string, number> = {};
  for (const [label, table] of [
    ["contacts", "emp_contacts"],
    ["dependents", "emp_dependents"],
    ["education", "emp_education"],
    ["job_history", "emp_jobhistory"],
    ["licenses", "emp_license"],
    ["medical", "emp_medical"],
    ["movements", "emp_movement"],
    ["skills", "emp_skills"],
  ] as const) {
    const rows = await query(pool, `SELECT COUNT(*) AS n FROM dbo.${table}`);
    childCounts[label] = asInt(rows[0]?.n) ?? 0;
  }

  const summary = {
    mode: APPLY ? "apply" : "dry-run",
    organizations: orgs.length,
    clients: clients.length,
    branches: branches.length,
    positions: positions.length,
    employees: employees.length,
    barred: barredRows.length,
    children: childCounts,
  };
  console.log(JSON.stringify(summary, null, 2));

  if (!APPLY) {
    await pool.close();
    console.log("Dry-run only. Re-run with --apply to upsert into Directory.");
    return;
  }

  const orgIdByLegacy = new Map<number, string>();
  const clientOrgId = new Map<string, string>();

  for (const org of orgs) {
    const legacyId = asInt(org.idorganization);
    if (legacyId === null) continue;
    const name = asText(org.organizationname) ?? `Organization ${legacyId}`;
    const { data: existing } = await admin
      .from("organizations")
      .select("id")
      .eq("legacy_id", legacyId)
      .maybeSingle();
    if (existing?.id) {
      await admin
        .from("organizations")
        .update({ name, is_active: true })
        .eq("id", existing.id);
      orgIdByLegacy.set(legacyId, existing.id);
      continue;
    }
    const { data, error } = await admin
      .from("organizations")
      .insert({
        name,
        slug: `${slugify(name)}-${legacyId}`,
        is_active: true,
        legacy_id: legacyId,
      })
      .select("id")
      .single();
    if (error) throw error;
    orgIdByLegacy.set(legacyId, data.id);
  }

  let defaultOrgId = [...orgIdByLegacy.values()][0];
  if (!defaultOrgId) {
    const { data, error } = await admin
      .from("organizations")
      .upsert(
        {
          name: "Green Pasture",
          slug: "green-pasture",
          is_active: true,
          legacy_id: 0,
        },
        { onConflict: "slug" }
      )
      .select("id")
      .single();
    if (error) throw error;
    defaultOrgId = data.id;
    orgIdByLegacy.set(0, defaultOrgId);
  }
  if (!defaultOrgId) {
    throw new Error("No Directory organization to attach clients to");
  }

  const orgForClient = (idorganization: unknown) => {
    const legacy = asInt(idorganization);
    if (legacy !== null && orgIdByLegacy.has(legacy)) {
      return orgIdByLegacy.get(legacy)!;
    }
    return defaultOrgId;
  };

  const clientIdByLegacy = new Map<number, string>();
  for (const client of clients) {
    const legacyId = asInt(client.idclient);
    if (legacyId === null) continue;
    const organizationId = orgForClient(client.idorganization);
    const id = await upsert(admin, "clients", organizationId, legacyId, {
      name: asText(client.companyname) ?? `Client ${legacyId}`,
      tin: asText(client.clienttinno),
      status: (asText(client.clientstatus) ?? "active").toLowerCase().includes("inactive")
        ? "inactive"
        : "active",
      contact_person: asText(client.contactperson),
      email: asText(client.clientemailaddress),
      phone: asText(client.telephone) ?? asText(client.mobile),
      address: asText(client.address),
      cut1_start: asInt(client.Cut1Start),
      cut1_end: asInt(client.Cut1End),
      cut2_start: asInt(client.Cut2Start),
      cut2_end: asInt(client.Cut2End),
      pay_frequency: payFrequency(client),
      statutory_schedule: asText(client.schedstatutory),
      wtax_schedule: asText(client.wtaxsched),
      sss_basis: asText(client.basisofsssded),
      philhealth_basis: asText(client.basisofphilded),
      wtax_basis: asText(client.basisofwtaxded),
      include_cola: asBool(client.includecola),
      include_sea: asBool(client.includesea),
      include_ctpa: asBool(client.includectpa),
      admin_fee: asNumber(client.adminfee),
      vat: asNumber(client.vat),
      ewt: asNumber(client.ewt),
      thirteenth_month_year: asInt(client.thirteenmonthyear),
    });
    clientIdByLegacy.set(legacyId, id);
    clientOrgId.set(id, organizationId);
  }

  const branchIdByLegacy = new Map<number, string>();
  for (const branch of branches) {
    const legacyId = asInt(branch.idclientbranch);
    const clientLegacy = asInt(branch.idclient);
    if (legacyId === null || clientLegacy === null) continue;
    const clientId = clientIdByLegacy.get(clientLegacy);
    if (!clientId) continue;
    const orgId = clientOrgId.get(clientId) ?? defaultOrgId;
    const id = await upsert(admin, "client_branches", orgId, legacyId, {
      client_id: clientId,
      name: asText(branch.branch) ?? `Branch ${legacyId}`,
      location: asText(branch.location),
      is_active: true,
    });
    branchIdByLegacy.set(legacyId, id);
  }

  const positionIdByLegacy = new Map<number, string>();
  for (const position of positions) {
    const legacyId = asInt(position.idbranchposition);
    const clientLegacy = asInt(position.idclient);
    if (legacyId === null || clientLegacy === null) continue;
    const clientId = clientIdByLegacy.get(clientLegacy);
    if (!clientId) continue;
    const orgId = clientOrgId.get(clientId) ?? defaultOrgId;
    const branchId = asInt(position.idclientbranch)
      ? branchIdByLegacy.get(asInt(position.idclientbranch)!) ?? null
      : null;
    const id = await upsert(admin, "positions", orgId, legacyId, {
      client_id: clientId,
      branch_id: branchId,
      job_title: asText(position.jobposition) ?? `Position ${legacyId}`,
      department: asText(position.Department),
      group_name: asText(position.groupname),
      payroll_daily_rate: asNumber(position.dailyratepayroll),
      payroll_ot_rate: asNumber(position.regularOTrate),
      payroll_nd_rate: asNumber(position.nightdiffrate),
      payroll_legal_holiday_rate: asNumber(position.legalholidayrate),
      payroll_special_holiday_rate: asNumber(position.specialholidayrate),
      payroll_rest_day_rate: asNumber(position.RDrate),
      billing_daily_rate: asNumber(position.billingdailyratepayroll),
      billing_ot_rate: asNumber(position.billingregularOTrate),
      ecola: asNumber(position.positionecola),
      sea: asNumber(position.positionsea),
      ctpa: asNumber(position.positionctpa),
      allowance: asNumber(position.allowance),
      is_active: true,
    });
    positionIdByLegacy.set(legacyId, id);
  }

  const resumed = RESUME ? await existingEmployeeLegacyIds(admin) : null;
  const employeeIdByLegacy = resumed?.ids ?? new Map<number, string>();
  const employeeOrgId = resumed?.orgs ?? new Map<string, string>();
  if (RESUME) {
    console.log(`resume: ${employeeIdByLegacy.size} employees already in Directory`);
  }
  let employeeCount = 0;
  let skipped = 0;
  for (const employee of employees) {
    const legacyId = asInt(employee.Employee_id);
    if (legacyId === null) continue;
    if (RESUME && employeeIdByLegacy.has(legacyId)) {
      skipped += 1;
      continue;
    }
    const clientLegacy = asInt(employee.idclient);
    const clientId = clientLegacy !== null ? clientIdByLegacy.get(clientLegacy) ?? null : null;
    const orgId = clientId ? clientOrgId.get(clientId) ?? defaultOrgId : defaultOrgId;
    const branchId = asInt(employee.idclientbranch)
      ? branchIdByLegacy.get(asInt(employee.idclientbranch)!) ?? null
      : null;
    const positionId = asInt(employee.Position1)
      ? positionIdByLegacy.get(asInt(employee.Position1)!) ?? null
      : null;
    const normalized = mapLegacyEmployeeStatus(
      {
        Employee_id: legacyId,
        status: asText(employee.status),
        employee_status: asText(employee.employee_status),
        verificationstatus: asText(employee.verificationstatus),
        verifiedforverification: asText(employee.verifiedforverification),
        finalpaystatus: asText(employee.finalpaystatus),
      },
      barredIds
    );
    const lastName = asText(employee.lname) ?? "Unknown";
    const firstName = asText(employee.fname) ?? "Unknown";
    const birthDate = asDate(employee.date_birth);
    const id = await upsert(admin, "employees", orgId, legacyId, {
      client_id: clientId,
      branch_id: branchId,
      position_id: positionId,
      employee_code:
        asText(employee.EMP_code) ??
        asText(employee.emp_code) ??
        String(legacyId),
      last_name: lastName,
      first_name: firstName,
      middle_name: asText(employee.mname),
      sex: asText(employee.sex),
      birth_date: birthDate,
      hire_date: asDate(employee.datehired),
      regular_date: asDate(employee.dateregular),
      resign_date: asDate(employee.date_resigned),
      status: normalized.status,
      legacy_status: normalized.legacy_status,
      legacy_employee_status: normalized.legacy_employee_status,
      legacy_final_pay_status: normalized.legacy_final_pay_status,
      person_key: buildPersonKey({
        legacy_id: legacyId,
        sss_number: asText(employee.SSSno),
        tin: asText(employee.TINno),
        birth_date: birthDate,
        last_name: lastName,
        first_name: firstName,
        middle_name: asText(employee.mname),
      }),
      is_current_engagement: true,
      superseded_by: null,
      daily_rate: asNumber(employee.dailyrate),
      billing_daily_rate: asNumber(employee.billingdailyrate),
      ecola: asNumber(employee.ecola),
      tin: asText(employee.TINno),
      sss_number: asText(employee.SSSno),
      philhealth_number: asText(employee.philhealthno),
      pagibig_number: asText(employee.pagibigno),
      tax_status: asText(employee.tax_status),
      bank_name: asText(employee.bankname),
      bank_account_no: asText(employee.bankaccountno),
      gcash: asText(employee.gcash),
      pay_through: asText(employee.paythrough),
      email: asText(employee.pri_email),
      mobile: asText(employee.pri_mobile) ?? asText(employee.mobile),
      address: asText(employee.pri_address),
    });
    employeeIdByLegacy.set(legacyId, id);
    employeeOrgId.set(id, orgId);
    employeeCount += 1;
    if (employeeCount % 500 === 0) {
      console.log(
        `employees upserted: ${employeeCount}` +
          (skipped ? ` (skipped ${skipped})` : "")
      );
    }
  }

  // Resume skips employee upserts but still refreshes 201 children + barred.
  if (RESUME && employeeIdByLegacy.size < employees.length) {
    const missing = await existingEmployeeLegacyIds(admin);
    for (const [legacyId, id] of missing.ids) {
      if (!employeeIdByLegacy.has(legacyId)) employeeIdByLegacy.set(legacyId, id);
    }
    for (const [id, orgId] of missing.orgs) {
      if (!employeeOrgId.has(id)) employeeOrgId.set(id, orgId);
    }
  }

  await syncChildrenAndBarred(
    pool,
    admin,
    employeeIdByLegacy,
    employeeOrgId,
    defaultOrgId,
    barredRows
  );

  await pool.close();
  console.log(
    JSON.stringify(
      {
        applied: true,
        organizations: orgIdByLegacy.size,
        clients: clientIdByLegacy.size,
        branches: branchIdByLegacy.size,
        positions: positionIdByLegacy.size,
        employees: employeeIdByLegacy.size,
        employees_inserted: employeeCount,
        employees_skipped: skipped,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
