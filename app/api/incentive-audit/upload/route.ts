/**
 * Incentive Audit API
 *
 * POST   /api/incentive-audit/upload — parse Excel, audit duplicates / already-received
 * GET    /api/incentive-audit/upload — list uploads
 * GET    /api/incentive-audit/upload?id= — upload + audited rows
 * DELETE /api/incentive-audit/upload?id= — remove one upload
 * DELETE /api/incentive-audit/upload?clear_all=true — clear history
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import {
  auditIncentiveCandidates,
  isPaidIncentiveRecipient,
  parseIncentiveVerificationWorkbook,
  type AuditedIncentiveRow,
  type HistoricalIncentiveRecipient,
  type IncentiveAuditSummary,
  type IncentiveAuditUploadRecord,
} from "@/lib/incentive-audit";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

const UPLOAD_SELECT =
  "id, uploaded_by, uploaded_at, source_file_name, status, error_message, total_candidates, duplicate_count, already_received_count, fuzzy_match_count, approved_count, disapproved_count, total_incentive_amount, audit_summary";

const ROW_SELECT =
  "id, upload_id, sheet, row_index, industry, candidate_name, normalized_name, branch_client, position, recruiter, endorsement_date, deployment_date, hris_verification, status, total_hours, total_days, incentive_amount, notes, is_duplicate_in_file, is_already_received, is_fuzzy_match, match_score, matched_name, matched_upload_id, matched_row_id, flags";

function rowToUpload(row: Record<string, unknown>): IncentiveAuditUploadRecord {
  return {
    id: String(row.id),
    uploadedAt: String(row.uploaded_at),
    uploadedBy: String(row.uploaded_by),
    sourceFileName: (row.source_file_name as string | null) ?? null,
    status: (row.status as "ready" | "failed") ?? "ready",
    errorMessage: (row.error_message as string | null) ?? null,
    totalCandidates: Number(row.total_candidates ?? 0),
    duplicateCount: Number(row.duplicate_count ?? 0),
    alreadyReceivedCount: Number(row.already_received_count ?? 0),
    fuzzyMatchCount: Number(row.fuzzy_match_count ?? 0),
    approvedCount: Number(row.approved_count ?? 0),
    disapprovedCount: Number(row.disapproved_count ?? 0),
    totalIncentiveAmount: Number(row.total_incentive_amount ?? 0),
    auditSummary:
      (row.audit_summary as IncentiveAuditSummary) ?? ({} as IncentiveAuditSummary),
  };
}

function dbRowToAudited(row: Record<string, unknown>): AuditedIncentiveRow {
  const flags = (row.flags as { duplicatePeers?: string[] } | null) ?? {};
  return {
    sheet: row.sheet as AuditedIncentiveRow["sheet"],
    rowIndex: Number(row.row_index),
    industry: (row.industry as string | null) ?? null,
    candidateName: String(row.candidate_name),
    normalizedName: String(row.normalized_name),
    branchClient: (row.branch_client as string | null) ?? null,
    position: (row.position as string | null) ?? null,
    recruiter: (row.recruiter as string | null) ?? null,
    endorsementDate: (row.endorsement_date as string | null) ?? null,
    deploymentDate: (row.deployment_date as string | null) ?? null,
    hrisVerification: (row.hris_verification as string | null) ?? null,
    status: (row.status as string | null) ?? null,
    totalHours: row.total_hours != null ? Number(row.total_hours) : null,
    totalDays: row.total_days != null ? Number(row.total_days) : null,
    incentiveAmount: Number(row.incentive_amount ?? 0),
    notes: (row.notes as string | null) ?? null,
    isDuplicateInFile: Boolean(row.is_duplicate_in_file),
    isAlreadyReceived: Boolean(row.is_already_received),
    isFuzzyMatch: Boolean(row.is_fuzzy_match),
    matchScore: row.match_score != null ? Number(row.match_score) : null,
    matchedName: (row.matched_name as string | null) ?? null,
    matchedUploadId: (row.matched_upload_id as string | null) ?? null,
    matchedRowId: (row.matched_row_id as string | null) ?? null,
    duplicatePeers: flags.duplicatePeers ?? [],
  };
}

function auditedToInsert(uploadId: string, row: AuditedIncentiveRow) {
  return {
    upload_id: uploadId,
    sheet: row.sheet,
    row_index: row.rowIndex,
    industry: row.industry,
    candidate_name: row.candidateName,
    normalized_name: row.normalizedName,
    branch_client: row.branchClient,
    position: row.position,
    recruiter: row.recruiter,
    endorsement_date: row.endorsementDate,
    deployment_date: row.deploymentDate,
    hris_verification: row.hrisVerification,
    status: row.status,
    total_hours: row.totalHours,
    total_days: row.totalDays,
    incentive_amount: row.incentiveAmount,
    notes: row.notes,
    is_duplicate_in_file: row.isDuplicateInFile,
    is_already_received: row.isAlreadyReceived,
    is_fuzzy_match: row.isFuzzyMatch,
    match_score: row.matchScore,
    matched_name: row.matchedName,
    matched_upload_id: row.matchedUploadId,
    matched_row_id: row.matchedRowId,
    flags: { duplicatePeers: row.duplicatePeers },
  };
}

export async function GET(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const id = request.nextUrl.searchParams.get("id");

    if (id) {
      const { data: upload, error: uploadError } = await supabase
        .from("incentive_audit_uploads")
        .select(UPLOAD_SELECT)
        .eq("id", id)
        .maybeSingle();
      if (uploadError) throw uploadError;
      if (!upload) {
        return NextResponse.json({ error: "Upload not found" }, { status: 404 });
      }

      const { data: rows, error: rowsError } = await supabase
        .from("incentive_audit_rows")
        .select(ROW_SELECT)
        .eq("upload_id", id)
        .order("sheet", { ascending: true })
        .order("row_index", { ascending: true });
      if (rowsError) throw rowsError;

      return NextResponse.json({
        upload: rowToUpload(upload),
        rows: (rows ?? []).map(dbRowToAudited),
      });
    }

    const { data, error } = await supabase
      .from("incentive_audit_uploads")
      .select(UPLOAD_SELECT)
      .order("uploaded_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return NextResponse.json({
      uploads: (data ?? []).map(rowToUpload),
    });
  } catch (error: unknown) {
    console.error("Incentive audit GET error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to load incentive audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const supabase = createServerComponentClient({ cookies });
    const id = request.nextUrl.searchParams.get("id");
    const clearAll = request.nextUrl.searchParams.get("clear_all") === "true";

    if (clearAll) {
      const { data, error } = await supabase
        .from("incentive_audit_uploads")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000")
        .select("id");
      if (error) throw error;
      return NextResponse.json({ deletedCount: data?.length ?? 0 });
    }

    if (!id) {
      return NextResponse.json(
        { error: "Provide id or clear_all=true" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("incentive_audit_uploads")
      .delete()
      .eq("id", id);
    if (error) throw error;

    return NextResponse.json({ deleted: id });
  } catch (error: unknown) {
    console.error("Incentive audit DELETE error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { file_name, file_base64 } = body as {
      file_name?: string;
      file_base64?: string;
    };

    if (!file_base64) {
      return NextResponse.json(
        { error: "file_base64 is required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(file_base64, "base64");
    if (buffer.length > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 15MB." },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("id")
      .eq("id", authUser.userId)
      .eq("is_active", true)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile) {
      return NextResponse.json(
        {
          error:
            "Your admin account is missing an active user profile. Contact IT before uploading.",
        },
        { status: 500 }
      );
    }

    let candidates;
    try {
      candidates = parseIncentiveVerificationWorkbook(buffer);
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Failed to parse Excel file";
      return NextResponse.json({ error: message }, { status: 422 });
    }

    const { data: historyRows, error: historyError } = await supabase
      .from("incentive_audit_rows")
      .select(
        "id, upload_id, candidate_name, normalized_name, incentive_amount, status, sheet"
      )
      .gt("incentive_amount", 0)
      .ilike("status", "APPROVED");
    if (historyError) throw historyError;

    const history: HistoricalIncentiveRecipient[] = (historyRows ?? []).map(
      (row) => ({
        id: String(row.id),
        uploadId: String(row.upload_id),
        candidateName: String(row.candidate_name),
        normalizedName: String(row.normalized_name),
        incentiveAmount: Number(row.incentive_amount ?? 0),
        status: (row.status as string | null) ?? null,
        sheet: row.sheet as HistoricalIncentiveRecipient["sheet"],
      })
    );

    const { rows, summary } = auditIncentiveCandidates(candidates, history);

    const { data: inserted, error: insertError } = await supabase
      .from("incentive_audit_uploads")
      .insert({
        uploaded_by: authUser.userId,
        source_file_name: file_name ?? null,
        status: "ready",
        total_candidates: summary.totalCandidates,
        duplicate_count: summary.duplicateCount,
        already_received_count: summary.alreadyReceivedCount,
        fuzzy_match_count: summary.fuzzyMatchCount,
        approved_count: summary.approvedCount,
        disapproved_count: summary.disapprovedCount,
        total_incentive_amount: summary.totalIncentiveAmount,
        audit_summary: summary,
      })
      .select(UPLOAD_SELECT)
      .single();
    if (insertError) throw insertError;

    const { error: rowsInsertError } = await supabase
      .from("incentive_audit_rows")
      .insert(rows.map((row) => auditedToInsert(String(inserted.id), row)));
    if (rowsInsertError) {
      await supabase
        .from("incentive_audit_uploads")
        .delete()
        .eq("id", inserted.id);
      throw rowsInsertError;
    }

    const flagged = rows.filter(
      (r) => r.isDuplicateInFile || r.isAlreadyReceived
    );

    return NextResponse.json({
      upload: rowToUpload(inserted),
      summary,
      rows,
      flagged,
      paidHistoryCount: history.filter(isPaidIncentiveRecipient).length,
    });
  } catch (error: unknown) {
    console.error("Incentive audit POST error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to process upload";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
