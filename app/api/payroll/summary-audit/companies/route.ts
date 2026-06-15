/**
 * GET  /api/payroll/summary-audit/companies — list active clients
 * POST /api/payroll/summary-audit/companies — create a client
 */

import { NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import {
  normalizeClientSlug,
  slugifyClientName,
} from "@/lib/payroll-summary/client-slug";
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

    const body = (await request.json()) as { name?: string; slug?: string };
    const name = body.name?.trim() ?? "";
    if (name.length < 2) {
      return NextResponse.json(
        { error: "Client name must be at least 2 characters" },
        { status: 400 }
      );
    }

    const slug = body.slug?.trim()
      ? normalizeClientSlug(body.slug)
      : slugifyClientName(name);

    if (slug.length < 2) {
      return NextResponse.json(
        { error: "Client slug must be at least 2 characters" },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    const { data: existing } = await supabase
      .from("companies")
      .select("id, name, slug, is_active")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        const { data: reactivated, error: updateError } = await supabase
          .from("companies")
          .update({ name, is_active: true, updated_at: new Date().toISOString() })
          .eq("id", existing.id)
          .select("id, name, slug")
          .single();

        if (updateError) throw updateError;
        return NextResponse.json({ company: toAuditCompany(reactivated) });
      }

      return NextResponse.json(
        {
          error: `A client with slug "${slug}" already exists (${existing.name}). Choose a different slug.`,
        },
        { status: 409 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("companies")
      .insert({ name, slug, is_active: true })
      .select("id, name, slug")
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ company: toAuditCompany(inserted) }, { status: 201 });
  } catch (error: unknown) {
    console.error("Payroll audit companies POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to create client";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
