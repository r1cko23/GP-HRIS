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

type MissMerryRow = {
  client: string;
  name: string;
  thirteenth_month: number;
  ytd: number;
  payout: string;
};

type SalaryRange = { range: string; head_count: number };

function currentYear() {
  return new Date().getFullYear();
}

export default function ThirteenthMonthReportPage() {
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
      <ThirteenthMonthReportContent />
    </Suspense>
  );
}

function ThirteenthMonthReportContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canOpen = canRead("reports") || canRead("bir_reports");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const qFromUrl = searchParams.get("q") ?? "";
  const yearFromUrl =
    Number(searchParams.get("year") ?? currentYear()) || currentYear();
  const offset = Math.max(Number(searchParams.get("offset") ?? 0) || 0, 0);

  const [orgId, setOrgId] = useState("");
  const [orgs, setOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [preferOrg, setPreferOrg] = useState<"deployed" | "organic">(
    "deployed"
  );
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [rows, setRows] = useState<MissMerryRow[]>([]);
  const [ranges, setRanges] = useState<SalaryRange[]>([]);
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
        qs ? `/reports/thirteenth-month?${qs}` : "/reports/thirteenth-month"
      );
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canOpen) {
      toast.error("You do not have permission to open 13th month.");
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
        type: "thirteenth-month",
        variant: "miss-merry",
        year: String(yearFromUrl),
        format: "json",
        limit: String(PAGE),
        offset: String(offset),
      });
      if (clientFromUrl) params.set("client_id", clientFromUrl);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      const json = await directoryJson<{
        data: {
          rows: MissMerryRow[];
          count: number;
          salary_ranges?: SalaryRange[];
        };
      }>(`/api/reports/finance-exports?${params}`, oid);
      setRows(json.data?.rows ?? []);
      setCount(json.data?.count ?? 0);
      setRanges(json.data?.salary_ranges ?? []);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load 13th month"
      );
      setRows([]);
      setCount(0);
      setRanges([]);
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
        type: "thirteenth-month",
        variant: "miss-merry",
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
          json.data.pdf_filename ?? "13th-month-pay-validated.pdf"
        );
        toast.success("PDF downloaded (REPORTS DETAILS + employee list)");
      } else {
        if (!json.data?.xlsx_base64) throw new Error("Excel export empty");
        downloadBase64Xlsx(json.data.xlsx_base64, json.data.filename);
        toast.success("Excel downloaded (REPORTS DETAILS + employee list)");
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
          title="13TH MONTH PAY-VALIDATED"
          description="REPORTS DETAILS (salary ranges) plus the employee list — both included in Excel and PDF downloads."
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
                setRanges([]);
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
              placeholder="Name or employee code"
            />
          </div>
        </div>

        {ranges.length > 0 ? (
          <div className="mb-4">
            <Caption className="mb-2 block font-medium text-foreground">
              REPORTS DETAILS — No. of workers &amp; salary range
            </Caption>
            <div className="overflow-x-auto rounded-md border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-left">RANGE</TableHead>
                    <TableHead className="text-right tabular-nums">
                      HEAD COUNTS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranges.map((band) => (
                    <TableRow key={band.range}>
                      <TableCell
                        className={
                          band.range === "GRAND TOTAL"
                            ? "font-semibold text-left"
                            : "text-left"
                        }
                      >
                        {band.range}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {band.head_count}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : null}

        {!loading && rows.length > 0 ? (
          <Caption className="mb-2 block font-medium text-foreground">
            13TH MONTH PAY-VALIDATED — employee list
          </Caption>
        ) : null}

        {loading ? (
          <BodySmall className="text-muted-foreground">Loading…</BodySmall>
        ) : rows.length === 0 ? (
          <BodySmall className="text-muted-foreground">
            {qFromUrl || clientFromUrl
              ? "No 13th month rows for this search/filter."
              : "No posted register lines for this year yet."}
          </BodySmall>
        ) : (
          <>
            <DbDesktopBlock>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-left">Client</TableHead>
                      <TableHead className="text-left">Name</TableHead>
                      <TableHead className="text-right tabular-nums">
                        13th month
                      </TableHead>
                      <TableHead className="text-right tabular-nums">YTD</TableHead>
                      <TableHead className="text-center">Payout</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={`${row.client}-${row.name}-${row.ytd}`}>
                        <TableCell className="text-left">{row.client}</TableCell>
                        <TableCell className="text-left font-medium">
                          {row.name}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.thirteenth_month)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(row.ytd)}
                        </TableCell>
                        <TableCell className="text-center tabular-nums">
                          {row.payout || "—"}
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
                    key={`m-${row.client}-${row.name}-${row.ytd}`}
                    className={dbMobileListCard}
                  >
                    <DashboardMobileField label="Client" value={row.client} />
                    <DashboardMobileField label="Name" value={row.name} />
                    <DashboardMobileField
                      label="13th month"
                      value={formatCurrency(row.thirteenth_month)}
                    />
                    <DashboardMobileField
                      label="YTD"
                      value={formatCurrency(row.ytd)}
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
