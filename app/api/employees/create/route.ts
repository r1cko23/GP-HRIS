import { NextRequest, NextResponse } from "next/server";
import { verifyAdminOrHrAccess } from "@/lib/api-helpers";
import { invalidateAppCache } from "@/lib/cache";
import { directoryClient } from "@/lib/directory/auth";
import { enrollFromDirectory } from "@/lib/directory/bundy-enrollment";
import { assertCanActOnOrg } from "@/lib/directory/org-access";

/**
 * Bundy enrollment only (ADR 0008).
 * Identity is created via Directory Engagement.hire — this route links/creates
 * public.employees for Clock from an existing directory_employee_id.
 */
export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyAdminOrHrAccess();
    if (!authUser) {
      return NextResponse.json(
        { error: "Forbidden: Admin/HR access required" },
        { status: 403 }
      );
    }

    const body = (await req.json().catch(() => null)) as {
      directory_employee_id?: string;
      organization_id?: string;
      locationIds?: string[];
      overtime_group_id?: string | null;
      portal_password?: string | null;
    } | null;

    const directoryEmployeeId = body?.directory_employee_id?.trim();
    if (!directoryEmployeeId) {
      return NextResponse.json(
        {
          error:
            "directory_employee_id is required. Create the person in Directory first, then enroll for Bundy.",
        },
        { status: 400 }
      );
    }

    const locationIds = Array.isArray(body?.locationIds) ? body.locationIds : [];
    if (locationIds.length === 0) {
      return NextResponse.json(
        { error: "Please assign at least one location" },
        { status: 400 }
      );
    }

    const directory = directoryClient();
    const { data: dirEmp, error: dirError } = await directory
      .from("employees")
      .select("id, organization_id, client_id, employee_code")
      .eq("id", directoryEmployeeId)
      .maybeSingle();

    if (dirError) {
      return NextResponse.json({ error: dirError.message }, { status: 500 });
    }
    if (!dirEmp) {
      return NextResponse.json(
        { error: "Directory employee not found" },
        { status: 404 }
      );
    }

    const organizationId =
      body?.organization_id?.trim() ||
      (dirEmp.organization_id as string | null) ||
      "";
    if (!organizationId) {
      return NextResponse.json(
        { error: "organization_id could not be resolved" },
        { status: 400 }
      );
    }

    const access = await assertCanActOnOrg(
      directory,
      {
        userId: authUser.userId,
        role: authUser.role,
        viaServiceKey: false,
      },
      organizationId
    );
    if (!access.ok) {
      return NextResponse.json(
        { error: access.error },
        { status: access.status }
      );
    }

    if (dirEmp.organization_id !== organizationId) {
      return NextResponse.json(
        { error: "Directory employee is not in this organization" },
        { status: 400 }
      );
    }

    const enrolled = await enrollFromDirectory({
      directoryEmployeeId,
      organizationId,
      locationIds,
      overtimeGroupId: body?.overtime_group_id ?? null,
      portalPassword: body?.portal_password ?? null,
      updatedBy: authUser.userId,
      requireLocations: true,
    });

    if (!enrolled.ok) {
      return NextResponse.json(
        { error: enrolled.error ?? "Enrollment failed" },
        { status: 400 }
      );
    }

    await invalidateAppCache();

    return NextResponse.json(
      {
        id: enrolled.office_employee_id,
        directory_employee_id: directoryEmployeeId,
        action: enrolled.action,
        ...(enrolled.warning ? { warning: enrolled.warning } : {}),
      },
      { status: enrolled.action === "created" ? 201 : 200 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal server error", details: message },
      { status: 500 }
    );
  }
}
