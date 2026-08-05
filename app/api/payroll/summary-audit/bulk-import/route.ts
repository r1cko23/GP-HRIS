/**
 * POST /api/payroll/summary-audit/bulk-import
 *
 * Multi-file Payroll Summary import:
 * 1. Peek client name from PDF / folder path / filename
 * 2. Find or create that client
 * 3. Queue register upload (same async parse path as single upload)
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { verifyAdminAccess } from "@/lib/api-helpers";
import { assertPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
import { findOrCreateAuditCompany } from "@/lib/payroll-summary/find-or-create-audit-company";
import { peekRegisterClientName } from "@/lib/payroll-summary/peek-register-client";
import { queuePayrollRegisterUpload } from "@/lib/payroll-summary/queue-register-upload";
import { getAdminClient } from "@/lib/supabase/admin";
import type { AuditCompany } from "@/lib/payroll-summary/types";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 40;

interface BulkFileInput {
  file_name?: string;
  file_base64?: string;
  /** Optional folder path from webkitRelativePath */
  relative_path?: string | null;
}

interface BulkImportResult {
  file_name: string;
  relative_path: string | null;
  status: "queued" | "failed";
  client: AuditCompany | null;
  client_created: boolean;
  client_source: "pdf" | "path" | "filename" | null;
  upload_id: string | null;
  error: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const authUser = await verifyAdminAccess();
    if (!authUser) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await request.json()) as { files?: BulkFileInput[] };
    const files = body.files ?? [];

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json(
        { error: "Provide at least one file in files[]" },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Bulk import is limited to ${MAX_FILES} files per request` },
        { status: 400 }
      );
    }

    const supabase = createServerComponentClient({ cookies });
    const admin = getAdminClient();

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

    const results: BulkImportResult[] = [];

    for (const file of files) {
      const fileName = file.file_name?.trim() ?? "";
      const relativePath = file.relative_path?.trim() || null;
      const fileBase64 = file.file_base64 ?? "";

      const fail = (error: string): BulkImportResult => ({
        file_name: fileName || "(unnamed)",
        relative_path: relativePath,
        status: "failed",
        client: null,
        client_created: false,
        client_source: null,
        upload_id: null,
        error,
      });

      if (!fileName || !fileBase64) {
        results.push(fail("Each file needs file_name and file_base64"));
        continue;
      }

      try {
        assertPayrollSummaryFileName(fileName);
      } catch (err) {
        results.push(
          fail(err instanceof Error ? err.message : "Invalid payroll summary filename")
        );
        continue;
      }

      let buffer: Buffer;
      try {
        buffer = Buffer.from(fileBase64, "base64");
      } catch {
        results.push(fail("Invalid base64 payload"));
        continue;
      }

      if (buffer.length === 0 || buffer.length > MAX_FILE_BYTES) {
        results.push(
          fail(
            buffer.length === 0
              ? "Empty file"
              : `File exceeds ${MAX_FILE_BYTES / (1024 * 1024)}MB limit`
          )
        );
        continue;
      }

      try {
        const peek = await peekRegisterClientName({
          buffer,
          fileName,
          relativePath,
        });

        const { company, created } = await findOrCreateAuditCompany(
          supabase,
          peek.clientName
        );

        const upload = await queuePayrollRegisterUpload({
          supabase,
          admin,
          uploadedBy: authUser.userId,
          companyId: company.id,
          fileName,
          buffer,
          fileBase64,
          request,
        });

        results.push({
          file_name: fileName,
          relative_path: relativePath,
          status: "queued",
          client: company,
          client_created: created,
          client_source: peek.source,
          upload_id: upload.id,
          error: null,
        });
      } catch (err) {
        results.push(
          fail(err instanceof Error ? err.message : "Failed to import file")
        );
      }
    }

    const queued = results.filter((r) => r.status === "queued").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const clientsCreated = results.filter((r) => r.client_created).length;

    return NextResponse.json(
      {
        results,
        summary: {
          total: results.length,
          queued,
          failed,
          clients_created: clientsCreated,
        },
        status: "accepted",
        message:
          queued > 0
            ? `${queued} file${queued === 1 ? "" : "s"} queued. Parsing runs in the background per client.`
            : "No files were queued.",
      },
      { status: queued > 0 ? 202 : 422 }
    );
  } catch (error: unknown) {
    console.error("Payroll audit bulk-import error:", error);
    const message =
      error instanceof Error ? error.message : "Bulk import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
