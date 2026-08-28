import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  buildOfficePatchFromDirectory,
  DIRECTORY_EMPLOYEE_SYNC_SELECT,
  patchFieldNames,
  type DirectoryEmployeeForOfficeSync,
} from "@/lib/directory/office-from-directory-sync";

export const dynamic = "force-dynamic";

const ORGANIC_ORG_NAME = "Organic";

const OFFICE_SELECT =
  "id, organization_id, employee_id, employee_code, full_name, first_name, last_name, middle_initial, middle_name, gender, sex, birth_date, hire_date, regular_date, resign_date, status, position, position_id, branch_id, job_level, per_day, daily_rate, billing_daily_rate, ecola, monthly_rate, tin_number, tin, tax_status, bank_name, bank_account_no, gcash, pay_through, email, mobile, sss_number, philhealth_number, pagibig_number, address, profile_picture_url, employee_type, is_active, legacy_id, directory_employee_id, directory_client_id";

async function resolveOrganicOrgId(
  directory: ReturnType<ReturnType<typeof createClient>["schema"]>
) {
  const { data, error } = await directory
    .from("organizations")
    .select("id")
    .ilike("name", ORGANIC_ORG_NAME)
    .maybeSingle();
  if (error) throw error;
  return data?.id as string | undefined;
}

type Body = {
  office_employee_id?: string;
  dry_run?: boolean;
  active_only?: boolean;
};

export async function POST(request: NextRequest) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  if (!auth.userId) {
    return jsonError("Admin or HR session required", 403);
  }

  const body = (await request.json().catch(() => ({}))) as Body;
  const dryRun = body.dry_run === true;
  const activeOnly = body.active_only !== false;

  try {
    const organicOrgId = await resolveOrganicOrgId(auth.supabase);
    if (!organicOrgId) return jsonError("Organic organization not found", 404);

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return jsonError("Supabase env missing", 500);

    const publicDb = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: clientRow } = await auth.supabase
      .from("clients")
      .select("id")
      .eq("organization_id", organicOrgId)
      .limit(1)
      .maybeSingle();
    const organicClientId = (clientRow?.id as string | undefined) ?? null;

    let officeQuery = publicDb
      .from("employees")
      .select(OFFICE_SELECT)
      .not("directory_employee_id", "is", null);

    if (body.office_employee_id) {
      officeQuery = officeQuery.eq("id", body.office_employee_id);
    }
    if (activeOnly) {
      officeQuery = officeQuery.eq("is_active", true);
    }

    const { data: officeRows, error: officeError } = await officeQuery.order(
      "full_name"
    );
    if (officeError) return jsonError(officeError.message, 500);

    const results: Array<{
      office_id: string;
      employee_id: string | null;
      full_name: string | null;
      filled_fields: string[];
      skipped: boolean;
      reason?: string;
    }> = [];

    let updated = 0;
    let skipped = 0;

    for (const office of officeRows ?? []) {
      const directoryEmployeeId = office.directory_employee_id as string;
      const { data: dirEmp, error: dirError } = await auth.supabase
        .from("employees")
        .select(DIRECTORY_EMPLOYEE_SYNC_SELECT)
        .eq("id", directoryEmployeeId)
        .eq("organization_id", organicOrgId)
        .maybeSingle();

      if (dirError) return jsonError(dirError.message, 500);
      if (!dirEmp) {
        skipped += 1;
        results.push({
          office_id: office.id as string,
          employee_id: office.employee_id as string | null,
          full_name: office.full_name as string | null,
          filled_fields: [],
          skipped: true,
          reason: "Linked Directory row not found in Organic",
        });
        continue;
      }

      const patch = buildOfficePatchFromDirectory(
        dirEmp as DirectoryEmployeeForOfficeSync,
        {
          organicClientId,
          organicOrgId,
          adoptDirectoryEmployeeCode: false,
          currentOfficeEmployeeId: office.employee_id as string | null,
          updatedBy: auth.userId,
          mode: "fill_missing",
          office,
        }
      );

      const filledFields = patchFieldNames(patch);
      if (!filledFields.length) {
        skipped += 1;
        results.push({
          office_id: office.id as string,
          employee_id: office.employee_id as string | null,
          full_name: office.full_name as string | null,
          filled_fields: [],
          skipped: true,
          reason: "Office record already has all mapped 201 fields",
        });
        continue;
      }

      if (!dryRun) {
        const { error: updateError } = await publicDb
          .from("employees")
          .update(patch)
          .eq("id", office.id);
        if (updateError) return jsonError(updateError.message, 400);
        updated += 1;
      }

      results.push({
        office_id: office.id as string,
        employee_id: office.employee_id as string | null,
        full_name: office.full_name as string | null,
        filled_fields: filledFields,
        skipped: false,
      });
    }

    return jsonOk({
      data: {
        dry_run: dryRun,
        scanned: officeRows?.length ?? 0,
        updated: dryRun ? results.filter((r) => !r.skipped).length : updated,
        skipped,
        results,
      },
    });
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Fill missing from 201 failed",
      500
    );
  }
}
