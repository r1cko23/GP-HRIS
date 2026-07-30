"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import {
  IncentiveAuditUploadHistory,
  IncentiveAuditWorkspace,
} from "@/components/incentive-audit/IncentiveAuditTables";
import { dbHeaderActions, dbHeaderButton, dbPageWrapper } from "@/lib/dashboard-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { formatCurrency } from "@/utils/format";
import type {
  AuditedIncentiveRow,
  IncentiveAuditSummary,
  IncentiveAuditUploadRecord,
} from "@/lib/incentive-audit";

interface UploadResponse {
  upload: IncentiveAuditUploadRecord;
  summary: IncentiveAuditSummary;
  rows: AuditedIncentiveRow[];
  flagged: AuditedIncentiveRow[];
  paidHistoryCount: number;
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

function SummaryCards({ summary }: { summary: IncentiveAuditSummary | null }) {
  if (!summary) return null;
  const items = [
    { label: "Candidates", value: String(summary.totalCandidates) },
    { label: "Duplicates in file", value: String(summary.duplicateCount) },
    { label: "Already paid", value: String(summary.alreadyReceivedCount) },
    { label: "Fuzzy matches", value: String(summary.fuzzyMatchCount) },
    { label: "Approved", value: String(summary.approvedCount) },
    {
      label: "Incentive total",
      value: formatCurrency(summary.totalIncentiveAmount),
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => (
        <Card key={item.label} className="stats-card-surface">
          <CardContent className="p-4">
            <Caption className="text-muted-foreground">{item.label}</Caption>
            <BodySmall className="mt-1 font-semibold text-foreground">
              {item.value}
            </BodySmall>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function IncentiveAuditPage() {
  const router = useRouter();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const inputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploads, setUploads] = useState<IncentiveAuditUploadRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditedIncentiveRow[]>([]);
  const [summary, setSummary] = useState<IncentiveAuditSummary | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearAllOpen, setClearAllOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);

  const loadUploads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/incentive-audit/upload");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load uploads");
      }
      const json = await res.json();
      setUploads(json.uploads ?? []);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load uploads"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUploadDetail = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/incentive-audit/upload?id=${id}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load upload");
      }
      const json = await res.json();
      setSelectedId(id);
      setRows(json.rows ?? []);
      setSummary(
        (json.upload?.auditSummary as IncentiveAuditSummary) ?? null
      );
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load upload"
      );
    }
  }, []);

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.replace("/dashboard");
      return;
    }
    if (!roleLoading && isAdmin) {
      loadUploads();
    }
  }, [roleLoading, isAdmin, router, loadUploads]);

  async function handleUpload(file: File) {
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".xlsx") && !lower.endsWith(".xls")) {
      toast.error("Upload an Excel file (.xlsx) in INCENTIVES VERIFICATION format");
      return;
    }

    setUploading(true);
    try {
      const file_base64 = await fileToBase64(file);
      const res = await fetch("/api/incentive-audit/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_name: file.name,
          file_base64,
        }),
      });
      const json = (await res.json()) as UploadResponse & { error?: string };
      if (!res.ok) {
        throw new Error(json.error || "Upload failed");
      }

      setSelectedId(json.upload.id);
      setRows(json.rows);
      setSummary(json.summary);
      await loadUploads();

      if (json.summary.duplicateCount > 0 || json.summary.alreadyReceivedCount > 0) {
        toast.warning(
          `Audited ${json.summary.totalCandidates} candidates — ${json.summary.duplicateCount} duplicates, ${json.summary.alreadyReceivedCount} already paid`
        );
      } else {
        toast.success(
          `Audited ${json.summary.totalCandidates} candidates — no duplicates or prior payouts found`
        );
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/incentive-audit/upload?id=${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete");
      }
      toast.success("Upload removed");
      if (selectedId === id) {
        setSelectedId(null);
        setRows([]);
        setSummary(null);
      }
      await loadUploads();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleClearAll() {
    setClearingAll(true);
    try {
      const res = await fetch("/api/incentive-audit/upload?clear_all=true", {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to clear history");
      }
      const json = await res.json();
      toast.success(
        `Cleared ${json.deletedCount ?? 0} upload${json.deletedCount === 1 ? "" : "s"}`
      );
      setClearAllOpen(false);
      setSelectedId(null);
      setRows([]);
      setSummary(null);
      await loadUploads();
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to clear history"
      );
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
          title="Incentive audit"
          description="Upload INCENTIVES VERIFICATION Excel to catch duplicates and prior payouts"
          actions={
            <div className={dbHeaderActions}>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                className={dbHeaderButton}
                disabled={uploading}
                onClick={() => inputRef.current?.click()}
              >
                <Icon name="FileArrowDown" size={IconSizes.sm} className="mr-1" />
                {uploading ? "Auditing…" : "Upload Excel"}
              </Button>
            </div>
          }
        />

        {uploading && (
          <HStack gap="2" align="center" className="mb-4">
            <Icon
              name="Hourglass"
              size={IconSizes.sm}
              className="animate-spin text-muted-foreground"
            />
            <Caption>Parsing Excel and matching names…</Caption>
          </HStack>
        )}

        <SummaryCards summary={summary} />

        {rows.length > 0 && (
          <div className="mt-4">
            <IncentiveAuditWorkspace rows={rows} uploads={uploads} />
          </div>
        )}

        <div className="mt-4">
          <IncentiveAuditUploadHistory
            uploads={uploads}
            loading={loading}
            selectedId={selectedId}
            deletingId={deletingId}
            clearingAll={clearingAll}
            onSelect={loadUploadDetail}
            onRefresh={loadUploads}
            onClearAll={() => setClearAllOpen(true)}
            onDelete={handleDelete}
          />
        </div>
      </div>

      <AlertDialog open={clearAllOpen} onOpenChange={setClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear incentive audit history?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes all uploaded verification files and their
              candidate rows. Prior “already paid” matching will reset.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearingAll}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={clearingAll}
              onClick={(e) => {
                e.preventDefault();
                handleClearAll();
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
