"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { MetricCard } from "@/components/ui/metric-card";
import { Caption, BodySmall } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { dbPageWrapper, dbTableShell, dbKpiGrid } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  readDirectoryClient,
} from "@/lib/directory/browser";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type CutoffPeriod = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
  payroll_date: string | null;
};

type ParityRow = {
  status: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  legacy_employee_id: number | null;
  gp: { gross: number; net: number; sss: number; wtax: number };
  legacy: { gross: number | null; net: number | null; sss: number | null; wtax: number | null };
  delta: { gross: number | null; net: number | null };
};

type ParityPayload = {
  period: CutoffPeriod;
  client: { id: string; name: string | null; legacy_id: number | null };
  register: { id: string; status: string; line_count: number } | null;
  legacy_available: boolean;
  legacy_error: string | null;
  legacy_row_count: number;
  summary: {
    match: number;
    mismatch: number;
    gp_only: number;
    legacy_only: number;
    gp_no_legacy_link: number;
    gp_totals: { gross: number; net: number };
    legacy_totals: { gross: number; net: number };
  };
  rows: ParityRow[];
};

const STATUS_LABEL: Record<string, string> = {
  match: "Match",
  mismatch: "Mismatch",
  gp_only: "GP only",
  legacy_only: "Legacy only",
  gp_no_legacy_link: "No legacy link",
};

function statusVariant(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "match") return "secondary";
  if (status === "mismatch") return "destructive";
  return "outline";
}

