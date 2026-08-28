import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPLOYEES_SELECT = `
  id, employee_id, employee_code, first_name, last_name, middle_initial, full_name,
  position, employee_type, job_level, is_active, status,
  monthly_rate, per_day, daily_rate, hire_date, assigned_hotel,
  address, birth_date, tin, tin_number, sss_number, philhealth_number, pagibig_number,
  profile_picture_url, gender, sex,
  directory_employee_id, organization_id, directory_client_id,
  employee_location_assignments (
    location_id,
    office_locations (
      id,
      name
    )
  )
`;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminOrHrAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status") ?? "all";
    const locationId = params.get("location_id");
    const limit = Math.min(Number(params.get("limit") ?? 50), 200);
    const offset = Math.max(Number(params.get("offset") ?? 0), 0);

    const supabase = createServerComponentClient({ cookies });

    const [locationsRes] = await Promise.all([
      supabase
        .from("office_locations")
        .select("id, name")
        .eq("is_active", true)
        .order("name"),
    ]);

    if (locationsRes.error) throw locationsRes.error;

    let employeeIdsForLocation: string[] | null = null;
    if (locationId) {
      const { data: assignments, error: assignError } = await supabase
        .from("employee_location_assignments")
        .select("employee_id")
        .eq("location_id", locationId);
      if (assignError) throw assignError;
      employeeIdsForLocation = (assignments ?? []).map((row) => row.employee_id);
      if (!employeeIdsForLocation.length) {
        return NextResponse.json({
          employees: [],
          locations: locationsRes.data ?? [],
          count: 0,
          limit,
          offset,
        });
      }
    }

    let query = supabase
      .from("employees")
      .select(EMPLOYEES_SELECT, { count: "exact" })
      .order("last_name", { ascending: true, nullsFirst: true })
      .order("first_name", { ascending: true, nullsFirst: true })
      .range(offset, offset + limit - 1);

    if (status === "active") query = query.eq("is_active", true);
    else if (status === "inactive") query = query.eq("is_active", false);

    if (employeeIdsForLocation) {
      query = query.in("id", employeeIdsForLocation);
    }

    if (q) {
      query = query.or(
        `full_name.ilike.%${q}%,employee_id.ilike.%${q}%,employee_code.ilike.%${q}%,last_name.ilike.%${q}%,first_name.ilike.%${q}%`
      );
    }

    const { data: employees, error: employeesError, count } = await query;
    if (employeesError) throw employeesError;

    return NextResponse.json({
      employees: employees ?? [],
      locations: locationsRes.data ?? [],
      count: count ?? 0,
      limit,
      offset,
    });
  } catch (error: unknown) {
    console.error("Employees list GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
