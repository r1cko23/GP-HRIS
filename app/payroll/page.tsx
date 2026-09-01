"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSection } from "@/components/ui/card-section";
import { HStack } from "@/components/ui/stack";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type NextCutoff = {
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  pay_frequency: string;
  window: "first" | "second";
};

type CutoffPeriod = {
  id: string;
  client_id: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  pay_frequency: string | null;
  status: string;
  source_app: string | null;
  notes: string | null;
};

const PAGE = 25;
const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "pending_audit", label: "Pending audit" },
  { value: "approved", label: "Approved" },
  { value: "posted", label: "Posted" },
  { value: "cancelled", label: "Cancelled" },
];

function statusBadge(status: string) {
  if (status === "posted") return "default" as const;
  if (status === "approved") return "secondary" as const;
  if (status === "cancelled") return "destructive" as const;
  return "outline" as const;
}

function statusLabel(status: string) {
  return (
    STATUS_FILTERS.find((item) => item.value === status)?.label ??
    status.replace(/_/g, " ")
  );
}

export default function PayrollCutoffPeriodsPage() {
  return (
    <Suspense fallback={<PayrollCutoffPeriodsFallback />}>
      <PayrollCutoffPeriodsContent />
    </Suspense>
  );
}

function PayrollCutoffPeriodsFallback() {
  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          title="Payroll"
          description="Organic cutoff payroll: hours, rates, register, and downloads"
        />
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    </DashboardLayout>
  );
}

function PayrollCutoffPeriodsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") ?? "all";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [orgId, setOrgId] = useState("");
  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [rows, setRows] = useState<CutoffPeriod[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [next, setNext] = useState<NextCutoff | null>(null);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const writeParams = useCallback(
    (next: { status?: string; q?: string; offset?: number }) => {
      const params = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextOffset > 0) params.set("offset", String(nextOffset));
      const qs = params.toString();
      router.replace(qs ? `/payroll?${qs}` : "/payroll", {
        scroll: false,
      });
    },
    [offset, qFromUrl, router, status]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (q === qFromUrl) return;
      writeParams({ q, offset: 0 });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, qFromUrl, writeParams]);

  const bootstrap = useCallback(async () => {
    const orgs = await loadDirectoryOrganizations();
    const organic =
      orgs.find((o) => /organic/i.test(o.name)) ??
      pickDirectoryOrg(orgs, "");
    if (!organic) throw new Error("Organic organization not found");
    writeDirectoryOrgId(organic.id);
    setOrgId(organic.id);
    const clients = await directoryJson<{
      data: Array<{ id: string; name: string }>;
    }>(
      `/api/directory/clients?${new URLSearchParams({
        limit: "50",
        offset: "0",
        status: "active",
      })}`,
      organic.id
    );
    const list = clients.data ?? [];
    const house =
      list.find((c) => /green pasture people/i.test(c.name)) ??
      list.find((c) => /green pasture/i.test(c.name)) ??
      list[0];
    if (!house) throw new Error("Organic house client not found");
    setClientId(house.id);
    setClientName(house.name);
    return { orgId: organic.id, clientId: house.id };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const boot = orgId && clientId ? { orgId, clientId } : await bootstrap();
      await ensureDirectoryOrgId();
      const json = await directoryJson<{
        data: CutoffPeriod[];
        count: number;
        next: NextCutoff | null;
      }>(
        `/api/timekeeping/cutoff-periods?${new URLSearchParams({
          client_id: boot.clientId,
          limit: String(PAGE),
          offset: String(offset),
          ...(status !== "all" ? { status } : {}),
          ...(qFromUrl.trim() ? { q: qFromUrl.trim() } : {}),
        })}`,
        boot.orgId
      );
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
      setNext(json.next ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cutoffs");
    } finally {
      setLoading(false);
    }
  }, [bootstrap, clientId, offset, orgId, qFromUrl, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPeriod() {
    if (!clientId) {
      toast.error("Organic house client is not loaded");
      return;
    }
    setCreating(true);
    try {
      const json = await directoryJson<{ data: CutoffPeriod }>(
        `/api/timekeeping/cutoff-periods`,
        orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            from_calendar: true,
            source_app: "gp-hris-organic",
          }),
        }
      );
      toast.success("Cutoff opened from client pay calendar");
      setCreateOpen(false);
      router.push(`/payroll/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          title="Payroll"
          description={
            clientName
              ? `${clientName} · hours, rates, register, and downloads`
              : "Organic cutoff payroll: hours, rates, register, and downloads"
          }
          actions={
            <Button
              type="button"
              disabled={!next}
              onClick={() => setCreateOpen(true)}
            >
              {next
                ? `Open ${next.period_start}–${next.period_end}`
                : "No next cutoff"}
            </Button>
          }
        />

        <CardSection title="Cutoff periods">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Status">
              {STATUS_FILTERS.map((filter) => {
                const selected = status === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() =>
                      writeParams({ status: filter.value, offset: 0 })
                    }
                    className={cn(
                      "min-h-9 rounded-md px-2.5 text-xs font-medium",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background hover:bg-muted"
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <HStack gap="2" align="center" className="flex-wrap">
              <Input
                className="min-h-10 max-w-md"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by client name"
                aria-label="Search cutoffs"
              />
              <Badge variant="secondary" className="font-normal tabular-nums">
                {loading
                  ? "…"
                  : count === 0
                    ? "0 periods"
                    : `Showing ${showingFrom}–${showingTo} of ${count}`}
              </Badge>
            </HStack>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : count === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {qFromUrl || status !== "all"
                ? "No cutoff periods match this filter."
                : "No payroll cutoffs yet. Create one to aggregate attendance hours."}
            </p>
          ) : (
            <div className={dbTableShell}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Payroll date</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Open</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium tabular-nums">
                        {row.period_start}–{row.period_end}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.payroll_date ?? "—"}
                      </TableCell>
                      <TableCell>{row.pay_frequency ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/payroll/${row.id}`}>Open</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {count > PAGE ? (
                <HStack gap="2" className="pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() =>
                      writeParams({ offset: Math.max(0, offset - PAGE) })
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE >= count}
                    onClick={() => writeParams({ offset: offset + PAGE })}
                  >
                    Next
                  </Button>
                </HStack>
              ) : null}
            </div>
          )}
        </CardSection>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Open next cutoff</DialogTitle>
            <DialogDescription>
              Dates come from the {clientName || "client"} pay calendar. Time
              will fill hours for Engagements overlapping this window.
            </DialogDescription>
          </DialogHeader>
          {next ? (
            <dl className="grid gap-3 py-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Period</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {next.period_start}–{next.period_end}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Payroll date</dt>
                <dd className="font-medium tabular-nums text-foreground">
                  {next.payroll_date ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Window</dt>
                <dd className="font-medium text-foreground">
                  {next.window === "first" ? "First kinsena" : "Second kinsena"}
                  {next.window === "first"
                    ? " · WTAX only (SSS / PhilHealth / Pag-IBIG on the second)"
                    : " · statutory remittance this cutoff"}
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={creating || !next}
              onClick={() => void createPeriod()}
            >
              {creating ? "Opening…" : "Open cutoff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
