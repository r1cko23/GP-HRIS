/**
 * GET  /api/payroll/summary-audit/companies — list active clients
 * POST /api/payroll/summary-audit/companies — create a client
 */

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { findOrCreateAuditCompany } from "@/lib/payroll-summary/find-or-create-audit-company";
import type { AuditCompany } from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

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
    const { data, error } = await supabase
      .from("companies")
      .select("id, name, slug")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    const companies: AuditCompany[] = (data ?? []).map(toAuditCompany);

    return NextResponse.json({ companies });
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
