"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
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

export default function OrganicCutoffPeriodsPage() {
  return (
    <Suspense fallback={<OrganicCutoffPeriodsFallback />}>
      <OrganicCutoffPeriodsContent />
    </Suspense>
  );
}

function OrganicCutoffPeriodsFallback() {
  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          title="Organic cutoffs"
          description="Organic house cutoff periods for bundy aggregation and payroll."
        />
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    </DashboardLayout>
  );
}

function OrganicCutoffPeriodsContent() {
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
  const [form, setForm] = useState({
    period_start: "",
    period_end: "",
    payroll_date: "",
    pay_frequency: "semi-monthly",
    notes: "",
  });

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
      router.replace(qs ? `/cutoff-periods?${qs}` : "/cutoff-periods", {
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
    if (!form.period_start || !form.period_end) {
      toast.error("Period start and end are required");
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
            period_start: form.period_start,
            period_end: form.period_end,
            payroll_date: form.payroll_date || null,
            pay_frequency: form.pay_frequency,
            source_app: "gp-hris-organic",
            notes: form.notes || null,
          }),
        }
      );
      toast.success("Cutoff period created");
      setCreateOpen(false);
      router.push(`/cutoff-periods/${json.data.id}`);
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
          title="Organic cutoffs"
          description={
            clientName
              ? `Bundy → hours → payroll register for ${clientName}. Weekly payslips remain available until cutover.`
              : "Organic house cutoff periods for bundy aggregation and payroll."
          }
          actions={
            <Button type="button" onClick={() => setCreateOpen(true)}>
              New cutoff
            </Button>
          }
        />

        <CardSection title="Cutoff periods" description="Search, filter, and open a period hub.">
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
              <Badge variant="secondary" className="font-normal">
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
                : "No Organic cutoffs yet. Create one to aggregate bundy hours."}
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
                        {row.period_start} → {row.period_end}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.payroll_date ?? "—"}
                      </TableCell>
                      <TableCell>{row.pay_frequency ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(row.status)}>
                          {row.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/cutoff-periods/${row.id}`}>Hub</Link>
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
            <DialogTitle>New Organic cutoff</DialogTitle>
            <DialogDescription>
              Creates a draft period for {clientName || "the Organic house client"}.
              Aggregate bundy punches next.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ps">Period start</Label>
              <Input
                id="ps"
                type="date"
                value={form.period_start}
                onChange={(e) =>
                  setForm((f) => ({ ...f, period_start: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pe">Period end</Label>
              <Input
                id="pe"
                type="date"
                value={form.period_end}
                onChange={(e) =>
                  setForm((f) => ({ ...f, period_end: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pd">Payroll date</Label>
              <Input
                id="pd"
                type="date"
                value={form.payroll_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, payroll_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                value={form.notes}
                onChange={(e) =>
                  setForm((f) => ({ ...f, notes: e.target.value }))
                }
              />
            </div>
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
              disabled={creating}
              onClick={() => void createPeriod()}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
