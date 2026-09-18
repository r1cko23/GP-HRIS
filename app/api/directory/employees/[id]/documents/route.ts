import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import {
  isAuthResponse,
  jsonError,
  jsonOk,
  requireAuthorizedOrganization,
  resolveDirectoryAuth,
} from "@/lib/directory/auth";
import {
  assertEmployeeDocumentUpload,
  combinedScanNotes,
  EMPLOYEE_DOCUMENTS_BUCKET,
  employeeDocumentStoragePath,
  mimeToExtension,
  resolveUploadDocTypes,
  type EmployeeDocumentType,
} from "@/lib/directory/documents";
import { publicDbClient } from "@/lib/timekeeping/public-db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: { id: string } };

const SIGNED_TTL_SECONDS = 60 * 5;

async function requireEmployee(
  auth: Awaited<ReturnType<typeof resolveDirectoryAuth>>,
  orgId: string,
  employeeId: string
) {
  if (isAuthResponse(auth)) return auth;
  const { data, error } = await auth.supabase
    .from("employees")
    .select("id")
    .eq("organization_id", orgId)
    .eq("id", employeeId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!data) return jsonError("Employee not found", 404);
  return data;
}

async function removeStorageIfUnreferenced(
  auth: Awaited<ReturnType<typeof resolveDirectoryAuth>>,
  storagePath: string
) {
  if (isAuthResponse(auth) || !storagePath) return;
  const { data } = await auth.supabase
    .from("employee_documents")
    .select("id")
    .eq("storage_path", storagePath)
    .is("superseded_at", null)
    .limit(1);
  if (data && data.length > 0) return;

  const publicDb = publicDbClient();
  await publicDb.storage.from(EMPLOYEE_DOCUMENTS_BUCKET).remove([storagePath]);
}

export async function GET(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireEmployee(auth, orgId, params.id);
  if (employee instanceof Response) return employee;

  const includeHistory =
    request.nextUrl.searchParams.get("include_history") === "1";

  let query = auth.supabase
    .from("employee_documents")
    .select(
      "id, doc_type, original_filename, mime_type, file_size, id_number_on_doc, expires_on, notes, uploaded_by, uploaded_at, superseded_at, storage_path"
    )
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .order("uploaded_at", { ascending: false });
  if (!includeHistory) {
    query = query.is("superseded_at", null);
  }

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);

  const publicDb = publicDbClient();
  const rows = [];
  for (const row of data ?? []) {
    const { storage_path, ...rest } = row;
    const { data: signed } = await publicDb.storage
      .from(EMPLOYEE_DOCUMENTS_BUCKET)
      .createSignedUrl(storage_path as string, SIGNED_TTL_SECONDS);
    rows.push({
      ...rest,
      view_url: signed?.signedUrl ?? null,
    });
  }

  return jsonOk({ data: rows });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireEmployee(auth, orgId, params.id);
  if (employee instanceof Response) return employee;

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return jsonError("file is required", 400);
  }

  const resolved = resolveUploadDocTypes({
    docType: form.get("doc_type"),
    containedTypes: form.get("contained_types"),
  });
  if (!resolved.ok) return jsonError(resolved.error, 400);
  const types = resolved.types;

  const check = assertEmployeeDocumentUpload({
    docType: types[0],
    mimeType: file.type,
    fileSize: file.size,
  });
  if (!check.ok) return jsonError(check.error, 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const fileId = randomUUID();
  const storageFolder: EmployeeDocumentType | "bundle" =
    types.length > 1 ? "bundle" : types[0]!;
  const storagePath = employeeDocumentStoragePath({
    organizationId: orgId,
    employeeId: params.id,
    docType: storageFolder,
    fileId,
    extension: mimeToExtension(file.type),
  });

  const publicDb = publicDbClient();
  const { error: uploadError } = await publicDb.storage
    .from(EMPLOYEE_DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadError) return jsonError(uploadError.message, 500);

  const now = new Date().toISOString();
  const expiresRaw = String(form.get("expires_on") ?? "").trim();
  const idOnDoc = String(form.get("id_number_on_doc") ?? "").trim();
  const notesRaw = String(form.get("notes") ?? "").trim();
  const autoNotes = combinedScanNotes(types);
  const notes = notesRaw || autoNotes || null;

  const insertedRows = [];
  for (const docType of types) {
    const { data: current } = await auth.supabase
      .from("employee_documents")
      .select("id, storage_path")
      .eq("employee_id", params.id)
      .eq("doc_type", docType)
      .is("superseded_at", null)
      .maybeSingle();

    if (current?.id) {
      await auth.supabase
        .from("employee_documents")
        .update({ superseded_at: now })
        .eq("id", current.id);
      if (current.storage_path && current.storage_path !== storagePath) {
        await removeStorageIfUnreferenced(auth, current.storage_path as string);
      }
    }

    const { data: inserted, error: insertError } = await auth.supabase
      .from("employee_documents")
      .insert({
        organization_id: orgId,
        employee_id: params.id,
        doc_type: docType,
        storage_path: storagePath,
        original_filename: file.name,
        mime_type: file.type,
        file_size: file.size,
        id_number_on_doc: idOnDoc || null,
        expires_on: /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null,
        notes,
        uploaded_by: auth.userId,
      })
      .select(
        "id, doc_type, original_filename, mime_type, file_size, id_number_on_doc, expires_on, notes, uploaded_by, uploaded_at, superseded_at"
      )
      .single();
    if (insertError) {
      if (insertedRows.length === 0) {
        await publicDb.storage
          .from(EMPLOYEE_DOCUMENTS_BUCKET)
          .remove([storagePath]);
      }
      return jsonError(insertError.message, 500);
    }
    insertedRows.push(inserted);
  }

  const { data: signed } = await publicDb.storage
    .from(EMPLOYEE_DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, SIGNED_TTL_SECONDS);

  return jsonOk(
    {
      data: insertedRows.map((row) => ({
        ...row,
        view_url: signed?.signedUrl ?? null,
      })),
    },
    201
  );
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const auth = await resolveDirectoryAuth(request);
  if (isAuthResponse(auth)) return auth;
  const orgId = await requireAuthorizedOrganization(auth);
  if (typeof orgId !== "string") return orgId;

  const employee = await requireEmployee(auth, orgId, params.id);
  if (employee instanceof Response) return employee;

  const documentId = request.nextUrl.searchParams.get("document_id")?.trim();
  if (!documentId) return jsonError("document_id is required", 400);

  const { data: row, error } = await auth.supabase
    .from("employee_documents")
    .select("id, storage_path")
    .eq("organization_id", orgId)
    .eq("employee_id", params.id)
    .eq("id", documentId)
    .maybeSingle();
  if (error) return jsonError(error.message, 500);
  if (!row) return jsonError("Document not found", 404);

  const { error: delError } = await auth.supabase
    .from("employee_documents")
    .delete()
    .eq("id", row.id);
  if (delError) return jsonError(delError.message, 500);

  if (row.storage_path) {
    await removeStorageIfUnreferenced(auth, row.storage_path as string);
  }
  return jsonOk({ data: { id: row.id } });
}
