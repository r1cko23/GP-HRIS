"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PayrollAuditClientWorkspace } from "@/components/payroll-audit/PayrollAuditClientWorkspace";
import { AddPayrollAuditClientDialog } from "@/components/payroll-audit/AddPayrollAuditClientDialog";
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
import { isPayrollSummaryFileName } from "@/lib/payroll-summary/detect-payroll-summary";
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
  metrics: PayrollSummaryMetrics | null;
  previous: PayrollSummaryMetrics | null;
  diff: PayrollSummaryDiff | null;
  anomalies: AuditUploadAnomalies | null;
  registeredCount: number;
  pdfExtraction: {
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

function ClientEmptyState({ onAddClient }: { onAddClient: () => void }) {
  return (
    <Card className="stats-card-surface border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-emerald-50 mb-4">
          <Icon name="Buildings" size={IconSizes.xl} className="text-emerald-600" />
        </div>
        <BodySmall className="font-medium text-foreground mb-1">
          Select or add a client to begin
        </BodySmall>
        <Caption className="text-muted-foreground max-w-md mb-4">
          Choose a client from the header, or add a new one, then upload payroll
          register PDFs. Employee plantilla is extracted automatically and insights
          unlock after two cutoffs.
        </Caption>
        <Button variant="outline" size="sm" onClick={onAddClient}>
          <Icon name="Plus" size={IconSizes.sm} className="mr-1.5" />
          Add client
        </Button>
      </CardContent>
    </Card>
  );
}

export default function PayrollAuditPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const canAccess = isAdmin;

  const [companies, setCompanies] = useState<AuditCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [addClientOpen, setAddClientOpen] = useState(false);

  const [uploads, setUploads] = useState<PayrollSummaryUploadRecord[]>([]);
  const [trend, setTrend] = useState<PayrollSummaryUploadRecord[]>([]);
  const [clientEmployees, setClientEmployees] = useState<PayrollAuditClientEmployee[]>([]);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

  const handleClientCreated = useCallback((company: AuditCompany) => {
    setCompanies((prev) =>
      [...prev.filter((c) => c.id !== company.id), company].sort((a, b) =>
        a.name.localeCompare(b.name)
      )
    );
    setSelectedCompanyId(company.id);
  }, []);

  const loadCompanies = useCallback(async () => {
    const res = await fetch("/api/payroll/summary-audit/companies");
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to load clients");
    }
    const json = await res.json();
    setCompanies(json.companies ?? []);
  }, []);

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
      return;
    }
    if (!roleLoading && canAccess) {
      loadCompanies().catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load clients")
      );
    }
  }, [roleLoading, canAccess, router, loadCompanies]);

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

  async function handleRegisterUpload(file: File) {
    if (!selectedCompanyId) {
      toast.error("Select a client first");
      return;
    }

    if (!isPayrollSummaryFileName(file.name)) {
      toast.error(
        'Upload a Payroll Summary PDF (filename must start with "Payroll Summary" or "PAYROLL SUMMARY")'
      );
      return;
    }

    setUploading(true);
    try {
      const file_base64 = await fileToBase64(file);
      const res = await fetch("/api/payroll/summary-audit/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_base64,
          company_id: selectedCompanyId,
          document_type: "payroll_register",
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }

      const result = (await res.json()) as UploadResponse;
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
        toast.success(
          `Register uploaded — ${result.registeredCount} employees in plantilla${parseNote}`
        );
      }

      await loadClientData(selectedCompanyId);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
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
              <div className="col-span-2 sm:col-span-1 sm:min-w-[220px]">
                <Label className="mb-1 block text-xs">Client</Label>
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
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

        {!selectedCompanyId ? (
          <ClientEmptyState onAddClient={() => setAddClientOpen(true)} />
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
    </DashboardLayout>
  );
}
