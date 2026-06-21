import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  processRegisterUpload,
  rowToUploadRecord,
} from "@/lib/payroll-summary/process-register-upload";

export const runtime = "nodejs";
export const maxDuration = 60;

function formatProcessError(error: unknown): { message: string; status: number } {
  const message =
    error instanceof Error ? error.message : "Failed to process upload";

  const isParseError =
    /Could not find totals row|Could not detect cutoff period|Unexpected .* column count|Payroll Summary PDF|Failed to parse payroll register|does not match register gross|does not match Salaries and Wages|No employees were parsed|Every centavo must tie out|Upload file is missing/i.test(
      message
    );

  return { message, status: isParseError ? 422 : 500 };
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const upload_id = body?.upload_id as string | undefined;
    const retry = body?.retry === true;

    if (!upload_id) {
      return NextResponse.json(
        { error: "upload_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const result = await processRegisterUpload(admin, upload_id, {
      allowRetryFailed: retry,
    });

    if ("status" in result && result.status === "processing") {
      return NextResponse.json(
        { upload_id, status: "processing" },
        { status: 202 }
      );
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Payroll summary audit process error:", error);
    const { message, status } = formatProcessError(error);
    return NextResponse.json({ error: message, status: "failed" }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const uploadId = request.nextUrl.searchParams.get("upload_id");
    if (!uploadId) {
      return NextResponse.json(
        { error: "upload_id is required" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from("payroll_summary_uploads")
      .select(
        "id, uploaded_by, uploaded_at, company_id, document_type, period_start, period_end, source_file_name, source_format, company_name, payout_date, employee_count, hours_worked_total, reg_ot_hours_total, total_ot_amount, sil_total, sil_cutoff_total, gross_amount_total, net_amount_total, parsed_json, status, error_message, rollup_gap_centavos, processed_at, storage_path"
      )
      .eq("id", uploadId)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    return NextResponse.json({ upload: rowToUploadRecord(data) });
  } catch (error: unknown) {
    console.error("Payroll summary audit process GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load upload status";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
