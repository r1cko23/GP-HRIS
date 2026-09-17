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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  directoryOrgLabel,
  ensureDirectoryOrgId,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryClient,
  readDirectoryOrgId,
  writeDirectoryClient,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import {
  cutoffCreateRequiresBranch,
  cutoffSourceAppForOrganizationName,
  GP_CLIENT_CUTOFF_SOURCE_APP,
  ORGANIC_CUTOFF_SOURCE_APP,
} from "@/lib/timekeeping/cutoff-types";
import { MAIN_CATALOG_SOURCE_APP } from "@/lib/payroll-register/main-summary-to-register-line";
import { canDeleteCutoffPeriod } from "@/lib/timekeeping/cutoff-status";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { HubSegmentedControl } from "@/components/hubs/HubSegmentedControl";

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
  branch_id: string | null;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  pay_frequency: string | null;
  status: string;
  source_app: string | null;
  notes: string | null;
  run_by?: string | null;
  period_kind?: string | null;
};

type ClientOption = {
  id: string;
  name: string;
};

type OrgOption = {
  id: string;
  name: string;
};

type BranchOption = {
  id: string;
  name: string;
};

const PAGE = 25;
const ALL_SITES = "all";
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

function hoursSourceLabel(sourceApp: string | null) {
  if (sourceApp === GP_CLIENT_CUTOFF_SOURCE_APP) return "GP-Client";
  if (sourceApp === MAIN_CATALOG_SOURCE_APP) return "Catalog";
  if (!sourceApp || sourceApp === ORGANIC_CUTOFF_SOURCE_APP) {
    return "Office clock";
  }
  return sourceApp;
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
          description="Cutoff payroll: hours, rates, register, and downloads"
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
  const periodKind = searchParams.get("period_kind") ?? "all";
  const qFromUrl = searchParams.get("q") ?? "";
  const clientFromUrl = searchParams.get("client_id") ?? "";
  const branchFromUrl = searchParams.get("branch_id") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [orgs, setOrgs] = useState<OrgOption[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientId, setClientId] = useState(clientFromUrl);
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [rows, setRows] = useState<CutoffPeriod[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CutoffPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [next, setNext] = useState<NextCutoff | null>(null);
  const [formNext, setFormNext] = useState<NextCutoff | null>(null);

  const [formClientId, setFormClientId] = useState("");
  const [formBranchId, setFormBranchId] = useState("");
  const [formBranches, setFormBranches] = useState<BranchOption[]>([]);
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [payrollDate, setPayrollDate] = useState("");
  const [payFrequency, setPayFrequency] =
    useState<(typeof FREQUENCIES)[number]["value"]>("semi-monthly");

  const selectedOrg = orgs.find((org) => org.id === orgId);
  const isOrganic = /organic/i.test(selectedOrg?.name ?? "");
  const requiresBranch = cutoffCreateRequiresBranch(selectedOrg?.name);
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
      period_kind?: string;
      q?: string;
      offset?: number;
      client_id?: string;
      branch_id?: string;
    }) => {
      const params = new URLSearchParams();
      const nextStatus = nextParams.status ?? status;
      const nextKind = nextParams.period_kind ?? periodKind;
      const nextQ = nextParams.q !== undefined ? nextParams.q : qFromUrl;
      const nextOffset =
        nextParams.offset !== undefined ? nextParams.offset : offset;
      const nextClient =
        nextParams.client_id !== undefined
          ? nextParams.client_id
          : clientFromUrl || clientId;
      const nextBranch =
        nextParams.branch_id !== undefined
          ? nextParams.branch_id
          : branchFromUrl;
      if (nextClient) params.set("client_id", nextClient);
      if (nextBranch) params.set("branch_id", nextBranch);
      if (nextStatus !== "all") params.set("status", nextStatus);
      if (nextKind !== "all") params.set("period_kind", nextKind);
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextOffset > 0) params.set("offset", String(nextOffset));
      const qs = params.toString();
      router.replace(qs ? `/payroll?${qs}` : "/payroll", {
        scroll: false,
      });
    },
    [
      branchFromUrl,
      clientFromUrl,
      clientId,
      offset,
      periodKind,
      qFromUrl,
      router,
      status,
    ]
  );

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (q === qFromUrl) return;
      writeParams({ q, offset: 0 });
    }, 300);
    return () => window.clearTimeout(t);
  }, [q, qFromUrl, writeParams]);

  const bootstrap = useCallback(async () => {
    const loaded = await loadDirectoryOrganizations();
    const org = pickDirectoryOrg(loaded, readDirectoryOrgId());
    if (!org) throw new Error("No organization found");
    writeDirectoryOrgId(org.id);
    setOrgs(loaded);
    setOrgId(org.id);

    const clientsRes = await directoryJson<{
      data: Array<{ id: string; name: string }>;
    }>(
      `/api/directory/clients?${new URLSearchParams({
        limit: "200",
        offset: "0",
        status: "active",
      })}`,
      org.id
    );
    const list = (clientsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
    }));
    setClients(list);

    const remembered = readDirectoryClient();
    const preferred =
      list.find((c) => c.id === clientFromUrl) ??
      list.find((c) => c.id === remembered?.id) ??
      (/organic/i.test(org.name)
        ? list.find((c) => /green pasture people/i.test(c.name)) ??
          list.find((c) => /green pasture/i.test(c.name))
        : undefined) ??
      list[0];
    if (!preferred) throw new Error("No active clients found");

    setClientId(preferred.id);
    writeDirectoryClient({ id: preferred.id, name: preferred.name });
    return { orgId: org.id, clientId: preferred.id };
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
      const params = new URLSearchParams({
        client_id: boot.clientId,
        limit: String(PAGE),
        offset: String(offset),
      });
      if (status !== "all") params.set("status", status);
      if (periodKind !== "all") params.set("period_kind", periodKind);
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (branchFromUrl) params.set("branch_id", branchFromUrl);
      const json = await directoryJson<{
        data: CutoffPeriod[];
        count: number;
        next: NextCutoff | null;
      }>(`/api/timekeeping/cutoff-periods?${params}`, boot.orgId);
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
      setNext(json.next ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cutoffs");
    } finally {
      setLoading(false);
    }
  }, [
    bootstrap,
    branchFromUrl,
    clientId,
    clients.length,
    offset,
    orgId,
    periodKind,
    qFromUrl,
    status,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!orgId || !clientId) {
      setBranches([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const json = await directoryJson<{
          data: Array<{ id: string; name: string }>;
        }>(
          `/api/directory/clients/${clientId}/branches?${new URLSearchParams({
            limit: "200",
            offset: "0",
            status: "active",
          })}`,
          orgId
        );
        if (cancelled) return;
        const list = (json.data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
        }));
        setBranches(list);
        if (
          branchFromUrl &&
          list.length > 0 &&
          !list.some((row) => row.id === branchFromUrl)
        ) {
          writeParams({ branch_id: "", offset: 0 });
        }
      } catch {
        if (!cancelled) setBranches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branchFromUrl, clientId, orgId, writeParams]);

  function switchOrg(nextId: string) {
    if (nextId === orgId) return;
    writeDirectoryOrgId(nextId);
    writeDirectoryClient(null);
    setOrgId(nextId);
    setClients([]);
    setClientId("");
    setBranches([]);
    setRows([]);
    writeParams({ client_id: "", branch_id: "", offset: 0 });
  }

  function openCreateDialog() {
    setFormClientId(clientId);
    const siteFromFilter =
      branchFromUrl && branches.some((row) => row.id === branchFromUrl)
        ? branchFromUrl
        : "";
    setFormBranchId(
      siteFromFilter ||
        (requiresBranch && branches[0] ? branches[0].id : "")
    );
    setFormNext(next);
    setPeriodStart("");
    setPeriodEnd("");
    setPayrollDate("");
    setPayFrequency("semi-monthly");
    setCreateOpen(true);
  }

  useEffect(() => {
    if (!createOpen || !formClientId || !orgId) {
      setFormBranches([]);
      return;
    }
    if (formClientId === clientId) {
      setFormBranches(branches);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const json = await directoryJson<{
          data: Array<{ id: string; name: string }>;
        }>(
          `/api/directory/clients/${formClientId}/branches?${new URLSearchParams({
            limit: "200",
            offset: "0",
            status: "active",
          })}`,
          orgId
        );
        if (cancelled) return;
        setFormBranches(
          (json.data ?? []).map((row) => ({ id: row.id, name: row.name }))
        );
      } catch {
        if (!cancelled) setFormBranches([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [branches, clientId, createOpen, formClientId, orgId]);

  useEffect(() => {
    if (!createOpen || !requiresBranch) return;
    if (formBranchId && formBranches.some((row) => row.id === formBranchId)) {
      return;
    }
    if (formBranches[0]) setFormBranchId(formBranches[0].id);
  }, [createOpen, formBranchId, formBranches, requiresBranch]);

  useEffect(() => {
    if (!createOpen || !formClientId || !orgId) return;
    let cancelled = false;
    void (async () => {
      try {
        const params = new URLSearchParams({
          client_id: formClientId,
          limit: "1",
          offset: "0",
        });
        if (formBranchId) params.set("branch_id", formBranchId);
        const json = await directoryJson<{ next: NextCutoff | null }>(
          `/api/timekeeping/cutoff-periods?${params}`,
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
  }, [createOpen, formBranchId, formClientId, orgId]);

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
    if (requiresBranch && !formBranchId) {
      toast.error("Select a site");
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
            branch_id: requiresBranch ? formBranchId || null : null,
            period_start: periodStart,
            period_end: periodEnd,
            payroll_date: payrollDate || null,
            pay_frequency: payFrequency,
            from_calendar: false,
            source_app: cutoffSourceAppForOrganizationName(selectedOrg?.name),
            notes: "Opened with selected dates",
          }),
        }
      );
      toast.success("Cutoff created");
      setCreateOpen(false);
      if (formClientId !== clientId || formBranchId !== branchFromUrl) {
        writeParams({
          client_id: formClientId,
          branch_id: formBranchId,
          offset: 0,
        });
      }
      router.push(`/payroll/${json.data.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Create failed");
    } finally {
      setCreating(false);
    }
  }

  async function deletePeriod() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await directoryJson(
        `/api/timekeeping/cutoff-periods/${deleteTarget.id}`,
        orgId,
        { method: "DELETE" }
      );
      toast.success("Cutoff deleted");
      setDeleteTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const formReady =
    Boolean(formClientId) &&
    (!requiresBranch || Boolean(formBranchId)) &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    periodEnd >= periodStart;
  const filteredEmpty = Boolean(
    qFromUrl || status !== "all" || branchFromUrl
  );
  const headerDescription = clientName
    ? isOrganic
      ? `${clientName} · hours, rates, register, and downloads`
      : `${clientName} · GP-Client hours, register, and downloads`
    : isOrganic
      ? "Organic cutoff payroll: hours, rates, register, and downloads"
      : "Deployed cutoff payroll: GP-Client hours, register, and downloads";

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          title="Payroll"
          description={headerDescription}
          actions={
            <Button
              type="button"
              disabled={!clientId || (requiresBranch && branches.length === 0)}
              onClick={openCreateDialog}
            >
              New cutoff
            </Button>
          }
        />

        <CardSection title="Cutoff periods">
          <div className="space-y-3">
            {orgs.length > 1 ? (
              <HubSegmentedControl
                ariaLabel="Organization"
                value={orgId}
                onChange={(id) => switchOrg(id)}
                options={orgs.map((org) => ({
                  id: org.id,
                  label: directoryOrgLabel(org.name),
                }))}
              />
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="payroll-client">Client</Label>
                <Select
                  value={clientId || undefined}
                  onValueChange={(value) => {
                    setClientId(value);
                    const selected = clients.find((c) => c.id === value);
                    if (selected) {
                      writeDirectoryClient({
                        id: selected.id,
                        name: selected.name,
                      });
                    }
                    writeParams({
                      client_id: value,
                      branch_id: "",
                      offset: 0,
                    });
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
              {requiresBranch && branches.length > 0 ? (
                <div className="space-y-1.5">
                  <Label htmlFor="payroll-site">Site</Label>
                  <Select
                    value={branchFromUrl || ALL_SITES}
                    onValueChange={(value) => {
                      writeParams({
                        branch_id: value === ALL_SITES ? "" : value,
                        offset: 0,
                      });
                    }}
                  >
                    <SelectTrigger id="payroll-site" className="min-h-10">
                      <SelectValue placeholder="All sites" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_SITES}>All sites</SelectItem>
                      {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>

            <HubSegmentedControl
              ariaLabel="Status"
              size="sm"
              value={status}
              onChange={(id) => writeParams({ status: id, offset: 0 })}
              options={STATUS_FILTERS.map((filter) => ({
                id: filter.value,
                label: filter.label,
              }))}
            />
            <HubSegmentedControl
              ariaLabel="Kind"
              size="sm"
              value={periodKind}
              onChange={(id) => writeParams({ period_kind: id, offset: 0 })}
              options={[
                { id: "all", label: "All kinds" },
                { id: "regular", label: "Regular" },
                { id: "adjustment", label: "Adjustment" },
              ]}
            />
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
              {filteredEmpty
                ? "No cutoff periods match this filter."
                : isOrganic
                  ? "No payroll cutoffs yet for this client. Create one with the dates you need."
                  : "No payroll cutoffs yet for this site. Open a cutoff, then Ingest hours from a Validated GP-Client timesheet."}
            </p>
          ) : (
            <div className={dbTableShell}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Period</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Hours</TableHead>
                    <TableHead>Payroll date</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Run by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium tabular-nums">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {row.period_start}–{row.period_end}
                          {row.period_kind === "adjustment" ? (
                            <Badge variant="outline">Adjustment</Badge>
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        {branches.find((b) => b.id === row.branch_id)?.name ??
                          (row.branch_id ? "Site" : "—")}
                      </TableCell>
                      <TableCell>{hoursSourceLabel(row.source_app)}</TableCell>
                      <TableCell className="tabular-nums">
                        {row.payroll_date ?? "—"}
                      </TableCell>
                      <TableCell>{row.pay_frequency ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={statusBadge(row.status)}>
                          {statusLabel(row.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>{row.run_by ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <HStack gap="1" className="justify-end">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/payroll/${row.id}`}>Open</Link>
                          </Button>
                          {canDeleteCutoffPeriod(row.status) ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="text-destructive hover:bg-destructive/10"
                              onClick={() => setDeleteTarget(row)}
                            >
                              Delete
                            </Button>
                          ) : null}
                        </HStack>
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
                    disabled={offset === 0 || loading}
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
                    disabled={offset + PAGE >= count || loading}
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
              {requiresBranch
                ? "Select the client and site, then enter the payroll period. GP-Client Validated ingest can also open this cutoff."
                : "Select the client, then enter the payroll period. Dates are not locked to the next calendar window."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="create-client">Client</Label>
              <Select
                value={formClientId || undefined}
                onValueChange={(value) => {
                  setFormClientId(value);
                  setFormBranchId("");
                }}
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

            {requiresBranch ? (
              <div className="space-y-1.5">
                <Label htmlFor="create-site">Site</Label>
                <Select
                  value={formBranchId || undefined}
                  onValueChange={setFormBranchId}
                >
                  <SelectTrigger id="create-site" className="min-h-10">
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    {formBranches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

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

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this cutoff?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.period_start}–${deleteTarget.period_end} will be removed, including any ingested hours. You can create a new cutoff for the same dates.`
                : "This cutoff will be removed."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void deletePeriod();
              }}
            >
              {deleting ? "Deleting…" : "Delete cutoff"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
