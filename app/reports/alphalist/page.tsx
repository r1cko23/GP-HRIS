"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { Caption } from "@/components/ui/typography";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  directoryJson,
  directoryOrgLabel,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { HubSegmentedControl } from "@/components/hubs/HubSegmentedControl";
import {
  dbFilterSelect,
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageWrapper,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";

import {
  downloadBase64Pdf,
  downloadBase64Xlsx,
} from "@/lib/reports/download-base64";
import {
  bootstrapReportClients,
  resolveReportClientId,
  type ReportClientOption,
} from "@/lib/reports/bootstrap-clients";
import { pickFirstClientAlphabetically } from "@/lib/reports/default-client";

const PAGE = 50;

type ClientOption = ReportClientOption;

type AlphalistRow = {
  employee_code: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  tin: string;
  gross_taxable: number;
  nontaxable_13th: number;
  sss_ee: number;
  philhealth_ee: number;
  pagibig_ee: number;
  wtax: number;
  net_amount: number;
  cutoff_count: number;
};

function currentYear() {
  return new Date().getFullYear();
}

export default function AlphalistReportPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            Loading...
          </div>
        </DashboardLayout>
      }
    >
      <AlphalistReportContent />
    </Suspense>
  );
}

function AlphalistReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("bir_reports");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const yearFromUrl = Number(searchParams.get("year") ?? currentYear()) || currentYear();
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [preferOrg, setPreferOrg] = useState<"deployed" | "organic">(
    "deployed"
  );
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<AlphalistRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(qFromUrl);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const writeParams = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (
          value === undefined ||
          value === "" ||
          value === "all" ||
          value === 0
        ) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `/reports/alphalist?${qs}` : "/reports/alphalist");
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open Alphalist.");
      router.push("/reports");
    }
  }, [canOpen, permLoading, router]);

  useEffect(() => {
    if (debouncedSearch === qFromUrl) return;
    writeParams({ q: debouncedSearch.trim() || undefined, offset: 0 });
  }, [debouncedSearch, qFromUrl, writeParams]);

  const bootstrap = useCallback(async () => {
    const boot = await bootstrapReportClients({ preferOrg });
    setOrgs(boot.orgs);
    setOrgId(boot.orgId);
    setClients(boot.clients);
    return { orgId: boot.orgId, clients: boot.clients };
  }, [preferOrg]);

  const loadRows = useCallback(async () => {
    if (!canOpen) return;
    setLoading(true);
    try {
      // Always re-bootstrap so a stale Organic session cannot leave only the house client.
      const boot = await bootstrap();
      const oid = boot.orgId;

      const resolved = resolveReportClientId(
        boot.clients,
        clientFromUrl,
        pickFirstClientAlphabetically
      );
      if (resolved.shouldReplaceUrl) {
        writeParams({
          client_id: resolved.clientId || undefined,
          offset: 0,
        });
        return;
      }

      const params = new URLSearchParams({
        type: "alphalist",
        year: String(yearFromUrl),
        format: "json",
        limit: String(PAGE),
        offset: String(offset),
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      const json = await directoryJson<{
        data: { rows: AlphalistRow[]; count: number };
      }>(`/api/reports/finance-exports?${params}`, oid);
      setRows(json.data?.rows ?? []);
      setCount(json.data?.count ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load alphalist");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [
    bootstrap,
    canOpen,
    clientFromUrl,
    offset,
    qFromUrl,
    writeParams,
    yearFromUrl,
  ]);

  useEffect(() => {
    if (permLoading || !canOpen) return;
    void loadRows();
  }, [canOpen, loadRows, permLoading]);

  async function handleExport(kind: "xlsx" | "pdf") {
    setExporting(true);
    try {
      const boot = orgId ? { orgId } : await bootstrap();
      const oid = boot.orgId;
      const params = new URLSearchParams({
        type: "alphalist",
        year: String(yearFromUrl),
        format: "json",
        export: "1",
        limit: "200",
        offset: "0",
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      const json = await directoryJson<{
        data: {
          filename: string;
          pdf_filename?: string;
          xlsx_base64: string;
          pdf_base64?: string;
        };
      }>(`/api/reports/finance-exports?${params}`, oid);
      if (kind === "pdf") {
        if (!json.data?.pdf_base64) throw new Error("PDF export empty");
        downloadBase64Pdf(
          json.data.pdf_base64,
          json.data.pdf_filename ?? "Alphalist.pdf"
        );
        toast.success("Alphalist PDF downloaded");
      } else {
        if (!json.data?.xlsx_base64) throw new Error("Excel export empty");
        downloadBase64Xlsx(json.data.xlsx_base64, json.data.filename);
        toast.success("Alphalist Excel downloaded");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const years = Array.from({ length: 6 }, (_, i) => currentYear() - i);

  if (permLoading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <PageHeader
          title="Alphalist"
          actions={
            <div className={dbHeaderActions}>
              <Button
                variant="outline"
                className={dbHeaderButton}
                onClick={() => void handleExport("pdf")}
                disabled={exporting || loading || count === 0}
              >
                {exporting ? "Exporting…" : "Download PDF"}
              </Button>
              <Button
                className={dbHeaderButton}
                onClick={() => void handleExport("xlsx")}
                disabled={exporting || loading || count === 0}
              >
                {exporting ? "Exporting…" : "Download Excel"}
              </Button>
            </div>
          }
        />

        {orgs.length > 1 ? (
          <div className="mb-4 space-y-2">
            <HubSegmentedControl
              ariaLabel="Organization"
              value={orgId}
              onChange={(id) => {
                const org = orgs.find((o) => o.id === id);
                if (!org || org.id === orgId) return;
                const nextPrefer = /organic/i.test(org.name)
                  ? "organic"
                  : "deployed";
                writeDirectoryOrgId(org.id);
                setPreferOrg(nextPrefer);
                setOrgId(org.id);
                setClients([]);
                setRows([]);
                writeParams({ client_id: undefined, offset: 0 });
              }}
              options={orgs.map((o) => ({
                id: o.id,
                label: directoryOrgLabel(o.name),
              }))}
            />
            <Caption>
              Remittance reports default to Deployed so site clients appear.
            </Caption>
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[10rem]">
            <Caption className="mb-1 block text-muted-foreground">Year</Caption>
            <Select
              value={String(yearFromUrl)}
              onValueChange={(value) =>
                writeParams({ year: Number(value), offset: 0 })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Client</Caption>
            <Select
              value={clientFromUrl || "all"}
              onValueChange={(value) =>
                writeParams({
                  client_id: value === "all" ? undefined : value,
                  offset: 0,
                })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue placeholder="All clients" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All clients</SelectItem>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Search</Caption>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, code, or TIN"
            />
          </div>
        </div>

        {loading ? (
          <DataTable<AlphalistRow> columns={[]} rows={[]} rowKey={() => ""} loading />
        ) : rows.length === 0 ? (
          <EmptyState
            title={qFromUrl || clientFromUrl ? "No matches" : "Nothing on file yet"}
            detail={qFromUrl || clientFromUrl
              ? "No alphalist rows for this search/filter."
              : "No posted register lines for this year yet."}
          />
        ) : (
          <>
            <DbDesktopBlock>
              <DataTable<AlphalistRow>
                rows={rows}
                rowKey={(row) =>
                  `${row.employee_code}-${row.tin}-${row.last_name}`
                }
                minWidthClassName="min-w-[56rem]"
                columns={[
                  {
                    id: "employee",
                    header: "Employee",
                    cell: (row) => (
                      <>
                        <div className="font-medium">
                          {row.last_name}, {row.first_name}
                          {row.middle_name ? ` ${row.middle_name}` : ""}
                        </div>
                        <Caption className="text-muted-foreground">
                          {row.employee_code || "—"}
                        </Caption>
                      </>
                    ),
                  },
                  {
                    id: "tin",
                    header: "TIN",
                    align: "center",
                    cell: (row) => row.tin || "—",
                  },
                  { id: "gross", header: "Gross taxable", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.gross_taxable) },
                  { id: "nontax", header: "13th nontax", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.nontaxable_13th) },
                  { id: "sss", header: "SSS", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.sss_ee) },
                  { id: "ph", header: "PhilHealth", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.philhealth_ee) },
                  { id: "pagibig", header: "Pag-IBIG", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.pagibig_ee) },
                  { id: "wtax", header: "WTAX", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.wtax) },
                  { id: "net", header: "Net", align: "right", className: "tabular-nums", cell: (row) => formatCurrency(row.net_amount) },
                  {
                    id: "cutoffs",
                    header: "Cutoffs",
                    align: "right",
                    className: "tabular-nums",
                    cell: (row) => row.cutoff_count,
                  },
                ]}
              />
            </DbDesktopBlock>

            <DbMobileBlock>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li
                    key={`m-${row.employee_code}-${row.tin}-${row.last_name}`}
                    className={dbMobileListCard}
                  >
                    <DashboardMobileField
                      label="Employee"
                      value={`${row.last_name}, ${row.first_name}`}
                    />
                    <DashboardMobileField
                      label="Gross taxable"
                      value={formatCurrency(row.gross_taxable)}
                    />
                    <DashboardMobileField
                      label="WTAX"
                      value={formatCurrency(row.wtax)}
                    />
                    <DashboardMobileField
                      label="Net"
                      value={formatCurrency(row.net_amount)}
                    />
                  </li>
                ))}
              </ul>
            </DbMobileBlock>

            <div className="mt-4 flex items-center justify-between gap-3">
              <Caption className="text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {count}
              </Caption>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset <= 0 || loading}
                  onClick={() =>
                    writeParams({ offset: Math.max(offset - PAGE, 0) })
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset + PAGE >= count || loading}
                  onClick={() => writeParams({ offset: offset + PAGE })}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
