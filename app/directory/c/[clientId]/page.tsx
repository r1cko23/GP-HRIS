"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
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
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import { DirectoryStatusBadge } from "@/components/directory/DirectoryStatusBadge";
import { DirectoryAddEmployeeDialog } from "@/components/directory/DirectoryAddEmployeeDialog";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { directoryStatusMeta } from "@/lib/directory/employees";
import { cn } from "@/lib/utils";

type Client = { id: string; name: string; status: string };
type Employee = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  mobile: string | null;
  hire_date: string | null;
  last_payroll_end?: string | null;
  days_since_last_payroll?: number | null;
  lifecycle_flag?: string;
  lifecycle_label?: string;
  lifecycle_hint?: string;
  is_current_engagement?: boolean;
  superseded_by?: string | null;
  position?: { job_title: string; department?: string | null } | null;
  branch?: { name: string; location?: string | null } | null;
};

const PAGE = 50;

const LIFECYCLE_FILTERS: Array<{
  value: string;
  label: string;
  title: string;
}> = [
  {
    value: "needs_review",
    label: "Needs review",
    title:
      "Active but missing from the latest released cutoff — verify leave / resign / still working",
  },
  {
    value: "active",
    label: "Active",
    title: directoryStatusMeta("active").payroll,
  },
  {
    value: "for_release",
    label: "For release",
    title: directoryStatusMeta("for_release").payroll,
  },
  {
    value: "float",
    label: "Float",
    title: directoryStatusMeta("float").payroll,
  },
  {
    value: "barred",
    label: "Barred",
    title: directoryStatusMeta("barred").payroll,
  },
  {
    value: "for_verification",
    label: "For verification",
    title: directoryStatusMeta("for_verification").payroll,
  },
  {
    value: "inactive",
    label: "Inactive",
    title: "Separated — shows days since last payroll for cleanup",
  },
  { value: "all", label: "All", title: "All current engagements" },
];

const FILTER_VALUES = new Set(LIFECYCLE_FILTERS.map((f) => f.value));

function displayName(employee: Employee) {
  return `${employee.last_name}, ${employee.first_name}${
    employee.middle_name ? ` ${employee.middle_name}` : ""
  }`;
}

