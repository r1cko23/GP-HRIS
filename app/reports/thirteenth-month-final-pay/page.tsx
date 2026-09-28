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
  formatLoansRemittanceDate,
} from "@/lib/reports/loans-report";
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

type FinalPayRow = {
  emp_id: string;
  full_name: string;
  no_of_months: number;
  total_basic: number;
  thirteenth_month_pay: number;
};

type Totals = {
  total_basic: number;
  thirteenth_month_pay: number;
};

function defaultPeriodFrom() {
  const y = new Date().getFullYear() - 1;
  return `${y}-11-16`;
}

function defaultPeriodTo() {
  const y = new Date().getFullYear();
  return `${y}-09-20`;
}

export default function ThirteenthMonthFinalPayPage() {
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
      <FinalPayReportContent />
    </Suspense>
  );
}

function FinalPayReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("bir_reports");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const statusFromUrl = searchParams.get("status") ?? "Active";
  const dateFromUrl = searchParams.get("date_from") ?? defaultPeriodFrom();
  const dateToUrl = searchParams.get("date_to") ?? defaultPeriodTo();
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<FinalPayRow[]>([]);
  const [totals, setTotals] = useState<Totals>({
    total_basic: 0,
    thirteenth_month_pay: 0,
  });
  const [clientLabel, setClientLabel] = useState("");
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
      router.replace(
        qs
          ? `/reports/thirteenth-month-final-pay?${qs}`
          : "/reports/thirteenth-month-final-pay"
      );
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open 13th month Final Pay.");
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

      const year = Number((dateFromUrl || defaultPeriodFrom()).slice(0, 4));
      const params = new URLSearchParams({
        type: "thirteenth-month",
        variant: "final-pay",
        year: String(year || new Date().getFullYear()),
        format: "json",
        limit: String(PAGE),
        offset: String(offset),
        status: statusFromUrl || "Active",
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
      const json = await directoryJson<{
        data: {
          rows: FinalPayRow[];
          count: number;
          client?: string;
          totals?: Totals;
        };
      }>(`/api/reports/finance-exports?${params}`, oid);
      setRows(json.data?.rows ?? []);
      setCount(json.data?.count ?? 0);
      setClientLabel(json.data?.client ?? "");
      setTotals(
        json.data?.totals ?? { total_basic: 0, thirteenth_month_pay: 0 }
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load Final Pay"
      );
      setRows([]);
      setCount(0);
      setTotals({ total_basic: 0, thirteenth_month_pay: 0 });
    } finally {
      setLoading(false);
    }
  }, [
    bootstrap,
    canOpen,
    clientFromUrl,
    clients,
    dateFromUrl,
    dateToUrl,
    offset,
    orgId,
    qFromUrl,
    statusFromUrl,
    writeParams,
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
      const year = Number((dateFromUrl || defaultPeriodFrom()).slice(0, 4));
      const params = new URLSearchParams({
        type: "thirteenth-month",
        variant: "final-pay",
        year: String(year || new Date().getFullYear()),
        format: "json",
        export: "1",
        limit: "200",
        offset: "0",
        status: statusFromUrl || "Active",
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
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
          json.data.pdf_filename ?? "13th-month-final-pay.pdf"
        );
        toast.success("Final Pay PDF downloaded");
      } else {
        if (!json.data?.xlsx_base64) throw new Error("Excel export empty");
        downloadBase64Xlsx(json.data.xlsx_base64, json.data.filename);
        toast.success("Final Pay Excel downloaded");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const selectedClientName =
    clients.find((c) => c.id === clientFromUrl)?.name || clientLabel;

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
          title="13th month Final Pay"
          description="MAIN Final Pay layout: Emp ID, Full Name, No of Months, Total Basic, 13th Month Pay."
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

        <div className="mb-3 space-y-1">
          <BodySmall>
            Client: {selectedClientName || "—"} | Status :{statusFromUrl || "Active"}
          </BodySmall>
          <BodySmall className="text-muted-foreground">
            Period: {formatLoansRemittanceDate(dateFromUrl) || "—"} to{" "}
            {formatLoansRemittanceDate(dateToUrl) || "—"}
          </BodySmall>
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
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
          <div className="w-full sm:w-40">
            <Caption className="mb-1 block text-muted-foreground">Status</Caption>
            <Select
              value={statusFromUrl || "Active"}
              onValueChange={(value) =>
                writeParams({ status: value, offset: 0 })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="All">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-40">
            <Caption className="mb-1 block text-muted-foreground">Period from</Caption>
            <Input
              type="date"
              value={dateFromUrl}
              onChange={(e) =>
                writeParams({ date_from: e.target.value || undefined, offset: 0 })
              }
              aria-label="Period from"
            />
          </div>
          <div className="w-full sm:w-40">
            <Caption className="mb-1 block text-muted-foreground">Period to</Caption>
            <Input
              type="date"
              value={dateToUrl}
              onChange={(e) =>
                writeParams({ date_to: e.target.value || undefined, offset: 0 })
              }
              aria-label="Period to"
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Search</Caption>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name or Emp ID"
              aria-label="Search Final Pay"
            />
          </div>
        </div>

        {loading ? (
          <BodySmall className="text-muted-foreground">Loading…</BodySmall>
        ) : rows.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            {qFromUrl || clientFromUrl
              ? "No Final Pay rows for this search/filter."
              : "No posted register lines for this period yet."}
          </BodySmall>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Emp ID</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead className="text-right">No of Months</TableHead>
                      <TableHead className="text-right">Total Basic</TableHead>
                      <TableHead className="text-right">13th Month Pay</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.emp_id}-${row.full_name}`}>
                        <TableCell>{row.emp_id || "—"}</TableCell>
                        <TableCell className="font-medium">
                          {row.full_name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.no_of_months.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.total_basic)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.thirteenth_month_pay)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={3} className="text-right font-semibold">
                        Total:
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(totals.total_basic)}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(totals.thirteenth_month_pay)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </DbDesktopBlock>

            <DbMobileBlock>
              <ul className="space-y-3">
                {rows.map((row) => (
                  <li
                    key={`m-${row.emp_id}-${row.full_name}`}
                    className={dbMobileListCard}
                  >
                    <DashboardMobileField label="Emp ID" value={row.emp_id || "—"} />
                    <DashboardMobileField label="Full Name" value={row.full_name} />
                    <DashboardMobileField
                      label="No of Months"
                      value={row.no_of_months.toFixed(2)}
                    />
                    <DashboardMobileField
                      label="Total Basic"
                      value={formatCurrency(row.total_basic)}
                    />
                    <DashboardMobileField
                      label="13th Month Pay"
                      value={formatCurrency(row.thirteenth_month_pay)}
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
