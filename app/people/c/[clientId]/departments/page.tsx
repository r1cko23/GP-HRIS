"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import {
  dbMobileListCard,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryClientEmployeeSwitch } from "@/components/directory/DirectoryClientEmployeeSwitch";
import { DirectorySegmentedControl } from "@/components/directory/DirectorySegmentedControl";
import { HubBackLink } from "@/components/hubs/HubBackLink";
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

const STATUS_VALUES = new Set(STATUS_FILTERS.map((row) => row.value));

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
  const status = STATUS_VALUES.has(statusParam) ? statusParam : "active";
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
        <DashboardPageHeader
          above={
            <div className="space-y-1">
              <HubBackLink href="/people" label="People" />
              <DirectoryBreadcrumb
                items={[
                  { label: "People", href: "/people" },
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
              size="sm"
              value={status}
              onChange={(id) => writeListParams({ status: id, offset: 0 })}
              options={STATUS_FILTERS.map((filter) => ({
                id: filter.value,
                label: filter.label,
              }))}
            />
            <div className="relative w-full min-w-0 flex-1 sm:max-w-md">
              <Icon
                name="MagnifyingGlass"
                size={IconSizes.sm}
                className="absolute left-3 top-2.5 text-muted-foreground"
              />
              <Input
                type="search"
                placeholder="Search store or prepared by..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
                aria-label="Search departments"
              />
            </div>
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

              <DbDesktopBlock className={cn(dbTableShell, "mt-3")}>
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="min-w-[180px] py-2 text-xs font-semibold">
                        Store
                      </TableHead>
                      <TableHead className="min-w-[140px] py-2 text-xs font-semibold">
                        Prepared by
                      </TableHead>
                      <TableHead className="w-[100px] whitespace-nowrap py-2 text-xs font-semibold">
                        Legacy ID
                      </TableHead>
                      <TableHead className="w-[90px] py-2 text-xs font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="w-[140px] py-2 text-right text-xs font-semibold">
                        CSM link
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {departments.map((row) => (
                      <TableRow key={row.id} className="h-auto">
                        <TableCell className="py-2 text-sm font-medium">
                          {formatProseDisplay(row.name)}
                        </TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">
                          {formatProseDisplay(row.prepared_by)}
                        </TableCell>
                        <TableCell className="py-2 font-mono text-xs tabular-nums">
                          {row.legacy_id ?? "—"}
                        </TableCell>
                        <TableCell className="py-2">
                          <Badge
                            variant={row.is_active ? "secondary" : "outline"}
                            className="font-normal"
                          >
                            {row.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 px-3"
                            onClick={() => void copyId(row.id)}
                          >
                            Copy ID
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
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