function branchLabel(employee: Employee) {
  if (!employee.branch?.name) return "—";
  return [employee.branch.name, employee.branch.location]
    .filter(Boolean)
    .join(" · ");
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

export default function DirectoryClientRosterPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";

  const statusParam = searchParams.get("status") ?? "needs_review";
  const status = FILTER_VALUES.has(statusParam) ? statusParam : "needs_review";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = parseOffset(searchParams.get("offset"));
  const includeHistory =
    searchParams.get("history") === "1" ||
    searchParams.get("history") === "true";

  const [client, setClient] = useState<Client | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [clientLatestPayroll, setClientLatestPayroll] = useState<string | null>(
    null
  );

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  const writeListParams = useCallback(
    (next: {
      status?: string;
      q?: string;
      offset?: number;
      includeHistory?: boolean;
    }) => {
      const paramsNext = new URLSearchParams();
      const nextStatus = next.status ?? status;
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      const nextHistory =
        next.includeHistory !== undefined ? next.includeHistory : includeHistory;

      paramsNext.set("status", nextStatus);
      if (nextQ.trim()) paramsNext.set("q", nextQ.trim());
      if (nextOffset > 0) paramsNext.set("offset", String(nextOffset));
      if (nextHistory) paramsNext.set("history", "1");

      const qs = paramsNext.toString();
      router.replace(`/directory/c/${clientId}?${qs}`, { scroll: false });
    },
    [clientId, includeHistory, offset, qFromUrl, router, status]
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
      setOrganizationId(org);
      const lifecycle =
        status === "needs_review" ||
        status === "for_release" ||
        status === "inactive"
          ? status
          : null;
      const statusFilter = !lifecycle && status !== "all" ? status : null;
      const [clientJson, empJson] = await Promise.all([
        directoryJson<{ data: Client }>(
          `/api/directory/clients/${clientId}`,
          org
        ),
        directoryJson<{
          data: Employee[];
          count: number;
          meta?: { client_latest_payroll_end?: string | null };
        }>(
          `/api/directory/employees?${new URLSearchParams({
            client_id: clientId,
            limit: String(PAGE),
            offset: String(offset),
            ...(lifecycle ? { lifecycle } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(qFromUrl.trim() ? { q: qFromUrl.trim() } : {}),
            ...(includeHistory ? { include_history: "true" } : {}),
          })}`,
          org
        ),
      ]);
      setClient(clientJson.data);
      writeDirectoryClient({
        id: clientJson.data.id,
        name: clientJson.data.name,
      });
      setEmployees(empJson.data ?? []);
      setCount(empJson.count ?? 0);
      setClientLatestPayroll(empJson.meta?.client_latest_payroll_end ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load roster");
    } finally {
      setLoading(false);
    }
  }, [clientId, includeHistory, offset, qFromUrl, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const fileHref = (employeeId: string) =>
    `/directory/c/${clientId}/${employeeId}`;

  const filteredEmpty = Boolean(qFromUrl.trim() || status !== "all");
  const emptyMessage = (() => {
    if (qFromUrl.trim()) {
      return "No people match this search for the current filter.";
    }
    if (status === "needs_review") {
      return "Queue clear — no active people missing from the latest released cutoff.";
    }
    if (status === "all") {
      return "No people on file for this client yet.";
    }
    return `No people in “${LIFECYCLE_FILTERS.find((f) => f.value === status)?.label ?? status}”. Try All or another filter.`;
  })();

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <DirectoryBreadcrumb
              items={[
                { label: "Directory", href: "/directory" },
                { label: client?.name ?? "Client" },
              ]}
            />
          }
          title="Employee management"
          description={
            client
              ? `Roster and 201 files for ${client.name}. Person masters live here; bundy enrollment is under Time → Bundy clock access.`
              : "Roster and 201 files for this client."
          }
          actions={
            organizationId && client ? (
              <div className={dbHeaderActions}>
                <Button asChild variant="outline" className={dbHeaderButton}>
                  <Link href={`/directory/clients/${clientId}`}>
                    Client settings
                  </Link>
                </Button>
                <DirectoryAddEmployeeDialog
                  organizationId={organizationId}
                  clientId={clientId}
                  clientName={client.name}
                  triggerClassName={dbHeaderButton}
                  onCreated={() => void load()}
                />
              </div>
            ) : null
          }
        />

        <CardSection
          title="Roster"
          description={
            includeHistory
              ? "All 201 files including superseded rehire codes."
              : clientLatestPayroll
                ? `Source of truth for this client · latest released cutoff end ${clientLatestPayroll}. Needs review = active but not on that cutoff.`
                : "Source of truth for headcount and status. Sync last payroll to enable stale detection."
          }
        >
          <div className="space-y-3">
            <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={includeHistory}
                onChange={(e) => {
                  writeListParams({
                    includeHistory: e.target.checked,
                    offset: 0,
                  });
                }}
                className="size-4 rounded border-border"
              />
              Include superseded rehire files
            </label>
            <div
              className="flex flex-wrap gap-1.5"
              role="tablist"
              aria-label="Employee lifecycle"
            >
              {LIFECYCLE_FILTERS.map((filter) => {
                const selected = status === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    title={filter.title}
                    onClick={() => {
                      writeListParams({ status: filter.value, offset: 0 });
                    }}
                    className={cn(
                      "min-h-9 rounded-md px-2.5 text-xs font-medium sm:min-h-8",
                      selected
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-foreground hover:bg-muted"
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {status === "needs_review"
                ? "HR cleanup queue: still working, maternity/leave, or resign — open the 201 lifecycle strip. Do not Add employee for returnees."
                : status === "for_release"
                  ? directoryStatusMeta("for_release").payroll
                  : status === "inactive"
                    ? "Inactive people — use Rehire on the 201 to return (same Employee ID)."
                    : status === "all"
                      ? "Search by name, live ID, or prior code. Returnees → Rehire on the 201."
                      : `${directoryStatusMeta(status).short} ${directoryStatusMeta(status).payroll}`}
            </p>

            <HStack
              justify="between"
              align="end"
              gap="4"
              className="w-full flex-col sm:flex-row sm:items-end"
            >
              <div className="relative w-full min-w-0 flex-1 sm:max-w-md">
                <Icon
                  name="MagnifyingGlass"
                  size={IconSizes.sm}
                  className="absolute left-3 top-2.5 text-muted-foreground"
                />
                <Input
                  type="search"
                  placeholder="Search by name, employee ID, or prior code..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-9"
                  aria-label="Search by name, employee ID, or prior code"
                />
              </div>
              <HStack
                gap="2"
                align="center"
                className="w-full flex-wrap justify-start sm:w-auto sm:justify-end"
              >
                <Badge variant="secondary" className="font-normal">
                  {loading
                    ? "…"
                    : count === 0
                      ? "0 people"
                      : `Showing ${showingFrom.toLocaleString()}–${showingTo.toLocaleString()} of ${count.toLocaleString()}`}
                </Badge>
              </HStack>
            </HStack>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : count === 0 ? (
            <div className="space-y-2 py-8 text-center">
              <p className="text-muted-foreground">{emptyMessage}</p>
              {filteredEmpty && status === "needs_review" && !qFromUrl.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => writeListParams({ status: "all", offset: 0 })}
                >
                  View all people
                </Button>
              ) : null}
            </div>
          ) : (
            <>
              <DbMobileBlock>
                <div className="space-y-2">
                  {employees.map((employee) => (
                    <Link
                      key={employee.id}
                      href={fileHref(employee.id)}
                      className={cn(dbMobileListCard, "block transition hover:bg-muted/40")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary">
                            {displayName(employee)}
                          </p>
                          <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                            {employee.employee_code ?? "—"}
                          </p>
                        </div>
                        <DirectoryStatusBadge
                          status={employee.status}
                          needsReview={employee.lifecycle_flag === "needs_review"}
                        />
                      </div>
                      <div className="mt-2 space-y-1">
                        <DashboardMobileField
                          label="Position"
                          value={employee.position?.job_title || "—"}
                        />
                        <DashboardMobileField
                          label="Branch"
                          value={branchLabel(employee)}
                        />
                        <DashboardMobileField
                          label="Last payroll"
                          value={
                            employee.last_payroll_end
                              ? `${employee.last_payroll_end}${
                                  employee.days_since_last_payroll != null
                                    ? ` · ${employee.days_since_last_payroll}d ago`
                                    : ""
                                }`
                              : "—"
                          }
                        />
                        {employee.lifecycle_flag === "needs_review" ? (
                          <p className="text-[11px] text-amber-800">
                            {employee.lifecycle_hint}
                          </p>
                        ) : null}
                      </div>
                      <p className="mt-3 text-right text-xs font-medium text-primary">
                        Open 201 file →
                      </p>
                    </Link>
                  ))}
                </div>
              </DbMobileBlock>

              <DbDesktopBlock className={dbTableShell}>
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow className="h-10">
                      <TableHead className="w-[110px] whitespace-nowrap py-2 text-xs font-semibold">
                        Employee ID
                      </TableHead>
                      <TableHead className="min-w-[180px] py-2 text-xs font-semibold">
                        Employee
                      </TableHead>
                      <TableHead className="min-w-[160px] py-2 text-xs font-semibold">
                        Position
                      </TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap py-2 text-xs font-semibold">
                        Department
                      </TableHead>
                      <TableHead className="min-w-[160px] py-2 text-xs font-semibold">
                        Branch
                      </TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap py-2 text-xs font-semibold">
                        Last payroll
                      </TableHead>
                      <TableHead className="w-[110px] whitespace-nowrap py-2 text-xs font-semibold">
                        Status
                      </TableHead>
                      <TableHead className="w-[110px] whitespace-nowrap py-2 text-right text-xs font-semibold">
                        Actions
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((employee) => (
                      <TableRow
                        key={employee.id}
                        className="h-auto cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          router.push(fileHref(employee.id));
                        }}
                      >
                        <TableCell className="whitespace-nowrap py-2 font-semibold">
                          {employee.employee_code ?? "—"}
                        </TableCell>
                        <TableCell className="min-w-[180px] py-2">
                          <span className="break-words text-sm font-medium text-foreground">
                            {displayName(employee)}
                          </span>
                        </TableCell>
                        <TableCell className="min-w-[160px] py-2 text-sm">
                          {employee.position?.job_title ? (
                            <Badge
                              variant="outline"
                              className="whitespace-normal border-border bg-muted text-[11px] leading-tight text-foreground"
                            >
                              {employee.position.job_title}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="min-w-[120px] py-2 text-sm text-muted-foreground">
                          {employee.position?.department || "—"}
                        </TableCell>
                        <TableCell className="min-w-[160px] py-2 text-sm">
                          {branchLabel(employee)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-xs tabular-nums text-muted-foreground">
                          {employee.last_payroll_end ? (
                            <span title={employee.lifecycle_hint}>
                              {employee.last_payroll_end}
                              {employee.days_since_last_payroll != null
                                ? ` · ${employee.days_since_last_payroll}d`
                                : ""}
                            </span>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell className="py-2">
                          <HStack gap="1" align="center" className="flex-wrap">
                            <DirectoryStatusBadge
                              status={employee.status}
                              needsReview={
                                employee.lifecycle_flag === "needs_review"
                              }
                            />
                            {employee.is_current_engagement === false ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal text-muted-foreground"
                              >
                                Superseded
                              </Badge>
                            ) : null}
                          </HStack>
                        </TableCell>
                        <TableCell
                          className="py-2 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button size="sm" variant="outline" asChild className="h-9 px-3">
                            <Link href={fileHref(employee.id)}>
                              201 file
                            </Link>
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
                  <span className="text-sm text-muted-foreground">
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
