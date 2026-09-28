"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall, Caption } from "@/components/ui/typography";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useDebounce } from "@/lib/hooks/use-debounce";
import {
  directoryJson,
  ensureDirectoryOrgId,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import {
  dbFilterSelect,
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";

import {
  downloadBase64Pdf,
  downloadBase64Xlsx,
} from "@/lib/reports/download-base64";
import {
  pickFirstClientAlphabetically,
  sortClientsAlphabetically,
} from "@/lib/reports/default-client";

const PAGE = 50;

type ClientOption = { id: string; name: string };

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
    const list = await loadDirectoryOrganizations();
    const org = pickDirectoryOrg(list, readDirectoryOrgId());
    if (!org) throw new Error("No organization");
    writeDirectoryOrgId(org.id);
    setOrgId(org.id);
    const clientsJson = await directoryJson<{ data: ClientOption[] }>(
      `/api/directory/clients?${new URLSearchParams({
        status: "active",
        limit: "200",
        offset: "0",
      })}`,
      org.id
    );
    const clientList = sortClientsAlphabetically(
      (clientsJson.data ?? []).map((row) => ({ id: row.id, name: row.name }))
    );
    setClients(clientList);
    return { orgId: org.id, clients: clientList };
  }, []);

  const loadRows = useCallback(async () => {
    if (!canOpen) return;
    setLoading(true);
    try {
      const boot =
        !orgId || clients.length === 0
          ? await bootstrap()
          : { orgId, clients };
      const oid = boot.orgId;
      await ensureDirectoryOrgId();

      if (!clientFromUrl) {
        const first = pickFirstClientAlphabetically(boot.clients);
        if (first) {
          writeParams({ client_id: first.id, offset: 0 });
          return;
        }
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
    clients,
    offset,
    orgId,
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
        <DashboardPageHeader
          title="Alphalist"
          description="Annual taxable pay and statutory EE amounts from posted registers."
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
          <BodySmall className="text-muted-foreground">Loading…</BodySmall>
        ) : rows.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            {qFromUrl || clientFromUrl
              ? "No alphalist rows for this search/filter."
              : "No posted register lines for this year yet."}
          </BodySmall>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>TIN</TableHead>
                      <TableHead className="text-right">Gross taxable</TableHead>
                      <TableHead className="text-right">13th nontax</TableHead>
                      <TableHead className="text-right">SSS</TableHead>
                      <TableHead className="text-right">PhilHealth</TableHead>
                      <TableHead className="text-right">Pag-IBIG</TableHead>
                      <TableHead className="text-right">WTAX</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead className="text-right">Cutoffs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.employee_code}-${row.tin}-${row.last_name}`}>
                        <TableCell>
                          <div className="font-medium">
                            {row.last_name}, {row.first_name}
                            {row.middle_name ? ` ${row.middle_name}` : ""}
                          </div>
                          <Caption className="text-muted-foreground">
                            {row.employee_code || "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>{row.tin || "—"}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.gross_taxable)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.nontaxable_13th)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.sss_ee)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.philhealth_ee)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.pagibig_ee)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.wtax)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(row.net_amount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {row.cutoff_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
