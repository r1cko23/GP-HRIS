import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { invalidateAppCache } from "@/lib/cache";
import { directoryClient } from "@/lib/directory/auth";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];

async function resolveOrganicOrgId(): Promise<string | null> {
  const directory = directoryClient();
  const { data: rows } = await directory
    .from("organizations")
    .select("id, name, slug")
    .order("name");
  const list = (rows ?? []) as Array<{ id: string; name: string; slug: string }>;
  const bySlug = list.find((o) => /^organic/i.test(o.slug));
  if (bySlug) return bySlug.id;
  const byName = list.find((o) => /organic/i.test(o.name));
  return byName?.id ?? null;
}

export async function POST(req: NextRequest) {
  try {
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return NextResponse.json(
        {
          error: "Server not configured",
          details:
            "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable",
        },
        { status: 500 }
      );
    }

    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin/HR access required" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as
      | {
          employee?: EmployeeInsert & {
            employee_code?: string | null;
            hire_date?: string | null;
            portal_password?: string | null;
          };
          locationIds?: string[];
        }
      | null;

    const employee = body?.employee;
    const locationIds = Array.isArray(body?.locationIds) ? body?.locationIds : [];

    if (!employee?.full_name) {
      return NextResponse.json(
        { error: "Missing required employee fields (full_name)" },
        { status: 400 }
      );
    }
    if (locationIds.length === 0) {
      return NextResponse.json(
        { error: "Please assign at least one location" },
        { status: 400 }
      );
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    let code = String(
      employee.employee_id || employee.employee_code || ""
    ).trim();
    const organicOrgId = await resolveOrganicOrgId();

    if (!code) {
      if (!organicOrgId) {
        return NextResponse.json(
          {
            error: "Cannot auto-allocate Employee ID",
            details: "Organic organization not found in Directory",
          },
          { status: 500 }
        );
      }
      const hireDate =
        (typeof employee.hire_date === "string" && employee.hire_date.trim()) ||
        new Date().toISOString().slice(0, 10);
      const { data: allocated, error: allocError } = await directoryClient().rpc(
        "allocate_employee_code",
        {
          p_org: organicOrgId,
          p_hire_date: hireDate,
        }
      );
      if (allocError) {
        return NextResponse.json(
          {
            error: "Failed to allocate Employee ID",
            details: allocError.message,
          },
          { status: 500 }
        );
      }
      if (typeof allocated !== "string" || !allocated) {
        return NextResponse.json(
          { error: "Failed to allocate Employee ID" },
          { status: 500 }
        );
      }
      code = allocated;
    }

    const insertRow = {
      ...employee,
      employee_id: code,
      employee_code: code,
      portal_password: employee.portal_password || code,
      organization_id:
        (employee as { organization_id?: string | null }).organization_id ??
        organicOrgId,
      created_by: authUser.userId,
      updated_by: authUser.userId,
    };

    const { data: inserted, error: insertError } = await (supabaseAdmin.from(
      "employees"
    ) as any)
      .insert(insertRow as EmployeeInsert)
      .select("id, employee_id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: "Failed to create employee", details: insertError.message },
        { status: 500 }
      );
    }

    const employeeId = inserted?.id;
    if (!employeeId) {
      return NextResponse.json(
        { error: "Failed to create employee", details: "No employee id returned" },
        { status: 500 }
      );
    }

    const { error: locationError } = await (supabaseAdmin.from(
      "employee_location_assignments"
    ) as any)
      .insert(
        locationIds.map((location_id) => ({
          employee_id: employeeId,
          location_id,
        }))
      );

    if (locationError) {
      await (supabaseAdmin.from("employees") as any).delete().eq("id", employeeId);

      return NextResponse.json(
        {
          error: "Failed to save employee locations",
          details: locationError.message,
        },
        { status: 500 }
      );
    }

    await invalidateAppCache();

    return NextResponse.json(
      { id: employeeId, employee_id: inserted.employee_id ?? code },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
