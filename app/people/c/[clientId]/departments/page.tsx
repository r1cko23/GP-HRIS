"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ListFilterSuggest,
  type ListSuggestOption,
} from "@/components/ListFilterSuggest";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { CardSection } from "@/components/ui/card-section";
import { HStack } from "@/components/ui/stack";
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
import { cn } from "@/lib/utils";
import { formatProseDisplay } from "@/lib/directory/display-value";
import { toast } from "sonner";

type Department = {
  id: string;
  name: string;
  prepared_by?: string | null;
  is_active: boolean;
  legacy_id?: number | null;
};

const PAGE = 50;

const STATUS_FILTERS = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "all", label: "All" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

async function copyId(id: string) {
  await navigator.clipboard.writeText(id);
  toast.success("Directory ID copied for CSM");
}

export default function DirectoryClientDepartmentsPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";

  const statusParam = searchParams.get("status") ?? "active";
  const status: StatusFilter = STATUS_FILTERS.some(
    (filter) => filter.value === statusParam
  )
    ? (statusParam as StatusFilter)
    : "active";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = parseOffset(searchParams.get("offset"));

  const [client, setClient] = useState<DirectoryClientRow | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const writeListParams = useCallback(
    (next: { status?: string; q?: string; offset?: number }) => {
      const paramsNext = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      if (nextStatus !== "active") paramsNext.set("status", nextStatus);
      if (nextQ.trim()) paramsNext.set("q", nextQ.trim());
      if (nextOffset > 0) paramsNext.set("offset", String(nextOffset));
      const qs = paramsNext.toString();
      router.replace(
        qs
          ? `/people/c/${clientId}/departments?${qs}`
          : `/people/c/${clientId}/departments`,
        { scroll: false }
      );
    },
    [clientId, offset, qFromUrl, router, status]
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
      const [clientJson, deptJson] = await Promise.all([
        directoryJson<{ data: DirectoryClientRow }>(
          `/api/directory/clients/${clientId}`,
          org
        ),
        directoryJson<{ data: Department[]; count: number }>(
          `/api/directory/clients/${clientId}/departments?${new URLSearchParams({
            limit: String(PAGE),
            offset: String(offset),
            ...(status !== "all" ? { status } : {}),
            ...(qFromUrl.trim() ? { q: qFromUrl.trim() } : {}),
          })}`,
          org
        ),
      ]);
      setClient(clientJson.data);
      writeDirectoryClient({
        id: clientJson.data.id,
        name: clientJson.data.name,
      });
      setDepartments(deptJson.data ?? []);
      setCount(deptJson.count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load departments");
    } finally {
      setLoading(false);
    }
  }, [clientId, offset, qFromUrl, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const filteredEmpty = Boolean(qFromUrl.trim() || status !== "all");

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
                  { label: "Departments" },
                ]}
              />
            </div>
          }
          title="Departments"
        />

        {client ? (
          <DirectoryClientEmployeeSwitch
            className="mb-4"
            clientId={clientId}
            clientName={client.name}
            active="departments"
          />
        ) : null}

        <CardSection title="Stores and locations">
          <p className="mb-3 max-w-prose text-sm text-muted-foreground">
            GREENHRISMAIN Department and Groupings. CSM binds each outlet to the
            Directory ID — not the payroll branch.
          </p>
          <HStack
            justify="between"
            align="end"
            gap="3"
            className="w-full flex-col sm:flex-row sm:items-end"
          >
            <DirectorySegmentedControl
              ariaLabel="Department status"
              variant="segment"
              size="sm"
              value={status}
              onChange={(id) => writeListParams({ status: id, offset: 0 })}
              options={STATUS_FILTERS.map((filter) => ({
                id: filter.value,
                label: filter.label,
              }))}
            />
            <ListFilterSuggest
              className="w-full min-w-0 flex-1 sm:max-w-md"
              value={q}
              onValueChange={setQ}
              onSelect={(opt) => {
                setQ(opt.value);
                writeListParams({ q: opt.value, offset: 0 });
              }}
              placeholder="Search store or prepared by..."
              aria-label="Search departments"
              fetchSuggestions={async (query) => {
                const org = await ensureDirectoryOrgId();
                const deptJson = await directoryJson<{
                  data: Department[];
                }>(
                  `/api/directory/clients/${clientId}/departments?${new URLSearchParams(
                    {
                      limit: "10",
                      offset: "0",
                      q: query,
                      ...(status !== "all" ? { status } : {}),
                    }
                  )}`,
                  org
                );
                return (deptJson.data ?? []).map(
                  (dept): ListSuggestOption => ({
                    id: dept.id,
                    primary: dept.name,
                    secondary: dept.prepared_by
                      ? `Prepared by ${dept.prepared_by}`
                      : dept.is_active
                        ? "Active"
                        : "Inactive",
                    value: dept.name,
                    matchText: dept.prepared_by ?? undefined,
                  })
                );
              }}
            />
            <Badge variant="secondary" className="font-normal">
              {loading
                ? "…"
                : count === 0
                  ? "0 stores"
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
                title={filteredEmpty ? "No matches" : "No departments on file"}
                detail={
                  filteredEmpty
                    ? "No stores match this search or filter."
                    : "Import dbo.Department from GREENHRISMAIN (etl:directory) to give CSM a Directory ID per store."
                }
                action={
                  filteredEmpty ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => writeListParams({ status: "all", q: "", offset: 0 })}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <>
              <DbMobileBlock>
                <div className="mt-3 space-y-2">
                  {departments.map((row) => (
                    <div key={row.id} className={cn(dbMobileListCard)}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-foreground">
                          {formatProseDisplay(row.name)}
                        </p>
                        <Badge
                          variant={row.is_active ? "secondary" : "outline"}
                          className="font-normal"
                        >
                          {row.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField
                          label="Prepared by"
                          value={formatProseDisplay(row.prepared_by)}
                        />
                        <DashboardMobileField
                          label="Legacy ID"
                          value={row.legacy_id != null ? String(row.legacy_id) : "—"}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-3 h-9"
                        onClick={() => void copyId(row.id)}
                      >
                        Copy Directory ID
                      </Button>
                    </div>
                  ))}
                </div>
              </DbMobileBlock>

              <DbDesktopBlock className="mt-3">
                <DataTable<Department>
                  rows={departments}
                  rowKey={(row) => row.id}
                  minWidthClassName="min-w-full"
                  columns={[
                    {
                      id: "store",
                      header: "Store",
                      headerClassName: "min-w-[180px]",
                      className: "text-sm font-medium",
                      cell: (row) => formatProseDisplay(row.name),
                    },
                    {
                      id: "prepared-by",
                      header: "Prepared by",
                      headerClassName: "min-w-[140px]",
                      className: "text-sm text-muted-foreground",
                      cell: (row) => formatProseDisplay(row.prepared_by),
                    },
                    {
                      id: "legacy-id",
                      header: "Legacy ID",
                      align: "right",
                      headerClassName: "w-[100px] whitespace-nowrap",
                      className: "font-mono text-xs tabular-nums",
                      cell: (row) => row.legacy_id ?? "—",
                    },
                    {
                      id: "status",
                      header: "Status",
                      align: "center",
                      headerClassName: "w-[90px]",
                      cell: (row) => (
                        <StatusBadge tone={row.is_active ? "success" : "neutral"}>
                          {row.is_active ? "Active" : "Inactive"}
                        </StatusBadge>
                      ),
                    },
                    {
                      id: "csm-link",
                      header: "CSM link",
                      align: "right",
                      headerClassName: "w-[140px]",
                      cell: (row) => (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gp-row-actions h-9 px-3"
                          onClick={() => void copyId(row.id)}
                        >
                          Copy ID
                        </Button>
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
                    Showing {showingFrom.toLocaleString()}–{showingTo.toLocaleString()} of{" "}
                    {count.toLocaleString()}
                    {pages > 1 ? ` · Page ${page} of ${pages}` : ""}
                  </span>
                </HStack>
              ) : null}
            </>
          )}
        </CardSection>
      </div>
    </DashboardLayout>
  );
}
