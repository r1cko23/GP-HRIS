"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PayrollAuditInsightsPanel } from "@/components/payroll-audit/PayrollAuditInsightsPanel";
import { PayrollAuditKpiStrip } from "@/components/payroll-audit/PayrollAuditKpiStrip";
import { PayrollAuditUploadHistory } from "@/components/payroll-audit/PayrollAuditUploadHistory";
import { PayrollEmployeeAnomaliesPanel } from "@/components/payroll-audit/PayrollEmployeeAnomaliesPanel";
import { CardSection } from "@/components/ui/card-section";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { HStack, VStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { formatCurrency } from "@/utils/format";
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

function ClientEmptyState() {
  return (
    <Card className="stats-card-surface border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-4 rounded-full bg-emerald-50 mb-4">
          <Icon name="Buildings" size={IconSizes.xl} className="text-emerald-600" />
        </div>
        <BodySmall className="font-medium text-foreground mb-1">
          Select a client to begin
        </BodySmall>
        <Caption className="text-muted-foreground max-w-md">
          Choose a client from the header, then upload payroll register PDFs. Employee
          plantilla is extracted automatically and insights unlock after two cutoffs.
        </Caption>
      </CardContent>
    </Card>
  );
}

export default function PayrollAuditPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { canRead, loading: permLoading } = usePermissions();
  const canAccess = isAdmin || canRead("reports");

  const registerInputRef = useRef<HTMLInputElement>(null);

  const [companies, setCompanies] = useState<AuditCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const [uploads, setUploads] = useState<PayrollSummaryUploadRecord[]>([]);
  const [trend, setTrend] = useState<PayrollSummaryUploadRecord[]>([]);
  const [clientEmployees, setClientEmployees] = useState<PayrollAuditClientEmployee[]>([]);
  const [lastResult, setLastResult] = useState<UploadResponse | null>(null);

  const selectedCompany = companies.find((c) => c.id === selectedCompanyId);

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
    if (!roleLoading && !permLoading && !canAccess) {
      router.replace("/dashboard");
      return;
    }
    if (!roleLoading && !permLoading && canAccess) {
      loadCompanies().catch((e) =>
        toast.error(e instanceof Error ? e.message : "Failed to load clients")
      );
    }
  }, [roleLoading, permLoading, canAccess, router, loadCompanies]);

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
        toast.success(
          `Register uploaded — ${result.registeredCount} employees in plantilla`
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

  if (roleLoading || permLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center max-w-[1400px] mx-auto">
          <BodySmall>Loading…</BodySmall>
        </div>
      </DashboardLayout>
    );
  }

  const showCrossPeriodAnomalies =
    lastResult?.anomalies?.vsLastRegister.hasBaseline &&
    lastResult.anomalies.vsLastRegister.baselinePeriodStart !==
      lastResult.metrics?.periodStart;

  const hasAnomalies =
    lastResult?.anomalies &&
    (lastResult.anomalies.samePeriod.added.length > 0 ||
      lastResult.anomalies.samePeriod.removed.length > 0 ||
      lastResult.anomalies.samePeriod.changed.length > 0 ||
      (showCrossPeriodAnomalies &&
        (lastResult.anomalies.vsLastRegister.added.length > 0 ||
          lastResult.anomalies.vsLastRegister.removed.length > 0 ||
          lastResult.anomalies.vsLastRegister.changed.length > 0)));

  return (
    <DashboardLayout>
      <VStack gap="8" className="w-full max-w-[1400px] mx-auto px-4 py-6">
        <DashboardPageHeader
          title="Payroll audit"
          description="Upload payroll register PDFs per client, track plantilla changes, and analyze period-over-period drivers."
          actions={
            <div className="w-full sm:w-auto min-w-[220px]">
              <Label className="text-xs mb-1 block text-right sm:text-left">
                Client
              </Label>
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                <SelectTrigger className="h-9">
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
          }
        />

        {!selectedCompanyId ? (
          <ClientEmptyState />
        ) : (
          <>
            <CardSection
              title="Upload register"
              description="Employee plantilla is built from each register. Re-uploads for the same cutoff flag added or removed employees."
            >
              <HStack gap="3" className="flex-wrap items-center">
                <input
                  ref={registerInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  disabled={uploading}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleRegisterUpload(file);
                    e.target.value = "";
                  }}
                  className="flex h-9 flex-1 min-w-[200px] max-w-lg rounded-md border border-input bg-background px-3 py-1 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => registerInputRef.current?.click()}
                  className="hidden"
                >
                  Browse
                </Button>
                {uploading && (
                  <HStack gap="2" align="center">
                    <Icon
                      name="Hourglass"
                      size={IconSizes.sm}
                      className="animate-spin text-muted-foreground"
                    />
                    <Caption>Processing register…</Caption>
                  </HStack>
                )}
              </HStack>
            </CardSection>

            <PayrollAuditKpiStrip trend={trend} loading={loading} />

            <PayrollAuditInsightsPanel
              trend={trend}
              clientName={selectedCompany?.name}
            />

            {hasAnomalies && lastResult?.anomalies && (
              <CardSection
                title="Employee anomalies"
                description="From your latest upload — employees added, removed, or with payment changes."
                className="border-amber-200/60"
              >
                <PayrollEmployeeAnomaliesPanel
                  title="vs previous upload (same cutoff)"
                  anomalies={lastResult.anomalies.samePeriod}
                />
                {showCrossPeriodAnomalies && (
                  <div className="pt-4 border-t mt-4">
                    <PayrollEmployeeAnomaliesPanel
                      title="vs last register (previous cutoff)"
                      anomalies={lastResult.anomalies.vsLastRegister}
                    />
                  </div>
                )}
              </CardSection>
            )}

            {clientEmployees.length > 0 && (
              <CardSection
                title={`Client plantilla — ${selectedCompany?.name ?? ""}`}
                description={`${clientEmployees.length} employees from the latest register upload.`}
              >
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded-lg border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead className="text-right">Hours</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Net</TableHead>
                        <TableHead className="text-right">SIL Cutoff</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientEmployees.map((emp) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-medium text-sm">
                            {emp.displayName}
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.hoursWorked?.toFixed(2) ?? "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.grossAmount != null
                              ? formatCurrency(emp.grossAmount)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.netAmount != null
                              ? formatCurrency(emp.netAmount)
                              : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            {emp.silCutoff != null
                              ? formatCurrency(emp.silCutoff)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardSection>
            )}

            <PayrollAuditUploadHistory
              uploads={uploads}
              loading={loading}
              deletingId={deletingId}
              clearingAll={clearingAll}
              onRefresh={() => loadClientData(selectedCompanyId)}
              onClearAll={() => setClearAllOpen(true)}
              onDelete={handleDeleteUpload}
            />
          </>
        )}
      </VStack>

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
