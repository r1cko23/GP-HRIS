"use client";

import { Suspense, useCallback, useEffect, useState, Fragment } from "react";
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
import { LOANS_REPORT_TYPES, groupLoansReportByCompany, formatLoansRemittanceEmployeeName, formatLoansRemittanceCutoff, formatLoansRemittanceDate, loansRemittanceTitle } from "@/lib/reports/loans-report";
import {
  pickFirstClientAlphabetically,
  sortClientsAlphabetically,
} from "@/lib/reports/default-client";
import {
  dbFilterSelect,
  dbHeaderActions,
  dbHeaderButton,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { dbMobileListCard } from "@/lib/dashboard-ui";

const PAGE = 50;

type ClientOption = { id: string; name: string };

type LoansReportRow = {
  company_name: string;
  department: string;
  employee_code: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  date_of_birth: string;
  pagibig_no: string;
  sss_no: string;
  amount: number;
  period_start: string;
  period_end: string;
  payout_date: string;
  particular: string;
  loan_type: string;
};

const TYPE_LABELS: Record<string, string> = {
  sss: "SSS Loan",
  sss_calamity: "SSS Calamity Loan",
  pagibig_mpl: "Pag-IBIG MPL",
  pagibig_calamity: "Pag-IBIG Calamity Loan",
  pagibig_safe: "Pag-IBIG Safe Loan",
};

export default function LoansReportPage() {
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
      <LoansReportContent />
    </Suspense>
  );
}

function LoansReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("loans");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const typeFromUrl = searchParams.get("loan_type") ?? "all";
  const dateFromUrl = searchParams.get("date_from") ?? "";
  const dateToUrl = searchParams.get("date_to") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<LoansReportRow[]>([]);
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
      router.replace(qs ? `/reports/loans?${qs}` : "/reports/loans");
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open the Loans report.");
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
      (clientsJson.data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
      }))
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
      if (typeFromUrl !== "all") params.set("loan_type", typeFromUrl);
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
      const json = await directoryJson<{
        data: LoansReportRow[];
        count: number;
      }>(`/api/reports/loans?${params}`, oid);
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load loans report");
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
    typeFromUrl,
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
      if (typeFromUrl !== "all") params.set("loan_type", typeFromUrl);
      if (dateFromUrl) params.set("date_from", dateFromUrl);
      if (dateToUrl) params.set("date_to", dateToUrl);
      const res = await fetch(`/api/reports/loans?${params}`, {
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
        `loans-report.${format}`;
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
  const remittanceTitle = loansRemittanceTitle(
    typeFromUrl !== "all" ? TYPE_LABELS[typeFromUrl] ?? typeFromUrl : "SSS Loan"
  );
  const payoutRangeLabel =
    dateFromUrl || dateToUrl
      ? `Payout Date: ${formatLoansRemittanceDate(dateFromUrl) || "—"} to ${
          formatLoansRemittanceDate(dateToUrl) || "—"
        }`
      : null;
  const { groups, grand_total } = groupLoansReportByCompany(rows);

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-16", dbPageWrapper)}>
        <DashboardPageHeader
          title={remittanceTitle}
          description="SSS and Pag-IBIG loan remittance grouped by company (MAIN List of Other Deduction)."
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
              aria-label="Search loans report"
            />
          </div>
          <div className="w-full sm:w-48">
            <Caption className="mb-1 block text-muted-foreground">Loan type</Caption>
            <Select
              value={typeFromUrl}
              onValueChange={(value) =>
                writeParams({ loan_type: value, offset: 0 })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue placeholder="All statutory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statutory</SelectItem>
                {LOANS_REPORT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {TYPE_LABELS[type] ?? type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <Caption className="mb-1 block text-muted-foreground">Payout from</Caption>
            <Input
              type="date"
              value={dateFromUrl}
              onChange={(e) =>
                writeParams({ date_from: e.target.value || undefined, offset: 0 })
              }
              aria-label="Payout date from"
            />
          </div>
          <div className="w-full sm:w-40">
            <Caption className="mb-1 block text-muted-foreground">Payout to</Caption>
            <Input
              type="date"
              value={dateToUrl}
              onChange={(e) =>
                writeParams({ date_to: e.target.value || undefined, offset: 0 })
              }
              aria-label="Payout date to"
            />
          </div>
        </div>

        {payoutRangeLabel ? (
          <BodySmall className="mb-3 text-muted-foreground">{payoutRangeLabel}</BodySmall>
        ) : null}

        {loading ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-md border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
            <p className="font-medium text-foreground">
              {qFromUrl || clientFromUrl || typeFromUrl !== "all" || dateFromUrl || dateToUrl
                ? "No loans match these filters"
                : "No posted loan deductions on file yet"}
            </p>
            <BodySmall className="mt-1 text-muted-foreground">
              Rows come from posted register loan lines only.
            </BodySmall>
          </div>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead>Birth Date</TableHead>
                      <TableHead>Company Name</TableHead>
                      <TableHead>Department/Group</TableHead>
                      <TableHead>Payout Date</TableHead>
                      <TableHead>Cutoff</TableHead>
                      <TableHead>Particular</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>SSS Number</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map((group) => (
                      <Fragment key={group.company_name}>
                        <TableRow className="bg-muted/40">
                          <TableCell
                            colSpan={10}
                            className="font-semibold text-foreground"
                          >
                            {group.company_name}
                          </TableCell>
                        </TableRow>
                        {group.rows.map((row) => (
                          <TableRow
                            key={`${row.employee_code}-${row.particular}-${row.period_end}-${row.row_no}`}
                          >
                            <TableCell className="tabular-nums">{row.row_no}</TableCell>
                            <TableCell className="font-medium">
                              {formatLoansRemittanceEmployeeName(row)}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatLoansRemittanceDate(row.date_of_birth) || "—"}
                            </TableCell>
                            <TableCell>{row.company_name || "—"}</TableCell>
                            <TableCell>{row.department || "—"}</TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatLoansRemittanceDate(row.payout_date) || "—"}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-sm">
                              {formatLoansRemittanceCutoff(
                                row.period_start,
                                row.period_end
                              ) || "—"}
                            </TableCell>
                            <TableCell>{row.particular}</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(row.amount)}
                            </TableCell>
                            <TableCell className="text-sm">
                              {row.sss_no || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-b-2">
                          <TableCell colSpan={8} className="text-right font-medium">
                            Total:
                          </TableCell>
                          <TableCell className="text-right font-medium tabular-nums">
                            {formatCurrency(group.total)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      </Fragment>
                    ))}
                    <TableRow>
                      <TableCell colSpan={8} className="text-right font-semibold">
                        Grand Total:
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(grand_total)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </DbDesktopBlock>

            <DbMobileBlock>
              <ul className="space-y-2">
                {groups.map((group) => (
                  <li key={group.company_name} className="space-y-2">
                    <p className="px-1 text-sm font-semibold">{group.company_name}</p>
                    {group.rows.map((row) => (
                      <div
                        key={`${row.employee_code}-${row.particular}-${row.period_end}-${row.row_no}`}
                        className={dbMobileListCard}
                      >
                        <DashboardMobileField
                          label="Employee"
                          value={formatLoansRemittanceEmployeeName(row)}
                        />
                        <DashboardMobileField label="Particular" value={row.particular} />
                        <DashboardMobileField
                          label="Amount"
                          value={formatCurrency(row.amount)}
                        />
                        <DashboardMobileField
                          label="Cutoff"
                          value={
                            formatLoansRemittanceCutoff(
                              row.period_start,
                              row.period_end
                            ) || "—"
                          }
                        />
                        <DashboardMobileField
                          label="SSS"
                          value={row.sss_no || "—"}
                        />
                      </div>
                    ))}
                    <Caption className="px-1 text-muted-foreground">
                      Total: {formatCurrency(group.total)}
                    </Caption>
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
