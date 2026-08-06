import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { cachedJson } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMPLOYEES_SELECT = `
  id, employee_id, first_name, last_name, middle_initial, full_name,
  position, employee_type, job_level, is_active,
  monthly_rate, per_day, hire_date, assigned_hotel,
  address, birth_date, tin_number, sss_number, philhealth_number, pagibig_number,
  employee_location_assignments (
    location_id,
    office_locations (
      id,
      name
    )
  )
`;

export async function GET() {
  try {
    const auth = await verifyAdminOrHrAccess();
    if (!auth) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });

    const { data, cache } = await cachedJson(
      ["employees", "list", auth.userId],
      async () => {
        const [employeesRes, locationsRes] = await Promise.all([
          supabase
            .from("employees")
            .select(EMPLOYEES_SELECT)
            .order("last_name", { ascending: true, nullsFirst: true })
            .order("first_name", { ascending: true, nullsFirst: true }),
          supabase
            .from("office_locations")
            .select("id, name")
            .eq("is_active", true)
            .order("name"),
        ]);

        if (employeesRes.error) throw employeesRes.error;
        if (locationsRes.error) throw locationsRes.error;

        return {
          employees: employeesRes.data ?? [],
          locations: locationsRes.data ?? [],
        };
      },
      120
    );

    return NextResponse.json(data, {
      headers: { "X-Cache": cache },
    });
  } catch (error: unknown) {
    console.error("Employees list GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load employees";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
