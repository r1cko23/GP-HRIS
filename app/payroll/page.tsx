"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type ClientOption = {
  id: string;
  name: string;
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

const FREQUENCIES = [
  { value: "semi-monthly", label: "Semi-monthly" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

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
  const clientFromUrl = searchParams.get("client_id") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(clientFromUrl);
  const [rows, setRows] = useState<CutoffPeriod[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [next, setNext] = useState<NextCutoff | null>(null);
  const [formNext, setFormNext] = useState<NextCutoff | null>(null);

  const [formClientId, setFormClientId] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payrollDate, setPayrollDate] = useState("");
  const [payFrequency, setPayFrequency] =
    useState<(typeof FREQUENCIES)[number]["value"]>("semi-monthly");

  const clientName = useMemo(
    () => clients.find((c) => c.id === clientId)?.name ?? "",
    [clientId, clients]
  );

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    if (clientFromUrl) setClientId(clientFromUrl);
  }, [clientFromUrl]);

  const writeParams = useCallback(
    (nextParams: {
      status?: string;
      q?: string;
      offset?: number;
      client_id?: string;
    }) => {
      const params = new URLSearchParams();
      const nextStatus = nextParams.status ?? status;
      const nextQ = nextParams.q !== undefined ? nextParams.q : qFromUrl;
      const nextOffset =
        nextParams.offset !== undefined ? nextParams.offset : offset;
      const nextClient =
        nextParams.client_id !== undefined
          ? nextParams.client_id
          : clientFromUrl || clientId;
      if (nextClient) params.set("client_id", nextClient);
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextOffset > 0) params.set("offset", String(nextOffset));
      const qs = params.toString();
      router.replace(qs ? `/payroll?${qs}` : "/payroll", {
        scroll: false,
      });
    },
    [clientFromUrl, clientId, offset, qFromUrl, router, status]
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
      orgs.find((o) => /organic/i.test(o.name)) ?? pickDirectoryOrg(orgs, "");
    if (!organic) throw new Error("Organic organization not found");
    writeDirectoryOrgId(organic.id);
    setOrgId(organic.id);

    const clientsRes = await directoryJson<{
      data: Array<{ id: string; name: string }>;
    }>(
      `/api/directory/clients?${new URLSearchParams({
        limit: "200",
        offset: "0",
        status: "active",
      })}`,
      organic.id
    );
    const list = (clientsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
    }));
    setClients(list);

    const preferred =
      list.find((c) => c.id === clientFromUrl) ??
      list.find((c) => /green pasture people/i.test(c.name)) ??
      list.find((c) => /green pasture/i.test(c.name)) ??
      list[0];
    if (!preferred) throw new Error("No active clients found");

    setClientId(preferred.id);
    return { orgId: organic.id, clientId: preferred.id };
  }, [clientFromUrl]);

  useEffect(() => {
    if (!clientId || clientFromUrl === clientId) return;
    writeParams({ client_id: clientId, offset: 0 });
  }, [clientFromUrl, clientId, writeParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const boot =
        orgId && clientId && clients.length
          ? { orgId, clientId }
          : await bootstrap();
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
  }, [bootstrap, clientId, clients.length, offset, orgId, qFromUrl, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreateDialog() {
    setFormClientId(clientId);
    setFormNext(next);
    setPeriodStart("");
    setPeriodEnd("");
    setPayrollDate("");
    setPayFrequency("semi-monthly");
    setCreateOpen(true);
  }

  useEffect(() => {
    if (!createOpen || !formClientId || !orgId) return;
    if (formClientId === clientId) {
      setFormNext(next);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const json = await directoryJson<{ next: NextCutoff | null }>(
          `/api/timekeeping/cutoff-periods?${new URLSearchParams({
            client_id: formClientId,
            limit: "1",
            offset: "0",
          })}`,
          orgId
        );
        if (!cancelled) setFormNext(json.next ?? null);
      } catch {
        if (!cancelled) setFormNext(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, createOpen, formClientId, next, orgId]);

  function applyNextWindow() {
    if (!formNext) {
      toast.error("No next calendar window for this client");
      return;
    }
    setPeriodStart(formNext.period_start);
    setPeriodEnd(formNext.period_end);
    setPayrollDate(formNext.payroll_date ?? "");
    if (
      formNext.pay_frequency === "weekly" ||
      formNext.pay_frequency === "semi-monthly" ||
      formNext.pay_frequency === "monthly"
    ) {
      setPayFrequency(formNext.pay_frequency);
    }
  }

  async function createPeriod() {
    if (!formClientId) {
      toast.error("Select a client");
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error("Period start and end are required");
      return;
    }
    if (periodEnd < periodStart) {
      toast.error("Period end must be on or after period start");
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
            client_id: formClientId,
            period_start: periodStart,
            period_end: periodEnd,
            payroll_date: payrollDate || null,
            pay_frequency: payFrequency,
            from_calendar: false,
            source_app: "gp-hris-organic",
            notes: "Opened with selected dates",
          }),
        }
      );
      toast.success("Cutoff created");
      setCreateOpen(false);
      if (formClientId !== clientId) {
        writeParams({ client_id: formClientId, offset: 0 });
      }
      router.push(`/payroll/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const formReady =
    Boolean(formClientId) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    periodEnd >= periodStart;

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
              disabled={!clientId}
              onClick={openCreateDialog}
            >
              New cutoff
            </Button>
          }
        />

        <CardSection title="Cutoff periods">
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,20rem)_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-client">Client</Label>
                <Select
                  value={clientId || undefined}
                  onValueChange={(value) => {
                    setClientId(value);
                    writeParams({ client_id: value, offset: 0 });
                  }}
                  disabled={!clients.length}
                >
                  <SelectTrigger id="payroll-client" className="min-h-10">
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

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
                : "No payroll cutoffs yet for this client. Create one with the dates you need."}
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New cutoff</DialogTitle>
            <DialogDescription>
              Select the client, then enter the payroll period. Dates are not
              locked to the next calendar window.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="create-client">Client</Label>
              <Select
                value={formClientId || undefined}
                onValueChange={setFormClientId}
              >
                <SelectTrigger id="create-client" className="min-h-10">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="period-start">Period start</Label>
                <Input
                  id="period-start"
                  type="date"
                  className="min-h-10"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="period-end">Period end</Label>
                <Input
                  id="period-end"
                  type="date"
                  className="min-h-10"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-date">Payroll date</Label>
                <Input
                  id="payroll-date"
                  type="date"
                  className="min-h-10"
                  value={payrollDate}
                  onChange={(e) => setPayrollDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-frequency">Frequency</Label>
                <Select
                  value={payFrequency}
                  onValueChange={(value) =>
                    setPayFrequency(
                      value as (typeof FREQUENCIES)[number]["value"]
                    )
                  }
                >
                  <SelectTrigger id="pay-frequency" className="min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formNext ? (
              <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <p className="text-muted-foreground">
                  Next calendar window for this client:{" "}
                  <span className="font-medium tabular-nums text-foreground">
                    {formNext.period_start}–{formNext.period_end}
                  </span>
                  {formNext.payroll_date
                    ? ` · payout ${formNext.payroll_date}`
                    : null}
                </p>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto px-0 py-1"
                  onClick={applyNextWindow}
                >
                  Fill these dates
                </Button>
              </div>
            ) : null}
          </div>

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
              disabled={creating || !formReady}
              onClick={() => void createPeriod()}
            >
              {creating ? "Creating…" : "Create cutoff"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
