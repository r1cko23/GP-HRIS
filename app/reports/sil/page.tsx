"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  dbTableShell,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import { downloadBase64Xlsx } from "@/lib/reports/download-base64";
import {
  bootstrapReportClients,
  resolveReportClientId,
  type ReportClientOption,
} from "@/lib/reports/bootstrap-clients";
import { pickFirstClientAlphabetically } from "@/lib/reports/default-client";
import { MONTH_NAMES } from "@/lib/reports/sil-monthly-run";
import type { SilPayMethod } from "@/lib/reports/sil-pay-method";

const PAGE = 50;

type ClientOption = ReportClientOption;

type SilRow = {
  directory_employee_id: string | null;
  employee_code: string;
  last_name: string;
  first_name: string;
  hire_date: string;
  employment_status: string;
  daily_rate: number;
  days_worked: number;
  months: number;
  computation: number;
  days_entitlement: number;
  amount: number;
  remarks: string;
};

type SilRunMeta = {
  id: string;
  status: "draft" | "approved" | "posted" | "void";
  line_count: number;
  totals?: { amount?: number; days_worked?: number };
  built_at?: string | null;
  approved_at?: string | null;
  posted_at?: string | null;
};

type HistoryRow = {
  id: string;
  year: number;
  month: number;
  status: string;
  line_count: number;
  posted_at?: string | null;
  approved_at?: string | null;
  built_at?: string | null;
};

function currentYear() {
  return new Date().getFullYear();
}

function currentMonth() {
  return new Date().getMonth() + 1;
}

function statusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" | "destructive" {
  if (status === "posted") return "default";
  if (status === "approved") return "secondary";
  if (status === "void") return "destructive";
  return "outline";
}

function formatWhen(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function SilMonthlyReportPage() {
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
      <SilMonthlyReportContent />
    </Suspense>
  );
}

function SilMonthlyReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("bir_reports");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const yearFromUrl =
    Number(searchParams.get("year") ?? currentYear()) || currentYear();
  const monthFromUrl =
    Number(searchParams.get("month") ?? currentMonth()) || currentMonth();
  const statusFromUrl = (searchParams.get("status") ?? "active").toLowerCase();
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [preferOrg, setPreferOrg] = useState<"deployed" | "organic">(
    "deployed"
  );
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<SilRow[]>([]);
  const [count, setCount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [clientName, setClientName] = useState("");
  const [payMethod, setPayMethod] = useState<SilPayMethod>("casual_prorated");
  const [payMethodLabel, setPayMethodLabel] = useState("");
  const [payMethodAssigned, setPayMethodAssigned] = useState(true);
  const [run, setRun] = useState<SilRunMeta | null>(null);
  const [source, setSource] = useState<"run" | "preview">("preview");
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState(qFromUrl);
  const debouncedSearch = useDebounce(searchTerm, 300);

  const writeParams = useCallback(
    (patch: Record<string, string | number | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined || value === "" || value === 0) {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const qs = next.toString();
      router.replace(qs ? `/reports/sil?${qs}` : "/reports/sil");
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open SIL.");
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

  const loadHistory = useCallback(
    async (oid: string, clientId: string) => {
      if (!clientId) {
        setHistory([]);
        return;
      }
      try {
        const json = await directoryJson<{ data: HistoryRow[] }>(
          `/api/reports/sil-monthly-run/history?client_id=${encodeURIComponent(clientId)}&limit=12&offset=0`,
          oid
        );
        setHistory(json.data ?? []);
      } catch {
        setHistory([]);
      }
    },
    []
  );

  const loadRows = useCallback(async () => {
    if (!canOpen) return;
    setLoading(true);
    try {
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
      if (!resolved.clientId) {
        setRows([]);
        setCount(0);
        setTotalAmount(0);
        setClientName("");
        setPayMethod("casual_prorated");
        setPayMethodLabel("");
        setPayMethodAssigned(true);
        setRun(null);
        setHistory([]);
        return;
      }

      const params = new URLSearchParams({
        client_id: resolved.clientId,
        year: String(yearFromUrl),
        month: String(monthFromUrl),
        status: statusFromUrl || "active",
        format: "json",
        limit: String(PAGE),
        offset: String(offset),
      });
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      const json = await directoryJson<{
        data: SilRow[];
        count: number;
        totals?: { amount: number };
        client_name?: string;
        pay_method?: SilPayMethod;
        pay_method_label?: string;
        pay_method_assigned?: boolean;
        run?: SilRunMeta | null;
        source?: "run" | "preview";
      }>(`/api/reports/sil-monthly-run?${params}`, oid);
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
      setTotalAmount(json.totals?.amount ?? 0);
      setClientName(json.client_name ?? "");
      setPayMethod(json.pay_method ?? "casual_prorated");
      setPayMethodLabel(json.pay_method_label ?? "");
      setPayMethodAssigned(json.pay_method_assigned !== false);
      setRun(json.run ?? null);
      setSource(json.source ?? (json.run ? "run" : "preview"));
      await loadHistory(oid, resolved.clientId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load SIL run");
      setRows([]);
      setCount(0);
      setTotalAmount(0);
      setRun(null);
    } finally {
      setLoading(false);
    }
  }, [
    bootstrap,
    canOpen,
    clientFromUrl,
    loadHistory,
    monthFromUrl,
    offset,
    qFromUrl,
    statusFromUrl,
    writeParams,
    yearFromUrl,
  ]);

  useEffect(() => {
    if (permLoading || !canOpen) return;
    void loadRows();
  }, [canOpen, loadRows, permLoading]);

  async function handleExport() {
    if (!clientFromUrl) {
      toast.error("Select a client first");
      return;
    }
    setExporting(true);
    try {
      const boot = orgId ? { orgId } : await bootstrap();
      const params = new URLSearchParams({
        client_id: clientFromUrl,
        year: String(yearFromUrl),
        month: String(monthFromUrl),
        status: statusFromUrl || "active",
        format: "json",
        export: "1",
        limit: "200",
        offset: "0",
      });
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      const json = await directoryJson<{
        xlsx_base64?: string;
        filename?: string;
      }>(`/api/reports/sil-monthly-run?${params}`, boot.orgId);
      if (!json.xlsx_base64) throw new Error("Excel export empty");
      downloadBase64Xlsx(
        json.xlsx_base64,
        json.filename ?? "SIL-monthly.xlsx"
      );
      toast.success("SIL Excel downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed");
    } finally {
      setExporting(false);
    }
  }

  async function runAction(
    label: string,
    path: string,
    init?: RequestInit
  ) {
    if (!orgId && !(await bootstrap()).orgId) return;
    const oid = orgId || (await bootstrap()).orgId;
    setActing(true);
    try {
      await directoryJson(path, oid, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...init,
      });
      toast.success(label);
      await loadRows();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${label} failed`);
    } finally {
      setActing(false);
    }
  }

  async function handleBuild() {
    await runAction("Draft built", "/api/reports/sil-monthly-run", {
      body: JSON.stringify({
        client_id: clientFromUrl,
        year: yearFromUrl,
        month: monthFromUrl,
      }),
    });
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const years = Array.from({ length: 6 }, (_, i) => currentYear() - i);
  const monthLabel = MONTH_NAMES[monthFromUrl - 1] ?? String(monthFromUrl);
  const runStatus = run?.status ?? null;
  const runId = run?.id ?? null;
  const isPosted = runStatus === "posted";
  const isDraft = runStatus === "draft";
  const isApproved = runStatus === "approved";

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
          title={`SERVICE INCENTIVE LEAVE - ${monthLabel} ${yearFromUrl}`}
          actions={
            <div className={dbHeaderActions}>
              {!run ? (
                <Button
                  className={dbHeaderButton}
                  onClick={() => void handleBuild()}
                  disabled={acting || loading || !clientFromUrl}
                >
                  {acting ? "Working…" : "Build draft"}
                </Button>
              ) : null}
              {isDraft && runId ? (
                <>
                  <Button
                    variant="outline"
                    className={dbHeaderButton}
                    onClick={() => void handleBuild()}
                    disabled={acting || loading}
                  >
                    Refresh draft
                  </Button>
                  <Button
                    className={dbHeaderButton}
                    onClick={() =>
                      void runAction(
                        "SIL run approved",
                        `/api/reports/sil-monthly-run/${runId}/approve`
                      )
                    }
                    disabled={acting || loading}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    className={dbHeaderButton}
                    onClick={() =>
                      void runAction(
                        "SIL run voided",
                        `/api/reports/sil-monthly-run/${runId}/void`
                      )
                    }
                    disabled={acting || loading}
                  >
                    Void
                  </Button>
                </>
              ) : null}
              {isApproved && runId ? (
                <>
                  <Button
                    className={dbHeaderButton}
                    onClick={() =>
                      void runAction(
                        "SIL run posted",
                        `/api/reports/sil-monthly-run/${runId}/post`
                      )
                    }
                    disabled={acting || loading}
                  >
                    Post
                  </Button>
                  <Button
                    variant="outline"
                    className={dbHeaderButton}
                    onClick={() =>
                      void runAction(
                        "SIL run voided",
                        `/api/reports/sil-monthly-run/${runId}/void`
                      )
                    }
                    disabled={acting || loading}
                  >
                    Void
                  </Button>
                </>
              ) : null}
              <Button
                variant="outline"
                className={dbHeaderButton}
                onClick={() => void handleExport()}
                disabled={exporting || loading || !clientFromUrl || count === 0}
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
                setRun(null);
                writeParams({ client_id: undefined, offset: 0 });
              }}
              options={orgs.map((o) => ({
                id: o.id,
                label: directoryOrgLabel(o.name),
              }))}
            />
          </div>
        ) : null}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {clientName ? (
            <Caption className="font-medium text-foreground">{clientName}</Caption>
          ) : null}
          {payMethodLabel ? (
            <Caption className="text-muted-foreground">
              {payMethodLabel}
              {payMethodAssigned ? "" : " — not set for this client"}
            </Caption>
          ) : null}
          {runStatus ? (
            <Badge variant={statusBadgeVariant(runStatus)}>
              {runStatus.charAt(0).toUpperCase() + runStatus.slice(1)}
            </Badge>
          ) : (
            <Badge variant="outline">Preview</Badge>
          )}
          {isPosted && run?.posted_at ? (
            <Caption className="text-muted-foreground">
              Posted {formatWhen(run.posted_at)}
            </Caption>
          ) : null}
          {isApproved && run?.approved_at ? (
            <Caption className="text-muted-foreground">
              Approved {formatWhen(run.approved_at)}
            </Caption>
          ) : null}
          {source === "preview" && !run ? (
            <Caption className="text-muted-foreground">
              Build a draft to lock amounts before paying
            </Caption>
          ) : null}
        </div>

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
          <div className="min-w-[10rem]">
            <Caption className="mb-1 block text-muted-foreground">Month</Caption>
            <Select
              value={String(monthFromUrl)}
              onValueChange={(value) =>
                writeParams({ month: Number(value), offset: 0 })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, i) => (
                  <SelectItem key={name} value={String(i + 1)}>
                    {name.charAt(0) + name.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Client</Caption>
            <Select
              value={clientFromUrl || undefined}
              onValueChange={(value) =>
                writeParams({
                  client_id: value,
                  offset: 0,
                })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue placeholder="Select client" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[10rem]">
            <Caption className="mb-1 block text-muted-foreground">Status</Caption>
            <Select
              value={statusFromUrl || "active"}
              onValueChange={(value) =>
                writeParams({
                  status: value === "active" ? undefined : value,
                  offset: 0,
                })
              }
            >
              <SelectTrigger className={dbFilterSelect}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <Caption className="mb-1 block text-muted-foreground">Search</Caption>
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Name or employee code"
            />
          </div>
        </div>

        {history.length > 0 ? (
          <div className="mb-4 overflow-x-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-left">Period</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right tabular-nums">Lines</TableHead>
                  <TableHead className="text-center">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow
                    key={h.id}
                    className="cursor-pointer"
                    onClick={() =>
                      writeParams({
                        year: h.year,
                        month: h.month,
                        offset: 0,
                      })
                    }
                  >
                    <TableCell className="text-left">
                      {(MONTH_NAMES[h.month - 1] ?? h.month)} {h.year}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusBadgeVariant(h.status)}>
                        {h.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {h.line_count}
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {formatWhen(
                        h.posted_at ?? h.approved_at ?? h.built_at
                      ) || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {loading ? (
          <BodySmall className="text-muted-foreground">Loading…</BodySmall>
        ) : rows.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            {qFromUrl || statusFromUrl !== "active"
              ? "No anniversary employees for this search/filter."
              : "No hire anniversaries in this month (or none with ≥1 year tenure)."}
          </BodySmall>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center">No.</TableHead>
                      <TableHead className="text-left">Last Name</TableHead>
                      <TableHead className="text-left">First Name</TableHead>
                      <TableHead className="text-center">Date Hired</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right tabular-nums">Rate</TableHead>
                      <TableHead className="text-right tabular-nums">
                        # Days Worked
                      </TableHead>
                      <TableHead className="text-right tabular-nums">
                        {payMethod === "full_313_anniversary"
                          ? "Days / 313"
                          : "Months"}
                      </TableHead>
                      <TableHead className="text-right tabular-nums">
                        Days Entitlement
                      </TableHead>
                      <TableHead className="text-right tabular-nums">
                        Amount
                      </TableHead>
                      <TableHead className="text-left">Remarks</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, i) => (
                      <TableRow
                        key={
                          row.directory_employee_id ??
                          `${row.last_name}-${row.hire_date}-${i}`
                        }
                      >
                        <TableCell className="text-center tabular-nums">
                          {offset + i + 1}
                        </TableCell>
                        <TableCell className="text-left font-medium">
                          {row.last_name.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-left">
                          {row.first_name.toUpperCase()}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.hire_date}
                        </TableCell>
                        <TableCell className="text-center">
                          {row.employment_status}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.daily_rate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.days_worked.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.months.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.days_entitlement.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.amount)}
                        </TableCell>
                        <TableCell className="text-left text-muted-foreground">
                          {row.remarks || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={9} className="text-right font-medium">
                        Total
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatCurrency(totalAmount)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </DbDesktopBlock>

            <DbMobileBlock>
              <ul className="space-y-3">
                {rows.map((row, i) => (
                  <li
                    key={`m-${row.directory_employee_id ?? i}`}
                    className={dbMobileListCard}
                  >
                    <DashboardMobileField
                      label="Name"
                      value={`${row.last_name.toUpperCase()}, ${row.first_name.toUpperCase()}`}
                    />
                    <DashboardMobileField
                      label="Date hired"
                      value={row.hire_date}
                    />
                    <DashboardMobileField
                      label="Status"
                      value={row.employment_status}
                    />
                    <DashboardMobileField
                      label="Days worked"
                      value={row.days_worked.toFixed(2)}
                    />
                    <DashboardMobileField
                      label="Amount"
                      value={formatCurrency(row.amount)}
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
