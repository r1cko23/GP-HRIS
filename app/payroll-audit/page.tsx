"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PayrollAuditClientWorkspace } from "@/components/payroll-audit/PayrollAuditClientWorkspace";
import { AddPayrollAuditClientDialog } from "@/components/payroll-audit/AddPayrollAuditClientDialog";
import { BulkImportPayrollDialog } from "@/components/payroll-audit/BulkImportPayrollDialog";
import { dbHeaderActions, dbHeaderButton, dbPageWrapper } from "@/lib/dashboard-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { bustCache } from "@/lib/cache-client";
import { createClient } from "@/lib/supabase/client";
import { isPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
import { cn } from "@/lib/utils";
import type {
  AuditCompany,
  AuditUploadAnomalies,
  PayrollAuditClientEmployee,
  PayrollSummaryDiff,
  PayrollSummaryMetrics,
  PayrollSummaryUploadRecord,
} from "@/lib/payroll-summary/types";

interface UploadResponse {
  upload: PayrollSummaryUploadRecord;
  upload_id?: string;
  status?: "processing" | "ready" | "failed";
  message?: string;
  company?: AuditCompany;
  client_created?: boolean;
  client_source?: "pdf" | "path" | "filename" | "provided";
  metrics?: PayrollSummaryMetrics | null;
  previous?: PayrollSummaryMetrics | null;
  diff?: PayrollSummaryDiff | null;
  anomalies?: AuditUploadAnomalies | null;
  registeredCount?: number;
  pdfExtraction?: {
    source: "pdf-parse" | "ocr-space";
    nativeScore: number;
    ocrScore: number | null;
    ocrConfigured: boolean;
  } | null;
}

interface ListResponse {
  uploads: PayrollSummaryUploadRecord[];
  trend: PayrollSummaryUploadRecord[];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRegisterProcessing(
  uploadId: string
): Promise<UploadResponse> {
  const maxAttempts = 90;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch("/api/payroll/summary-audit/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ upload_id: uploadId }),
    });

    if (res.status === 202) {
      await sleep(1500);
      continue;
    }

    const json = (await res.json()) as UploadResponse & { error?: string };

    if (!res.ok) {
      throw new Error(json.error || "Processing failed");
    }

    return json;
  }

  throw new Error(
    "Processing is taking longer than expected. Refresh the page in a moment."
  );
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

function ClientEmptyState({
  uploading,
  onUpload,
  onBulkImport,
}: {
  uploading: boolean;
  onUpload: (file: File) => void;
  onBulkImport: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="stats-card-surface border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-emerald-50 mb-4">
          <Icon name="FilePdf" size={IconSizes.xl} className="text-emerald-600" />
        </div>
        <BodySmall className="font-medium text-foreground mb-1">
          Upload a payroll summary to start
        </BodySmall>
        <Caption className="text-muted-foreground max-w-md mb-4">
          Drop a Payroll Summary PDF here. If the client name on the PDF already
          exists, the register lands under that client; otherwise a new client is
          created automatically.
        </Caption>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          disabled={uploading}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <HStack className="gap-2">
          <Button
            size="sm"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            <Icon name="FileArrowDown" size={IconSizes.sm} className="mr-1.5" />
            {uploading ? "Processing…" : "Upload payroll summary"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={uploading}
            onClick={onBulkImport}
          >
            Bulk import
          </Button>
        </HStack>
      </CardContent>
    </Card>
  );
}

export default function PayrollAuditPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useCurrentUser();
  const canAccess = isAdmin;

  const [companies, setCompanies] = useState<AuditCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [removeClientOpen, setRemoveClientOpen] = useState(false);
  const [removingClient, setRemovingClient] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const [uploads, setUploads] = useState<PayrollSummaryUploadRecord[]>([]);
  const [trend, setTrend] = useState<PayrollSummaryUploadRecord[]>([]);
  const [clientEmployees, setClientEmployees] = useState<PayrollAuditClientEmployee[]>([]);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  const {
    data: companiesData,
    error: companiesError,
    refresh: refreshCompanies,
  } = useSessionQuery<{ companies: AuditCompany[] }>(
    user ? `payroll-audit:companies:${user.id}` : null,
    "/api/payroll/summary-audit/companies",
    { enabled: !!user && !roleLoading && canAccess }
  );

  useEffect(() => {
    if (companiesData?.companies) {
      setCompanies(companiesData.companies);
    }
  }, [companiesData]);

  useEffect(() => {
    if (companiesError) {
      toast.error(companiesError);
    }
  }, [companiesError]);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const handleClientCreated = useCallback(
    async (company: AuditCompany) => {
      setCompanies((prev) =>
        [...prev.filter((c) => c.id !== company.id), company].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setSelectedCompanyId(company.id);
      await bustCache();
      await refreshCompanies({ force: true });
    },
    [refreshCompanies]
  );

  const loadClientData = useCallback(async (companyId: string) => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [uploadRes, empRes] = await Promise.all([
        fetch(
          `/api/payroll/summary-audit/upload?company_id=${companyId}&document_type=payroll_register&limit=100`
        ),
        fetch(`/api/payroll/summary-audit/client-employees?company_id=${companyId}`),
      ]);

      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || "Failed to load uploads");
      }
      if (!empRes.ok) {
        const err = await empRes.json();
        throw new Error(err.error || "Failed to load employee roster");
      }

      const uploadJson = (await uploadRes.json()) as ListResponse;
      const empJson = await empRes.json();

      setUploads(uploadJson.uploads);
      setTrend(uploadJson.trend);
      setClientEmployees(empJson.employees ?? []);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load client data"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && !canAccess) {
      router.replace("/dashboard");
    }
  }, [roleLoading, canAccess, router]);

  useEffect(() => {
    if (selectedCompanyId) {
      loadClientData(selectedCompanyId);
    } else {
      setUploads([]);
      setTrend([]);
      setClientEmployees([]);
      setLastResult(null);
      setLoading(false);
    }
  }, [selectedCompanyId, loadClientData]);

  useEffect(() => {
    if (!selectedCompanyId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`payroll-audit-uploads-${selectedCompanyId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payroll_summary_uploads",
          filter: `company_id=eq.${selectedCompanyId}`,
        },
        () => {
          loadClientData(selectedCompanyId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedCompanyId, loadClientData]);

  async function handleRegisterUpload(file: File) {
    if (!isPayrollSummaryFileName(file.name)) {
      toast.error(
        'Upload a Payroll Summary PDF (filename must start with "Payroll Summary", "PAYROLL SUMMARY", or use a cutoff name like 05-16-26.pdf)'
      );
      return;
    }

    setUploading(true);
    let companyIdToRefresh = selectedCompanyId;
    try {
      const file_base64 = await fileToBase64(file);
      const relative_path =
        (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
        null;

      const res = await fetch("/api/payroll/summary-audit/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_base64,
          relative_path,
          document_type: "payroll_register",
        }),
      });

      const queued = (await res.json()) as UploadResponse & { error?: string };

      if (!res.ok) {
        throw new Error(queued.error || "Upload failed");
      }

      const company = queued.company;
      if (company) {
        companyIdToRefresh = company.id;
        setCompanies((prev) =>
          [...prev.filter((c) => c.id !== company.id), company].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setSelectedCompanyId(company.id);
        if (queued.client_created) {
          await bustCache();
          await refreshCompanies({ force: true });
        }
        await loadClientData(company.id);

        toast.message(
          queued.client_created
            ? `Created client "${company.name}" — parsing register…`
            : `Uploading under "${company.name}" — parsing register…`
        );
      } else {
        toast.message("Upload received — parsing and validating centavos…");
        if (selectedCompanyId) await loadClientData(selectedCompanyId);
      }

      const uploadId = String(queued.upload_id ?? queued.upload.id);
      const result = await waitForRegisterProcessing(uploadId);
      setLastResult(result);

      const addedCount = result.anomalies?.samePeriod.added.length ?? 0;
      const addedCross = result.anomalies?.vsLastRegister.added.length ?? 0;

      if (addedCount > 0) {
        toast.warning(
          `${addedCount} new employee${addedCount !== 1 ? "s" : ""} detected vs prior upload for this cutoff`
        );
      } else if (addedCross > 0) {
        toast.warning(
          `${addedCross} new employee${addedCross !== 1 ? "s" : ""} vs last register`
        );
      } else {
        const extraction = result.pdfExtraction;
        let parseNote = "";
        if (extraction) {
          if (!extraction.ocrConfigured) {
            parseNote = " (embedded PDF text only — OCR.space key not loaded)";
          } else if (extraction.source === "ocr-space") {
            parseNote = " (parsed via OCR.space)";
          } else if (extraction.ocrScore != null) {
            parseNote = " (embedded PDF text — OCR ran but scored lower)";
          } else {
            parseNote = " (embedded PDF text — OCR skipped or failed)";
          }
        }
        const clientNote = company ? ` · ${company.name}` : "";
        toast.success(
          `Register ready — ${result.registeredCount ?? 0} employees in plantilla${clientNote}${parseNote}`
        );
      }

      if (companyIdToRefresh) await loadClientData(companyIdToRefresh);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
      if (companyIdToRefresh) {
        await loadClientData(companyIdToRefresh).catch(() => undefined);
      }
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteUpload(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/payroll/summary-audit/upload?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete upload");
      }
      toast.success("Upload removed");
      if (lastResult?.upload.id === id) setLastResult(null);
      await loadClientData(selectedCompanyId);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete upload");
    } finally {
      setDeletingId(null);
    }
  }

  function handleBackToUpload() {
    setSelectedCompanyId("");
    setUploads([]);
    setTrend([]);
    setClientEmployees([]);
    setLastResult(null);
    setLoading(false);
  }

  async function handleRemoveClient() {
    if (!selectedCompanyId) return;
    const name = selectedCompany?.name ?? "this client";
    setRemovingClient(true);
    try {
      const res = await fetch(
        `/api/payroll/summary-audit/companies?id=${selectedCompanyId}`,
        { method: "DELETE" }
      );
      const json = (await res.json()) as {
        error?: string;
        deletedUploads?: number;
      };
      if (!res.ok) {
        throw new Error(json.error || "Failed to remove client");
      }

      setCompanies((prev) => prev.filter((c) => c.id !== selectedCompanyId));
      handleBackToUpload();
      setRemoveClientOpen(false);
      await bustCache();
      await refreshCompanies({ force: true });
      toast.success(
        `Removed ${name}${
          json.deletedUploads
            ? ` and ${json.deletedUploads} upload${json.deletedUploads === 1 ? "" : "s"}`
            : ""
        }`
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to remove client"
      );
    } finally {
      setRemovingClient(false);
    }
  }

  async function handleClearAllHistory() {
    if (!selectedCompanyId) return;
    setClearingAll(true);
    try {
      const res = await fetch(
        `/api/payroll/summary-audit/upload?company_id=${selectedCompanyId}&clear_all=true`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clear history");
      }
      const json = await res.json();
      toast.success(
        `Cleared ${json.deletedCount ?? 0} upload${json.deletedCount === 1 ? "" : "s"} and employee roster`
      );
      setLastResult(null);
      setClearAllOpen(false);
      await loadClientData(selectedCompanyId);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to clear history");
    } finally {
      setClearingAll(false);
    }
  }

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center max-w-[1400px] mx-auto">
          <BodySmall>Loading…</BodySmall>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout wide>
      <div className={dbPageWrapper + " w-full"}>
        <DashboardPageHeader
          title="Payroll audit"
          description={selectedCompany?.name ?? undefined}
          actions={
            <div className={dbHeaderActions}>
              {selectedCompanyId ? (
                <Button
                  type="button"
                  variant="outline"
                  className={dbHeaderButton}
                  onClick={handleBackToUpload}
                >
                  <Icon name="ArrowLeft" size={IconSizes.sm} className="mr-1" />
                  Back
                </Button>
              ) : null}
              <div className="col-span-2 sm:col-span-1 sm:min-w-[220px]">
                <Label className="mb-1 block text-xs">Client</Label>
                <Select
                  value={selectedCompanyId || undefined}
                  onValueChange={setSelectedCompanyId}
                >
                  <SelectTrigger className="h-10 w-full">
                    <SelectValue placeholder="Choose a client…" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCompanyId ? (
                <Button
                  type="button"
                  variant="outline"
                  className={cn(dbHeaderButton, "text-destructive hover:text-destructive")}
                  onClick={() => setRemoveClientOpen(true)}
                >
                  <Icon name="TrashSimple" size={IconSizes.sm} className="mr-1" />
                  Remove client
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className={dbHeaderButton}
                onClick={() => setBulkImportOpen(true)}
              >
                <Icon name="FileArrowDown" size={IconSizes.sm} className="mr-1" />
                Bulk import
              </Button>
              <Button
                type="button"
                variant="outline"
                className={dbHeaderButton}
                onClick={() => setAddClientOpen(true)}
              >
                <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
                Add client
              </Button>
            </div>
          }
        />

        <AddPayrollAuditClientDialog
          open={addClientOpen}
          onOpenChange={setAddClientOpen}
          onCreated={handleClientCreated}
        />

        <BulkImportPayrollDialog
          open={bulkImportOpen}
          onOpenChange={setBulkImportOpen}
          onComplete={async (hintCompanyId) => {
            try {
              await bustCache();
              await refreshCompanies({ force: true });
              if (hintCompanyId) {
                setSelectedCompanyId(hintCompanyId);
                await loadClientData(hintCompanyId);
              }
            } catch (error: unknown) {
              toast.error(
                error instanceof Error ? error.message : "Failed to refresh clients"
              );
            }
          }}
        />

        {!selectedCompanyId ? (
          <ClientEmptyState
            uploading={uploading}
            onUpload={handleRegisterUpload}
            onBulkImport={() => setBulkImportOpen(true)}
          />
        ) : (
          <PayrollAuditClientWorkspace
            clientName={selectedCompany?.name ?? ""}
            trend={trend}
            uploads={uploads}
            clientEmployees={clientEmployees}
            lastResult={lastResult}
            loading={loading}
            uploading={uploading}
            deletingId={deletingId}
            clearingAll={clearingAll}
            onUpload={handleRegisterUpload}
            onBack={handleBackToUpload}
            onRefresh={() => loadClientData(selectedCompanyId)}
            onClearAll={() => setClearAllOpen(true)}
            onDelete={handleDeleteUpload}
          />
        )}
      </div>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear upload history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all payroll register uploads and the employee
              plantilla for {selectedCompany?.name ?? "this client"}. You can re-upload
              registers to start fresh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearingAll}
              onClick={(e) => {
                e.preventDefault();
                handleClearAllHistory();
              }}
            >
              {clearingAll ? "Clearing…" : "Clear all"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={removeClientOpen} onOpenChange={setRemoveClientOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove client?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes {selectedCompany?.name ?? "this client"} from Payroll
              audit, deletes all of its uploads and roster, and returns you to
              the upload screen. Re-uploading a summary with the same company
              name can recreate the client.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removingClient}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removingClient}
              onClick={(e) => {
                e.preventDefault();
                void handleRemoveClient();
              }}
            >
              {removingClient ? "Removing…" : "Remove client"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
