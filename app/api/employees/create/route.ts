import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type EmployeeInsert = Database["public"]["Tables"]["employees"]["Insert"];

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
          employee?: EmployeeInsert;
          locationIds?: string[];
        }
      | null;

    const employee = body?.employee;
    const locationIds = Array.isArray(body?.locationIds) ? body?.locationIds : [];

    if (!employee?.employee_id || !employee?.full_name) {
      return NextResponse.json(
        { error: "Missing required employee fields (employee_id, full_name)" },
        { status: 400 }
      );
    }
    if (locationIds.length === 0) {
      return NextResponse.json(
        { error: "Please assign at least one location" },
        { status: 400 }
      );
    }

    // Use service role client; keep typings loose because some generated DB
    // types in this repo don't fully reflect runtime schema.
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    const { data: inserted, error: insertError } = await (supabaseAdmin.from(
      "employees"
    ) as any)
      .insert({
        ...employee,
        // keep audit fields consistent when present
        created_by: authUser.userId,
        updated_by: authUser.userId,
      } as EmployeeInsert)
      .select("id")
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
      // Best-effort rollback: avoid orphan employee record with no locations.
      await (supabaseAdmin.from("employees") as any).delete().eq("id", employeeId);

      return NextResponse.json(
        {
          error: "Failed to save employee locations",
          details: locationError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ id: employeeId }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}

