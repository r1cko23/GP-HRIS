"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { isPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
import type { AuditCompany } from "@/lib/payroll-summary/types";

interface BulkImportResultRow {
  file_name: string;
  relative_path: string | null;
  status: "queued" | "failed";
  client: AuditCompany | null;
  client_created: boolean;
  client_source: "pdf" | "path" | "filename" | null;
  upload_id: string | null;
  error: string | null;
}

interface BulkImportResponse {
  results?: BulkImportResultRow[];
  summary?: {
    total: number;
    queued: number;
    failed: number;
    clients_created: number;
  };
  message?: string;
  error?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface BulkImportPayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (hintCompanyId?: string) => void;
}

export function BulkImportPayrollDialog({
  open,
  onOpenChange,
  onComplete,
}: BulkImportPayrollDialogProps) {
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<BulkImportResultRow[] | null>(null);

  async function runImport(fileList: FileList | null) {
    if (!fileList?.length) return;

    const pdfs = Array.from(fileList).filter((f) => {
      const name = f.name.toLowerCase();
      return name.endsWith(".pdf") && isPayrollSummaryFileName(f.name);
    });

    if (pdfs.length === 0) {
      toast.error(
        'No Payroll Summary PDFs found. Filenames must start with "Payroll Summary" / "PAYROLL SUMMARY".'
      );
      return;
    }

    if (pdfs.length > 40) {
      toast.error("Select at most 40 Payroll Summary PDFs per import");
      return;
    }

    setImporting(true);
    setResults(null);

    try {
      const files = await Promise.all(
        pdfs.map(async (file) => ({
          file_name: file.name,
          file_base64: await fileToBase64(file),
          relative_path:
            (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
            null,
        }))
      );

      const res = await fetch("/api/payroll/summary-audit/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files }),
      });

      const json = (await res.json()) as BulkImportResponse;
      if (!res.ok && !json.results) {
        throw new Error(json.error || "Bulk import failed");
      }

      setResults(json.results ?? []);
      const summary = json.summary;
      if (summary) {
        toast.message(
          `${summary.queued} queued, ${summary.failed} failed, ${summary.clients_created} client${summary.clients_created === 1 ? "" : "s"} created`
        );
      }

      const firstQueued = json.results?.find((r) => r.status === "queued");
      onComplete(firstQueued?.client?.id);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Bulk import failed");
    } finally {
      setImporting(false);
      if (filesRef.current) filesRef.current.value = "";
      if (folderRef.current) folderRef.current.value = "";
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!importing) {
          onOpenChange(next);
          if (!next) setResults(null);
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import payroll summaries</DialogTitle>
          <DialogDescription>
            Drop many Payroll Summary PDFs (or a client folder tree). Each file
            is routed to a client from the PDF company name, parent folder, or
            filename — creating the client when it does not exist.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <input
            ref={filesRef}
            type="file"
            accept=".pdf,application/pdf"
            multiple
            disabled={importing}
            className="sr-only"
            onChange={(e) => void runImport(e.target.files)}
          />
          <input
            ref={folderRef}
            type="file"
            {...({
              webkitdirectory: "",
              directory: "",
            } as InputHTMLAttributes<HTMLInputElement>)}
            multiple
            disabled={importing}
            className="sr-only"
            onChange={(e) => void runImport(e.target.files)}
          />

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              disabled={importing}
              className="min-h-11 flex-1"
              onClick={() => filesRef.current?.click()}
            >
              <Icon name="FilePdf" size={IconSizes.sm} className="mr-2" />
              {importing ? "Importing…" : "Choose PDFs"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={importing}
              className="min-h-11 flex-1"
              onClick={() => folderRef.current?.click()}
            >
              <Icon name="FileText" size={IconSizes.sm} className="mr-2" />
              Choose folder
            </Button>
          </div>

          <Caption className="text-muted-foreground">
            Branches (e.g. NIKKEI sites): prefer folder upload so{" "}
            <code className="text-xs">…/TERRAZA EDSA/PAYROLL SUMMARY_NIKKEI.pdf</code>{" "}
            becomes client <em>TERRAZA EDSA</em>. ATM/Cash PDFs are skipped.
          </Caption>

          {results && results.length > 0 && (
            <ul className="max-h-56 space-y-2 overflow-y-auto rounded-md border p-3">
              {results.map((row, i) => (
                <li key={`${row.file_name}-${i}`} className="border-b pb-2 last:border-0 last:pb-0">
                  <BodySmall className="font-medium">{row.file_name}</BodySmall>
                  {row.status === "queued" && row.client ? (
                    <Caption className="text-muted-foreground">
                      → {row.client.name}
                      {row.client_created ? " (new)" : ""}
                      {row.client_source ? ` via ${row.client_source}` : ""}
                    </Caption>
                  ) : (
                    <Caption className="text-destructive">
                      {row.error ?? "Failed"}
                    </Caption>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