export default function CutoffParityReportPage() {
  const [orgId, setOrgId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [periods, setPeriods] = useState<CutoffPeriod[]>([]);
  const [cutoffId, setCutoffId] = useState("");
  const [data, setData] = useState<ParityPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const org = await ensureDirectoryOrgId();
        setOrgId(org);
        const mem = readDirectoryClient();
        if (mem?.id) {
          setClientId(mem.id);
          setClientName(mem.name);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load org");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadPeriods = useCallback(async () => {
    if (!orgId || !clientId) return;
    const json = await directoryJson<{
      data: CutoffPeriod[];
      count: number;
    }>(
      `/api/timekeeping/cutoff-periods?client_id=${encodeURIComponent(clientId)}&limit=50`,
      orgId
    );
    setPeriods(json.data ?? []);
    if (!cutoffId && json.data?.length) {
      setCutoffId(json.data[0].id);
    }
  }, [orgId, clientId, cutoffId]);

  useEffect(() => {
    if (!orgId || !clientId) return;
    void loadPeriods().catch((err) => {
      toast.error(err instanceof Error ? err.message : "Failed to load cutoffs");
    });
  }, [orgId, clientId, loadPeriods]);

  const loadParity = useCallback(async () => {
    if (!orgId || !cutoffId) return;
    setBusy(true);
    try {
      const json = await directoryJson<{ data: ParityPayload }>(
        `/api/reports/cutoff-parity?cutoff_period_id=${encodeURIComponent(cutoffId)}`,
        orgId
      );
      setData(json.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Parity load failed");
      setData(null);
    } finally {
      setBusy(false);
    }
  }, [orgId, cutoffId]);

  useEffect(() => {
    if (!cutoffId) return;
    void loadParity();
  }, [cutoffId, loadParity]);

  const filteredRows = useMemo(() => {
    const rows = data?.rows ?? [];
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!needle) return true;
      const hay = [
        row.employee_code,
        row.last_name,
        row.first_name,
        row.legacy_employee_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [data?.rows, statusFilter, q]);

  const selectedPeriod = periods.find((p) => p.id === cutoffId);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Cutoff parity"
          description="GP payroll register vs GREENHRISMAIN for the same cutoff. Differences are diagnostic—they do not block cutover."
        />

        <CardSection title="Cutoff">
          <HStack gap="3" className="mb-4 flex-wrap items-end">
            <div className="min-w-[200px]">
              <Caption className="mb-1 block text-muted-foreground">Client</Caption>
              <BodySmall>{clientName || clientId || "—"}</BodySmall>
            </div>
            <div className="min-w-[220px]">
              <Caption className="mb-1 block text-muted-foreground">Period</Caption>
              <Select value={cutoffId} onValueChange={setCutoffId} disabled={!periods.length}>
                <SelectTrigger>
                  <SelectValue placeholder="Select cutoff" />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.period_start}–{p.period_end} ({p.status})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={busy || !cutoffId}
              onClick={() => void loadParity()}
            >
              Refresh
            </Button>
            {cutoffId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                asChild
              >
                <a
                  href={`/api/reports/cutoff-parity?cutoff_period_id=${encodeURIComponent(cutoffId)}&format=csv`}
                  onClick={(e) => {
                    e.preventDefault();
                    void (async () => {
                      try {
                        const res = await fetch(
                          `/api/reports/cutoff-parity?cutoff_period_id=${encodeURIComponent(cutoffId)}&format=csv`,
                          { headers: { "x-organization-id": orgId } }
                        );
                        if (!res.ok) throw new Error(await res.text());
                        const blob = await res.blob();
                        const href = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = href;
                        a.download = `cutoff-parity-${selectedPeriod?.period_start ?? "export"}.csv`;
                        a.click();
                        URL.revokeObjectURL(href);
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "CSV export failed"
                        );
                      }
                    })();
                  }}
                >
                  Download CSV
                </a>
              </Button>
            ) : null}
          </HStack>

          {data?.legacy_error ? (
            <Caption className="mb-3 block text-amber-700 dark:text-amber-400">
              Legacy: {data.legacy_error}. GP register rows still show for review.
            </Caption>
          ) : data ? (
            <Caption className="mb-3 block text-muted-foreground">
              GREENHRISMAIN client {data.client.legacy_id ?? "—"} ·{" "}
              {data.legacy_row_count} legacy line(s) · register{" "}
              {data.register ? `${data.register.line_count} line(s), ${data.register.status}` : "not built yet"}
            </Caption>
          ) : null}
        </CardSection>

        {data ? (
          <>
            <div className={dbKpiGrid}>
              <MetricCard label="Match" value={String(data.summary.match)} />
              <MetricCard label="Mismatch" value={String(data.summary.mismatch)} />
              <MetricCard label="GP only" value={String(data.summary.gp_only)} />
              <MetricCard
                label="Legacy only"
                value={String(data.summary.legacy_only)}
              />
              <MetricCard
                label="GP gross"
                value={formatCurrency(data.summary.gp_totals.gross)}
              />
              <MetricCard
                label="Legacy gross"
                value={formatCurrency(data.summary.legacy_totals.gross)}
              />
            </div>

            <CardSection title="Line comparison">
              <HStack gap="2" className="mb-3 flex-wrap">
                <Input
                  className="max-w-xs"
                  placeholder="Search name or ID"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  aria-label="Search parity rows"
                />
                {(["all", "match", "mismatch", "gp_only", "legacy_only"] as const).map(
                  (key) => (
                    <Button
                      key={key}
                      type="button"
                      size="sm"
                      variant={statusFilter === key ? "default" : "outline"}
                      onClick={() => setStatusFilter(key)}
                    >
                      {key === "all" ? "All" : STATUS_LABEL[key] ?? key}
                    </Button>
                  )
                )}
                <Caption className="self-center text-muted-foreground">
                  {filteredRows.length} row(s)
                </Caption>
              </HStack>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>GP gross</TableHead>
                      <TableHead>Legacy gross</TableHead>
                      <TableHead>Δ gross</TableHead>
                      <TableHead>GP net</TableHead>
                      <TableHead>Legacy net</TableHead>
                      <TableHead>Δ net</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="py-8 text-center text-muted-foreground">
                          {data.register
                            ? "No rows match this filter."
                            : "Build the payroll register on the cutoff hub to compare amounts."}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.map((row, idx) => (
                        <TableRow key={`${row.employee_code}-${idx}`}>
                          <TableCell>
                            <Badge variant={statusVariant(row.status)}>
                              {STATUS_LABEL[row.status] ?? row.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {row.employee_code ?? row.legacy_employee_id ?? "—"}
                          </TableCell>
                          <TableCell>
                            {row.last_name}, {row.first_name}
                          </TableCell>
                          <TableCell>{formatCurrency(row.gp.gross)}</TableCell>
                          <TableCell>
                            {row.legacy.gross != null
                              ? formatCurrency(row.legacy.gross)
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              row.delta.gross != null &&
                                Math.abs(row.delta.gross) > 0.02 &&
                                "text-destructive"
                            )}
                          >
                            {row.delta.gross != null
                              ? formatCurrency(row.delta.gross)
                              : "—"}
                          </TableCell>
                          <TableCell>{formatCurrency(row.gp.net)}</TableCell>
                          <TableCell>
                            {row.legacy.net != null
                              ? formatCurrency(row.legacy.net)
                              : "—"}
                          </TableCell>
                          <TableCell
                            className={cn(
                              row.delta.net != null &&
                                Math.abs(row.delta.net) > 0.02 &&
                                "text-destructive"
                            )}
                          >
                            {row.delta.net != null
                              ? formatCurrency(row.delta.net)
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardSection>
          </>
        ) : loading || busy ? (
          <Caption className="text-muted-foreground">Loading…</Caption>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
