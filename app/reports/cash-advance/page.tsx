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
  pickFirstClientAlphabetically,
  sortClientsAlphabetically,
} from "@/lib/reports/default-client";
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

const PAGE = 50;

type ClientOption = { id: string; name: string };

type CashAdvanceRow = {
  company_name: string;
  employee_code: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  amount: number;
  period_start: string;
  period_end: string;
  payout_date: string;
  particular: string;
  sss_no: string;
  pagibig_no: string;
};

export default function CashAdvanceReportPage() {
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
      <CashAdvanceReportContent />
    </Suspense>
  );
}

function CashAdvanceReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("loans");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const dateFromUrl = searchParams.get("date_from") ?? "";
  const dateToUrl = searchParams.get("date_to") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<CashAdvanceRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(qFromUrl);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const writeParams = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === "all" || value === 0) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `/reports/cash-advance?${qs}` : "/reports/cash-advance");
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open the Cash advance report.");
      router.push("/reports");
    }
  }, [canOpen, permLoading, router]);

  useEffect(() => {
    if (debouncedSearch === qFromUrl) return;
    writeParams({ q: debouncedSearch.trim() || undefined, offset: 0 });
  }, [debouncedSearch, qFromUrl, writeParams]);

  const bootstrap = useCallback(async () => {
    const list = await loadDirectoryOrganizations();
    const org = pickDirectoryOrg(list, readDirectoryOrgId(), "organic");
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
        limit: String(PAGE),
        offset: String(offset),
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
      const json = await directoryJson<{
        data: CashAdvanceRow[];
        count: number;
      }>(`/api/reports/cash-advance?${params}`, oid);
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load cash advance report"
      );
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
    dateFromUrl,
    dateToUrl,
    offset,
    orgId,
    qFromUrl,
    writeParams,
  ]);

  useEffect(() => {
    if (permLoading || !canOpen) return;
    void loadRows();
  }, [canOpen, loadRows, permLoading]);

  async function downloadExport(format: "xlsx" | "pdf") {
    try {
      const boot = orgId ? { orgId } : await bootstrap();
      const oid = boot.orgId;
      await ensureDirectoryOrgId();
      const params = new URLSearchParams({ format });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
      const res = await fetch(`/api/reports/cash-advance?${params}`, {
        headers: { "x-organization-id": oid },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers
          .get("Content-Disposition")
          ?.match(/filename="([^"]+)"/)?.[1] ??
        `cash-advance-report.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(format === "pdf" ? "PDF downloaded" : "Excel downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const canPrev = offset > 0;
  const canNext = offset + PAGE < count;
  const hasFilters = Boolean(
    qFromUrl || clientFromUrl || dateFromUrl || dateToUrl
  );

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-16", dbPageWrapper)}>
        <DashboardPageHeader
          title="Cash advance"
          description="Organic cash advances deducted on posted payroll registers."
          actions={
            <div className={dbHeaderActions}>
              <Button
                type="button"
                variant="outline"
                className={dbHeaderButton}
                onClick={() => void downloadExport("pdf")}
                disabled={loading || count === 0}
              >
                Download PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                className={dbHeaderButton}
                onClick={() => void downloadExport("xlsx")}
                disabled={loading || count === 0}
              >
                Download Excel
              </Button>
            </div>
          }
        />

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[12rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Search</Caption>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name, code, particular…"
              aria-label="Search cash advance report"
            />
          </div>
          <div className="w-full sm:w-56">
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
            <Caption className="mb-1 block text-muted-foreground">From</Caption>
            <Input
              type="date"
              value={dateFromUrl}
              onChange={(e) =>
                writeParams({ date_from: e.target.value || undefined, offset: 0 })
              }
              aria-label="Period end from"
            />
          </div>
          <div className="w-full sm:w-40">
            <Caption className="mb-1 block text-muted-foreground">To</Caption>
            <Input
              type="date"
              value={dateToUrl}
              onChange={(e) =>
                writeParams({ date_to: e.target.value || undefined, offset: 0 })
              }
              aria-label="Period end to"
            />
          </div>
        </div>

        {loading ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <p className="font-medium text-foreground">
              {hasFilters
                ? "No cash advances match these filters"
                : "No posted cash advances on file yet"}
            </p>
            <BodySmall className="mt-1 text-muted-foreground">
              Switch to the Organic organization if you expected house cash advances.
            </BodySmall>
          </div>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Client</TableHead>
                      <TableHead>Employee</TableHead>
                      <TableHead>Particular</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow
                        key={`${row.employee_code}-${row.period_end}-${i}`}
                      >
                        <TableCell>{row.company_name || "—"}</TableCell>
                        <TableCell>
                          <div className="font-medium">
                            {row.last_name}, {row.first_name}
                            {row.middle_name ? ` ${row.middle_name}` : ""}
                          </div>
                          <Caption className="text-muted-foreground">
                            {row.employee_code || "—"}
                          </Caption>
                        </TableCell>
                        <TableCell>{row.particular}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.amount)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {row.period_start} – {row.period_end}
                        </TableCell>
                        <TableCell>{row.payout_date || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DbDesktopBlock>

            <DbMobileBlock>
              <ul className="space-y-2">
                {rows.map((row, i) => (
                  <li
                    key={`${row.employee_code}-${row.period_end}-${i}`}
                    className={dbMobileListCard}
                  >
                    <DashboardMobileField
                      label="Employee"
                      value={`${row.last_name}, ${row.first_name}`}
                    />
                    <DashboardMobileField
                      label="Amount"
                      value={formatCurrency(row.amount)}
                    />
                    <DashboardMobileField
                      label="Period"
                      value={`${row.period_start} – ${row.period_end}`}
                    />
                    <DashboardMobileField
                      label="Client"
                      value={row.company_name || "—"}
                    />
                  </li>
                ))}
              </ul>
            </DbMobileBlock>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <Caption className="text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {count}
              </Caption>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canPrev || loading}
                  onClick={() =>
                    writeParams({ offset: Math.max(offset - PAGE, 0) })
                  }
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!canNext || loading}
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
