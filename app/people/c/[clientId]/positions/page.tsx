"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ListFilterSuggest,
  type ListSuggestOption,
} from "@/components/ListFilterSuggest";
import { DataTable } from "@/components/ui/data-table";
import { CardSection } from "@/components/ui/card-section";
import { HStack } from "@/components/ui/stack";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import {
  dbMobileListCard,
  dbPageWrapper,
} from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryClientEmployeeSwitch } from "@/components/directory/DirectoryClientEmployeeSwitch";
import { DirectorySegmentedControl } from "@/components/directory/DirectorySegmentedControl";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
import type { DirectoryClientRow } from "@/lib/directory/client-form";
import { canApproveClientIndustry } from "@/lib/directory/position-approval";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { cn } from "@/lib/utils";
import { formatProseDisplay } from "@/lib/directory/display-value";
import { toast } from "sonner";

type Position = {
  id: string;
  job_title: string;
  department?: string | null;
  group_name?: string | null;
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
  is_active: boolean;
  approval_status?: string | null;
  rejection_reason?: string | null;
  legacy_id?: number | null;
};

const PAGE = 50;

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

const APPROVAL_FILTERS = [
  { value: "all", label: "All approvals" },
  { value: "draft", label: "Draft" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];
type ApprovalFilter = (typeof APPROVAL_FILTERS)[number]["value"];

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function formatRate(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  });
}

function approvalBadge(status: string | null | undefined) {
  const s = status ?? "draft";
  if (s === "approved") return { label: "Approved", variant: "secondary" as const };
  if (s === "pending") return { label: "Pending", variant: "default" as const };
  if (s === "rejected") return { label: "Rejected", variant: "destructive" as const };
  return { label: "Draft", variant: "outline" as const };
}

