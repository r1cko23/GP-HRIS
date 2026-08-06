/**
 * GET  /api/payroll/summary-audit/companies — list active clients
 * POST /api/payroll/summary-audit/companies — create a client
 * DELETE /api/payroll/summary-audit/companies?id= — soft-remove client + clear audit data
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { cachedJson, invalidateAppCache } from "@/lib/cache";
import { findOrCreateAuditCompany } from "@/lib/payroll-summary/find-or-create-audit-company";
import { PAYROLL_AUDIT_STORAGE_BUCKET } from "@/lib/payroll-summary/process-register-upload";
import { getAdminClient } from "@/lib/supabase/admin";
import type { AuditCompany } from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

/** Active client list changes rarely; epoch-busted on create/reactivate/delete. */
const COMPANIES_CACHE_TTL_SECONDS = 600;

function toAuditCompany(row: {
  id: string;
  name: string;
  slug: string;
}): AuditCompany {
  return { id: row.id, name: row.name, slug: row.slug };
}

export async function GET() {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const { data: companies, cache } = await cachedJson(
      ["audit", "companies", "active", authUser.userId],
      async () => {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name, slug")
          .eq("is_active", true)
          .order("name");

        if (error) throw error;
        return (data ?? []).map(toAuditCompany);
      },
      COMPANIES_CACHE_TTL_SECONDS
    );

    return NextResponse.json(
      { companies },
      { headers: { "X-Cache": cache } }
    );
  } catch (error: unknown) {
    console.error("Payroll audit companies GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load clients";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      /** When true, return existing client instead of 409 */
      find_or_create?: boolean;
    };
    const name = body.name?.trim() ?? "";
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Client name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    if (body.find_or_create) {
      const { company, created } = await findOrCreateAuditCompany(
        supabase,
        name,
        body.slug
      );
      return NextResponse.json(
        { company, created },
        { status: created ? 201 : 200 }
      );
    }

    const { company, created } = await findOrCreateAuditCompany(
      supabase,
      name,
      body.slug
    );

    if (!created) {
      return NextResponse.json(
        {
          error: `A client with slug "${company.slug}" already exists (${company.name}). Choose a different slug.`,
        },
        { status: 409 }
      );
    }

    return NextResponse.json({ company }, { status: 201 });
  } catch (error: unknown) {
    console.error("Payroll audit companies POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const id = request.nextUrl.searchParams.get("id")?.trim() ?? "";
    if (!id) {
      return NextResponse.json(
        { error: "Provide company id to remove" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const admin = getAdminClient();

    const { data: company, error: lookupError } = await supabase
      .from("companies")
      .select("id, name, slug, is_active")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (!company) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: storageRows } = await admin
      .from("payroll_summary_uploads")
      .select("storage_path")
      .eq("company_id", id)
      .not("storage_path", "is", null);

    const paths = (storageRows ?? [])
      .map((row) => row.storage_path as string | null)
      .filter((path): path is string => Boolean(path));

    if (paths.length > 0) {
      await admin.storage.from(PAYROLL_AUDIT_STORAGE_BUCKET).remove(paths);
    }

    const { error: employeesError } = await supabase
      .from("payroll_audit_client_employees")
      .delete()
      .eq("company_id", id);
    if (employeesError) throw employeesError;

    const { data: deletedUploads, error: uploadsError } = await supabase
      .from("payroll_summary_uploads")
      .delete()
      .eq("company_id", id)
      .select("id");
    if (uploadsError) throw uploadsError;

    const { error: deactivateError } = await supabase
      .from("companies")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (deactivateError) throw deactivateError;

    await invalidateAppCache();

    return NextResponse.json({
      removed: id,
      name: company.name,
      deletedUploads: deletedUploads?.length ?? 0,
    });
  } catch (error: unknown) {
    console.error("Payroll audit companies DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to remove client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
