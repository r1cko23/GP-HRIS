"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { directoryJson } from "@/lib/directory/browser";
import {
  COMBINED_SCAN_TICK_TYPES,
  EMPLOYEE_DOCUMENT_LABELS,
  EMPLOYEE_DOCUMENT_TYPES,
  computeDocumentInspection,
  type EmployeeDocumentType,
} from "@/lib/directory/documents";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type EmployeeDocumentRow = {
  id: string;
  doc_type: EmployeeDocumentType;
  original_filename: string | null;
  mime_type: string;
  file_size: number;
  id_number_on_doc: string | null;
  expires_on: string | null;
  notes: string | null;
  uploaded_at: string;
  view_url: string | null;
};

type Props = {
  organizationId: string;
  employeeId: string;
  compact?: boolean;
};

export function DirectoryDocumentsPanel({
  organizationId,
  employeeId,
  compact,
}: Props) {
  const [rows, setRows] = useState<EmployeeDocumentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<EmployeeDocumentType>("sss_id");
  const [containedTypes, setContainedTypes] = useState<EmployeeDocumentType[]>(
    []
  );
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const json = await directoryJson<{ data: EmployeeDocumentRow[] }>(
        `/api/directory/employees/${employeeId}/documents`,
        organizationId
      );
      setRows(json.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Documents failed");
    } finally {
      setLoading(false);
    }
  }, [employeeId, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleContained(type: EmployeeDocumentType, checked: boolean) {
    setContainedTypes((prev) => {
      if (checked) {
        return prev.includes(type) ? prev : [...prev, type];
      }
      return prev.filter((t) => t !== type);
    });
  }

  async function upload() {
    if (!file) {
      toast.error("Choose a PDF or image first");
      return;
    }
    if (docType === "other" && containedTypes.length === 0) {
      toast.error("Tick every ID on this scan, or pick a single document type above");
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("doc_type", docType);
      if (docType === "other") {
        body.append("contained_types", JSON.stringify(containedTypes));
      }
      await directoryJson(
        `/api/directory/employees/${employeeId}/documents`,
        organizationId,
        { method: "POST", body }
      );
      setFile(null);
      setContainedTypes([]);
      toast.success(
        docType === "other" && containedTypes.length > 1
          ? "Combined scan uploaded"
          : "Document uploaded"
      );
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function remove(id: string) {
    const ok = window.confirm("Remove this scan from the 201 file?");
    if (!ok) return;
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/documents?document_id=${encodeURIComponent(id)}`,
        organizationId,
        { method: "DELETE" }
      );
      toast.success("Document removed");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Remove failed");
    }
  }

  const inspection = computeDocumentInspection(rows.map((row) => row.doc_type));
  const byType = new Map(rows.map((row) => [row.doc_type, row]));
  const isCombined = docType === "other";
  const uploadLabel = (() => {
    if (uploading) return "Uploading…";
    if (isCombined && containedTypes.length > 0) {
      const replacing = containedTypes.some((type) => byType.has(type));
      return replacing ? "Replace combined scan" : "Upload combined scan";
    }
    return byType.has(docType) ? "Replace scan" : "Upload scan";
  })();

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Statutory scans {inspection.score}/{inspection.total}
        {inspection.missing.length
          ? ` · missing ${inspection.missing.map((type) => EMPLOYEE_DOCUMENT_LABELS[type]).join(", ")}`
          : " · SSS, TIN, PhilHealth, and Pag-IBIG on file"}
        . Scans are sensitive personal information (RA 10173) — PDF, JPEG, PNG,
        or WebP, 10 MB cap.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">Document</Label>
          <select
            id="doc-type"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={docType}
            onChange={(e) => {
              const next = e.target.value as EmployeeDocumentType;
              setDocType(next);
              if (next !== "other") setContainedTypes([]);
            }}
          >
            {EMPLOYEE_DOCUMENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {type === "other"
                  ? "Other — multiple IDs in one file"
                  : EMPLOYEE_DOCUMENT_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-file">File (PDF, JPEG, PNG, WebP · 10 MB)</Label>
          <Input
            id="doc-file"
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </div>

      {isCombined ? (
        <fieldset className="space-y-2 rounded-md border border-border p-3">
          <legend className="px-1 text-sm font-medium text-foreground">
            What’s on this scan?
          </legend>
          <p className="text-xs text-muted-foreground">
            Tick every ID or clearance that appears in the file. Each tick is
            recorded on the 201.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {COMBINED_SCAN_TICK_TYPES.map((type) => {
              const checked = containedTypes.includes(type);
              const id = `contained-${type}`;
              return (
                <label
                  key={type}
                  htmlFor={id}
                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-1 text-sm"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={(value) =>
                      toggleContained(type, value === true)
                    }
                  />
                  <span>{EMPLOYEE_DOCUMENT_LABELS[type]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Button type="button" onClick={() => void upload()} disabled={uploading}>
        {uploadLabel}
      </Button>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading scans…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No scans yet. HR can backfill existing IDs here.
        </p>
      ) : (
        <ul className={cn("space-y-2", compact && "space-y-1.5")}>
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {EMPLOYEE_DOCUMENT_LABELS[row.doc_type]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.original_filename ?? "Scan"}
                  {row.notes ? ` · ${row.notes}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                {row.view_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={row.view_url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void remove(row.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
