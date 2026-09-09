import { NextRequest } from "next/server";
import {
  directoryClient,
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  buildDebitMemo,
  debitMemoFilename,
  debitMemoToPdf,
  parseBillingOutputPack,
  soaFilename,
  soaSheet,
  soaWorkbookBuffer,
  withDirectoryPerson,
  type StoredBillingLine,
} from "@/lib/client-billing/outputs";
import { binaryFileResponse } from "@/lib/http/binary-file-response";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";

type Ctx = { params: { id: string } };

type BillingLineRow = StoredBillingLine & { id?: string };

async function loadAllBillingLines(
  publicDb: ReturnType<typeof publicDbClient>,
  runId: string
): Promise<BillingLineRow[]> {
  const rows: BillingLineRow[] = [];
  const page = 200;
  for (let offset = 0; ; offset += page) {
    const { data, error } = await publicDb
      .from("billing_lines")
      .select(
        "directory_employee_id, employee_code, last_name, first_name, billing_daily_rate, billing_hourly_rate, hours, amounts, labor, mandatories, billable"
      )
      .eq("run_id", runId)
      .order("last_name")
      .range(offset, offset + page - 1);
    if (error) throw new Error(error.message);
    const chunk = (data ?? []) as BillingLineRow[];
    rows.push(...chunk);
    if (chunk.length < page) break;
  }
  return rows;
}

/**
 * Download SOA workbook or debit-memo PDF from a processed billing run.
 * ?type=soa|debit-memo  &format=json
 */
export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const type = (request.nextUrl.searchParams.get("type") ?? "soa").trim();
  if (type !== "soa" && type !== "debit-memo") {
    return jsonError("Invalid type. Use soa or debit-memo", 400);
  }

  const publicDb = publicDbClient();
  const { data: run, error } = await publicDb
    .from("billing_runs")
    .select("*")
    .eq("cutoff_period_id", params.id)
    .eq("organization_id", orgId)
    .eq("status", "processed")
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!run) {
    return jsonError(
      "Process billing first. Cancelled runs cannot be downloaded.",
      409
    );
  }

  const { data: period, error: periodError } = await publicDb
    .from("cutoff_periods")
    .select("id, client_id, branch_id, period_start, period_end")
    .eq("id", params.id)
    .eq("organization_id", orgId)
    .maybeSingle();
  if (periodError) return jsonError(periodError.message, 500);
  if (!period) return jsonError("Cutoff period not found", 404);

  const directory = directoryClient();
  const { data: clientRow, error: clientError } = await directory
    .from("clients")
    .select(
      "id, name, billing_output_pack, billing_prepared_by, billing_prepared_by_role, billing_noted_by, billing_noted_by_role"
    )
    .eq("id", period.client_id)
    .maybeSingle();
  if (clientError) return jsonError(clientError.message, 500);

  let site = "";
  if (period.branch_id) {
    const { data: branch } = await directory
      .from("client_branches")
      .select("name")
      .eq("id", period.branch_id)
      .maybeSingle();
    site = String(branch?.name ?? "").trim();
  }

  let lines: BillingLineRow[];
  try {
    lines = await loadAllBillingLines(publicDb, run.id as string);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : "Failed to load billing lines",
      500
    );
  }

  const directoryIds = [
    ...new Set(
      lines
        .map((line) => line.directory_employee_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];
  if (directoryIds.length) {
    const { data: people, error: peopleError } = await directory
      .from("employees")
      .select("id, employee_code, last_name, first_name")
      .in("id", directoryIds);
    if (peopleError) return jsonError(peopleError.message, 500);
    const personById = new Map(
      (people ?? []).map((row) => [
        row.id as string,
        {
          employee_code: (row.employee_code as string | null) ?? null,
          last_name: (row.last_name as string | null) ?? null,
          first_name: (row.first_name as string | null) ?? null,
        },
      ])
    );
    lines = lines.map((line) =>
      withDirectoryPerson(
        line,
        line.directory_employee_id
          ? personById.get(line.directory_employee_id)
          : undefined
      )
    );
  }

  const pack = parseBillingOutputPack(clientRow?.billing_output_pack);
  const fees = (run.fees ?? {}) as { expenses?: unknown };
  const expenses = Array.isArray(fees.expenses) ? fees.expenses : [];
  const meta = {
    pack,
    client_name: String(clientRow?.name ?? "").trim(),
    site,
    period_start: String(period.period_start).slice(0, 10),
    period_end: String(period.period_end).slice(0, 10),
    billing_reference: String(run.billing_reference ?? ""),
    billing_date: String(run.billing_date ?? "").slice(0, 10),
    totals: (run.totals ?? {}) as Record<string, number>,
    expenses,
    prepared_by_name: String(clientRow?.billing_prepared_by ?? "").trim(),
    prepared_by_role: String(clientRow?.billing_prepared_by_role ?? "").trim(),
    noted_by_name: String(clientRow?.billing_noted_by ?? "").trim(),
    noted_by_role: String(clientRow?.billing_noted_by_role ?? "").trim(),
  };

  const asJson = request.nextUrl.searchParams.get("format") === "json";

  if (type === "soa") {
    const sheet = soaSheet({
      ...meta,
      lines,
    });
    const buffer = soaWorkbookBuffer(sheet);
    const filename = soaFilename(pack, meta.billing_reference);
    if (asJson) {
      return jsonOk({
        data: {
          type,
          filename,
          mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          xlsx_base64: buffer.toString("base64"),
        },
      });
    }
    return binaryFileResponse(buffer, {
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      filename,
    });
  }

  const memo = buildDebitMemo({
    ...meta,
    headcount: lines.length,
    totals: meta.totals,
  });
  const pdf = debitMemoToPdf(memo);
  const filename = debitMemoFilename(meta.billing_reference);
  if (asJson) {
    return jsonOk({
      data: {
        type,
        filename,
        mime: "application/pdf",
        pdf_base64: Buffer.from(pdf).toString("base64"),
      },
    });
  }
  return binaryFileResponse(pdf, {
    contentType: "application/pdf",
    filename,
  });
}