export default function DirectoryClientPositionsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const { hasCapability, capabilityKeys } = usePermissions();

  const statusParam = searchParams.get("status") ?? "active";
  const status: StatusFilter = STATUS_FILTERS.some(
    (filter) => filter.value === statusParam
  )
    ? (statusParam as StatusFilter)
    : "active";
  const approvalParam = searchParams.get("approval") ?? "all";
  const approval: ApprovalFilter = APPROVAL_FILTERS.some(
    (filter) => filter.value === approvalParam
  )
    ? (approvalParam as ApprovalFilter)
    : "all";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = parseOffset(searchParams.get("offset"));

  const [client, setClient] = useState<DirectoryClientRow | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    job_title: "",
    payroll_daily_rate: "",
    billing_daily_rate: "",
    department: "",
  });

  const canCreate = hasCapability("fn:positions.create");
  const canUpdate = hasCapability("fn:positions.update");
  const industry =
    client?.industry === "HOTEL" ? "HOTEL" : ("NON-HOTEL" as const);
  const canApprove = canApproveClientIndustry({
    capabilityKeys,
    industry,
  });

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const writeListParams = useCallback(
    (next: {
      status?: string;
      approval?: string;
      q?: string;
      offset?: number;
    }) => {
      const paramsNext = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextApproval = next.approval ?? approval;
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      if (nextStatus !== "active") paramsNext.set("status", nextStatus);
      if (nextApproval !== "all") paramsNext.set("approval", nextApproval);
      if (nextQ.trim()) paramsNext.set("q", nextQ.trim());
      if (nextOffset > 0) paramsNext.set("offset", String(nextOffset));
      const qs = paramsNext.toString();
      router.replace(
        qs
          ? `/people/c/${clientId}/positions?${qs}`
          : `/people/c/${clientId}/positions`,
        { scroll: false }
      );
    },
    [approval, clientId, offset, qFromUrl, router, status]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (q === qFromUrl) return;
      writeListParams({ q, offset: 0 });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, qFromUrl, writeListParams]);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const org = await ensureDirectoryOrgId();
      const listParams = new URLSearchParams({
        client_id: clientId,
        limit: String(PAGE),
        offset: String(offset),
        ...(status !== "all" ? { status } : {}),
        ...(approval !== "all" ? { approval } : {}),
        ...(qFromUrl.trim() ? { q: qFromUrl.trim() } : {}),
      });
      const [clientJson, posJson] = await Promise.all([
        directoryJson<{ data: DirectoryClientRow }>(
          `/api/directory/clients/${clientId}`,
          org
        ),
        directoryJson<{ data: Position[]; count: number }>(
          `/api/directory/positions?${listParams}`,
          org
        ),
      ]);
      setClient(clientJson.data);
      writeDirectoryClient({
        id: clientJson.data.id,
        name: clientJson.data.name,
      });
      setPositions(posJson.data ?? []);
      setCount(posJson.count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load positions");
    } finally {
      setLoading(false);
    }
  }, [approval, clientId, offset, qFromUrl, status]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPosition(submit: boolean) {
    if (!draft.job_title.trim()) {
      toast.error("Job title is required");
      return;
    }
    setSaving(true);
    try {
      const org = await ensureDirectoryOrgId();
      await directoryJson("/api/directory/positions", org, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          job_title: draft.job_title.trim(),
          department: draft.department.trim() || null,
          payroll_daily_rate: draft.payroll_daily_rate.trim() || null,
          billing_daily_rate: draft.billing_daily_rate.trim() || null,
          submit,
        }),
      });
      toast.success(submit ? "Position submitted for approval" : "Draft saved");
      setCreateOpen(false);
      setDraft({
        job_title: "",
        payroll_daily_rate: "",
        billing_daily_rate: "",
        department: "",
      });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function submitExisting(id: string) {
    try {
      const org = await ensureDirectoryOrgId();
      await directoryJson(`/api/directory/positions/${id}`, org, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submit: true }),
      });
      toast.success("Submitted for approval");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submit failed");
    }
  }

  async function review(id: string, decision: "approve" | "reject") {
    let rejection_reason: string | null = null;
    if (decision === "reject") {
      rejection_reason = window.prompt("Rejection reason")?.trim() || null;
      if (!rejection_reason) {
        toast.error("Rejection reason is required");
        return;
      }
    }
    try {
      const org = await ensureDirectoryOrgId();
      await directoryJson(`/api/directory/positions/${id}/review`, org, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejection_reason }),
      });
      toast.success(decision === "approve" ? "Position approved" : "Position rejected");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  }

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const filteredEmpty = Boolean(
    qFromUrl.trim() || status !== "all" || approval !== "all"
  );

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <PageHeader
          above={
            <div className="space-y-1">
              <DirectoryBreadcrumb
                items={[
                  { label: "Clients", href: "/people/clients" },
                  {
                    label: client?.name ?? "Client",
                    href: client ? `/people/clients/${clientId}` : undefined,
                  },
                  { label: "Positions" },
                ]}
              />
            </div>
          }
          title="Positions"
          actions={
            canCreate ? (
              <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                Add position
              </Button>
            ) : null
          }
        />

        {client ? (
          <DirectoryClientEmployeeSwitch
            className="mb-4"
            clientId={clientId}
            clientName={client.name}
            active="positions"
          />
        ) : null}

        <CardSection title="Job titles and daily rates">
          <HStack
            justify="between"
            align="end"
            gap="3"
            className="w-full flex-col sm:flex-row sm:items-end"
          >
            <div className="flex w-full flex-col gap-2 sm:max-w-xl">
              <DirectorySegmentedControl
                ariaLabel="Position status"
                variant="segment"
                size="sm"
                value={status}
                onChange={(id) => writeListParams({ status: id, offset: 0 })}
                options={STATUS_FILTERS.map((filter) => ({
                  id: filter.value,
                  label: filter.label,
                }))}
              />
              <DirectorySegmentedControl
                ariaLabel="Approval status"
                variant="segment"
                size="sm"
                value={approval}
                onChange={(id) => writeListParams({ approval: id, offset: 0 })}
                options={APPROVAL_FILTERS.map((filter) => ({
                  id: filter.value,
                  label: filter.label,
                }))}
              />
            </div>
            <ListFilterSuggest
              className="w-full min-w-0 flex-1 sm:max-w-md"
              value={q}
              onValueChange={setQ}
              onSelect={(opt) => {
                setQ(opt.value);
                writeListParams({ q: opt.value, offset: 0 });
              }}
              placeholder="Search title, department, or group..."
              aria-label="Search positions"
              fetchSuggestions={async (query) => {
                const org = await ensureDirectoryOrgId();
                const posJson = await directoryJson<{ data: Position[] }>(
                  `/api/directory/positions?${new URLSearchParams({
                    client_id: clientId,
                    limit: "10",
                    offset: "0",
                    q: query,
                    ...(status !== "all" ? { status } : {}),
                    ...(approval !== "all" ? { approval } : {}),
                  })}`,
                  org
                );
                return (posJson.data ?? []).map(
                  (row): ListSuggestOption => ({
                    id: row.id,
                    primary: row.job_title,
                    secondary: row.approval_status ?? undefined,
                    value: row.job_title,
                  })
                );
              }}
            />
            <Badge variant="secondary" className="font-normal">
              {loading
                ? "…"
                : count === 0
                  ? "0 positions"
                  : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${count.toLocaleString()}`}
            </Badge>
          </HStack>

          {error ? (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : count === 0 ? (
            <div className="mt-4">
              <HubEmptyState
                title={filteredEmpty ? "No matches" : "No positions on file"}
                detail={
                  filteredEmpty
                    ? "No positions match this search or filter."
                    : "Add a position with payroll and billing rates, then submit for AM approval."
                }
                action={
                  filteredEmpty ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        writeListParams({
                          status: "all",
                          approval: "all",
                          q: "",
                          offset: 0,
                        })
                      }
                    >
                      Clear filters
                    </Button>
                  ) : canCreate ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setCreateOpen(true)}
                    >
                      Add position
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              <DbMobileBlock>
                <div className="mt-3 space-y-2">
                  {positions.map((row) => {
                    const badge = approvalBadge(row.approval_status);
                    return (
                      <div key={row.id} className={cn(dbMobileListCard)}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">
                            {formatProseDisplay(row.job_title)}
                          </p>
                          <Badge variant={badge.variant} className="font-normal">
                            {badge.label}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1">
                          <DashboardMobileField
                            label="Payroll / day"
                            value={formatRate(row.payroll_daily_rate)}
                          />
                          <DashboardMobileField
                            label="Billing / day"
                            value={formatRate(row.billing_daily_rate)}
                          />
                        </div>
                        <HStack gap="2" className="mt-3 flex-wrap">
                          {canUpdate &&
                          (row.approval_status === "draft" ||
                            row.approval_status === "rejected") ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => void submitExisting(row.id)}
                            >
                              Submit
                            </Button>
                          ) : null}
                          {canApprove && row.approval_status === "pending" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => void review(row.id, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void review(row.id, "reject")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </HStack>
                      </div>
                    );
                  })}
                </div>
              </DbMobileBlock>

              <DbDesktopBlock className="mt-3">
                <DataTable<Position>
                  rows={positions}
                  rowKey={(row) => row.id}
                  minWidthClassName="min-w-full"
                  columns={[
                    {
                      id: "position",
                      header: "Position",
                      headerClassName: "min-w-[180px]",
                      className: "text-sm font-medium",
                      cell: (row) => formatProseDisplay(row.job_title),
                    },
                    {
                      id: "payroll-rate",
                      header: "Payroll / day",
                      align: "right",
                      headerClassName: "min-w-[110px]",
                      className: "font-mono text-sm tabular-nums",
                      cell: (row) => formatRate(row.payroll_daily_rate),
                    },
                    {
                      id: "billing-rate",
                      header: "Billing / day",
                      align: "right",
                      headerClassName: "min-w-[110px]",
                      className:
                        "font-mono text-sm tabular-nums text-muted-foreground",
                      cell: (row) => formatRate(row.billing_daily_rate),
                    },
                    {
                      id: "approval",
                      header: "Approval",
                      align: "center",
                      headerClassName: "w-[110px]",
                      cell: (row) => {
                        const badge = approvalBadge(row.approval_status);
                        return (
                          <Badge variant={badge.variant} className="font-normal">
                            {badge.label}
                          </Badge>
                        );
                      },
                    },
                    {
                      id: "actions",
                      header: "Actions",
                      align: "right",
                      headerClassName: "w-[200px]",
                      cell: (row) => (
                        <HStack gap="2" justify="end" className="flex-wrap">
                          {canUpdate &&
                          (row.approval_status === "draft" ||
                            row.approval_status === "rejected") ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              className="gp-row-actions h-9"
                              onClick={() => void submitExisting(row.id)}
                            >
                              Submit
                            </Button>
                          ) : null}
                          {canApprove && row.approval_status === "pending" ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                className="gp-row-actions h-9"
                                onClick={() => void review(row.id, "approve")}
                              >
                                Approve
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="gp-row-actions h-9"
                                onClick={() => void review(row.id, "reject")}
                              >
                                Reject
                              </Button>
                            </>
                          ) : null}
                        </HStack>
                      ),
                    },
                  ]}
                />
              </DbDesktopBlock>

              {count > 0 ? (
                <HStack gap="2" align="center" className="flex-wrap pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset === 0 || loading}
                    onClick={() =>
                      writeListParams({ offset: Math.max(0, offset - PAGE) })
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={offset + PAGE >= count || loading}
                    onClick={() => writeListParams({ offset: offset + PAGE })}
                  >
                    Next
                  </Button>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    Showing {showingFrom.toLocaleString()}–
                    {showingTo.toLocaleString()} of {count.toLocaleString()}
                    {pages > 1 ? ` · Page ${page} of ${pages}` : ""}
                  </span>
                </HStack>
              ) : null}
            </>
          )}
        </CardSection>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add position</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pos-title">Job title</Label>
              <Input
                id="pos-title"
                value={draft.job_title}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, job_title: e.target.value }))
                }
                autoCapitalizeWords
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="pos-pay">Payroll daily rate</Label>
                <Input
                  id="pos-pay"
                  inputMode="decimal"
                  value={draft.payroll_daily_rate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      payroll_daily_rate: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-bill">Billing daily rate</Label>
                <Input
                  id="pos-bill"
                  inputMode="decimal"
                  value={draft.billing_daily_rate}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      billing_daily_rate: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pos-dept">Department (optional)</Label>
              <Input
                id="pos-dept"
                value={draft.department}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, department: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => void createPosition(false)}
            >
              Save draft
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => void createPosition(true)}
            >
              Save &amp; submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
