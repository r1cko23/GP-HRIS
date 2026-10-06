"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import {
  ListFilterSuggest,
  type ListSuggestOption,
} from "@/components/ListFilterSuggest";
import { MetricCard } from "@/components/ui/metric-card";
import { Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { DirectoryNavIconButton } from "@/components/directory/DirectoryNavIconButton";
import { DirectorySegmentedControl } from "@/components/directory/DirectorySegmentedControl";
import { DirectoryStatusBadge } from "@/components/directory/DirectoryStatusBadge";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
import type { ClientActiveSummary } from "@/lib/directory/client-active-summary";
import {
  directoryJson,
  directoryOrgLabel,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryClient,
  readDirectoryOrgId,
  writeDirectoryClient,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import {
  directoryDirectLabel,
  directoryLegalPrefix,
} from "@/lib/directory/site-label";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  canPeopleClients,
  canPeopleEmployees,
  type PeopleSurface,
} from "@/lib/access/people-pages";
import {
  canApproveClientIndustry,
  parseClientIndustry,
} from "@/lib/directory/position-approval";
import { toast } from "sonner";

type Org = { id: string; name: string };
type Client = {
  id: string;
  name: string;
  status: string;
  pay_frequency: string | null;
  employee_count?: number;
  active_count?: number;
  for_release_count?: number;
  inactive_count?: number;
  needs_review_count?: number;
  duplicate_review_count?: number;
  latest_payroll_end?: string | null;
};

type QueueEmployee = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  client_id: string | null;
  lifecycle_flag?: string;
  client?: { id: string; name: string } | Array<{ id: string; name: string }> | null;
};

type PendingPosition = {
  id: string;
  client_id: string;
  job_title: string;
  department: string | null;
  payroll_daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  approval_status: string | null;
  client?:
    | { id: string; name: string; industry: string | null }
    | Array<{ id: string; name: string; industry: string | null }>
    | null;
};

type WorkCounts = {
  needs_review: number;
  missing_statutory: number;
  missing_documents: number;
  incomplete_201: number;
  for_verification: number;
};

type ClientWorkCounts = {
  pending_positions: number;
};

const PAGE = 50;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

const CLIENT_QUEUES = [
  { id: "clients", label: "All clients" },
  {
    id: "pending_positions",
    label: "For verification",
    countKey: "pending_positions" as const,
  },
] as const;

type ClientQueue = (typeof CLIENT_QUEUES)[number]["id"];
const CLIENT_QUEUE_IDS = new Set<string>(
  CLIENT_QUEUES.map((queue) => queue.id)
);
const DEFAULT_CLIENT_QUEUE: ClientQueue = "clients";

const EMPLOYEE_QUEUES = [
  {
    id: "for_verification",
    label: "For verification",
    countKey: "for_verification",
  },
  { id: "needs_review", label: "Needs review", countKey: "needs_review" },
  { id: "missing_statutory", label: "Missing IDs", countKey: "missing_statutory" },
  {
    id: "missing_documents",
    label: "Missing documents",
    countKey: "missing_documents",
  },
  { id: "incomplete_201", label: "Incomplete 201", countKey: "incomplete_201" },
] as const;

type EmployeeQueue = (typeof EMPLOYEE_QUEUES)[number]["id"];
const EMPLOYEE_QUEUE_IDS = new Set<string>(
  EMPLOYEE_QUEUES.map((queue) => queue.id)
);
const DEFAULT_EMPLOYEE_QUEUE: EmployeeQueue = "for_verification";

function nestedPositionClient(client: PendingPosition["client"]) {
  if (!client) return null;
  return Array.isArray(client) ? client[0] ?? null : client;
}

function parseOffset(raw: string | null): number {
  const n = Number(raw ?? 0);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function payLabel(freq: string | null) {
  if (freq === "weekly") return "Weekly";
  if (freq === "monthly") return "Monthly";
  if (freq === "semi-monthly") return "Semi-monthly";
  return null;
}

function remember(client: { id: string; name: string }) {
  writeDirectoryClient(client);
}

function nestedClientName(client: QueueEmployee["client"]) {
  if (!client) return "—";
  const raw = Array.isArray(client) ? client[0]?.name : client.name;
  if (!raw) return "—";
  return directoryDirectLabel(raw);
}

function displayName(employee: QueueEmployee) {
  return `${employee.last_name}, ${employee.first_name}${
    employee.middle_name ? ` ${employee.middle_name}` : ""
  }`;
}

function personHref(employee: QueueEmployee, queue: EmployeeQueue) {
  if (!employee.client_id) return "/people/employees";
  const base = `/people/c/${employee.client_id}/${employee.id}`;
  if (queue === "needs_review" || queue === "for_verification") {
    return `${base}?focus=lifecycle`;
  }
  return `${base}/onboard`;
}

export function PeopleDirectoryView({ surface }: { surface: PeopleSurface }) {
  return (
    <Suspense fallback={<PeopleDirectoryFallback surface={surface} />}>
      <PeopleDirectoryContent surface={surface} />
    </Suspense>
  );
}

function PeopleDirectoryFallback({ surface }: { surface: PeopleSurface }) {
  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title={surface === "clients" ? "Clients" : "Employees"}
        />
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    </DashboardLayout>
  );
}

function PeopleDirectoryContent({ surface }: { surface: PeopleSurface }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    capabilityKeys: rawCapabilityKeys,
    hasCapability,
    canRead,
    loading: permissionsLoading,
  } = usePermissions();
  // Legacy accounts with no grant rows still open People via role module read.
  const capabilityKeys =
    rawCapabilityKeys.length > 0
      ? rawCapabilityKeys
      : canRead("employees")
        ? ["page:employees"]
        : [];
  const orgHint = searchParams.get("org");
  const queueParam = searchParams.get("queue");
  const showClientsTab = canPeopleClients(capabilityKeys);
  const showEmployeesTab = canPeopleEmployees(capabilityKeys);
  const canOpenSurface =
    surface === "clients" ? showClientsTab : showEmployeesTab;
  const canAddClient =
    hasCapability("fn:clients.update") ||
    (rawCapabilityKeys.length === 0 && canRead("employees"));
  const canAddEmployee =
    hasCapability("fn:employees.create") ||
    showEmployeesTab ||
    (rawCapabilityKeys.length === 0 && canRead("employees"));

  const clientQueue: ClientQueue = (
    surface === "clients" &&
    queueParam &&
    CLIENT_QUEUE_IDS.has(queueParam)
      ? queueParam
      : DEFAULT_CLIENT_QUEUE
  ) as ClientQueue;
  const employeeQueue: EmployeeQueue = (
    surface === "employees" &&
    queueParam &&
    EMPLOYEE_QUEUE_IDS.has(queueParam)
      ? queueParam
      : DEFAULT_EMPLOYEE_QUEUE
  ) as EmployeeQueue;
  const statusParam = searchParams.get("status") ?? "active";
  const status = STATUS_FILTERS.some((filter) => filter.value === statusParam)
    ? statusParam
    : "active";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = parseOffset(searchParams.get("offset"));

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [people, setPeople] = useState<QueueEmployee[]>([]);
  const [pendingPositions, setPendingPositions] = useState<PendingPosition[]>(
    []
  );
  const [counts, setCounts] = useState<WorkCounts | null>(null);
  const [clientCounts, setClientCounts] = useState<ClientWorkCounts | null>(
    null
  );
  const [activeSummary, setActiveSummary] = useState<ClientActiveSummary | null>(
    null
  );
  const [count, setCount] = useState(0);
  const [q, setQ] = useState(qFromUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rememberedClient, setRememberedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setQ(qFromUrl);
  }, [qFromUrl]);

  useEffect(() => {
    setRememberedClient(readDirectoryClient());
  }, [orgId]);

  const writeListParams = useCallback(
    (next: {
      queue?: ClientQueue | EmployeeQueue;
      status?: string;
      q?: string;
      offset?: number;
    }) => {
      const paramsNext = new URLSearchParams();
      if (orgHint) paramsNext.set("org", orgHint);
      const basePath =
        surface === "employees" ? "/people/employees" : "/people/clients";
      if (surface === "employees") {
        const nextQueue =
          (next.queue as EmployeeQueue | undefined) ?? employeeQueue;
        paramsNext.set("queue", nextQueue);
      } else {
        const nextQueue =
          (next.queue as ClientQueue | undefined) ?? clientQueue;
        paramsNext.set("queue", nextQueue);
        if (nextQueue === "clients") {
          const nextStatus = next.status ?? status;
          paramsNext.set("status", nextStatus);
        }
      }
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      if (nextQ.trim()) paramsNext.set("q", nextQ.trim());
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      if (nextOffset > 0) paramsNext.set("offset", String(nextOffset));
      const qs = paramsNext.toString();
      router.replace(qs ? `${basePath}?${qs}` : basePath, { scroll: false });
    },
    [
      clientQueue,
      employeeQueue,
      offset,
      orgHint,
      qFromUrl,
      router,
      status,
      surface,
    ]
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (q === qFromUrl) return;
      writeListParams({ q, offset: 0 });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [q, qFromUrl, writeListParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadDirectoryOrganizations();
        if (cancelled) return;
        setOrgs(loaded);
        const org = pickDirectoryOrg(
          loaded,
          orgHint ? "" : readDirectoryOrgId(),
          orgHint
        );
        if (!org) {
          setLoading(false);
          return;
        }
        writeDirectoryOrgId(org.id);
        setOrgId(org.id);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load organizations"
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgHint]);

  const loadWorkCounts = useCallback(async () => {
    if (!orgId) return;
    if (surface === "employees") {
      try {
        const json = await directoryJson<{ data: WorkCounts }>(
          "/api/directory/work-queues",
          orgId
        );
        setCounts(json.data);
      } catch {
        setCounts(null);
      }
      return;
    }
    if (surface === "clients") {
      try {
        const json = await directoryJson<{ count: number }>(
          `/api/directory/positions?${new URLSearchParams({
            approval: "pending",
            limit: "1",
            offset: "0",
          })}`,
          orgId
        );
        setClientCounts({ pending_positions: json.count ?? 0 });
      } catch {
        setClientCounts(null);
      }
    }
  }, [orgId, surface]);

  const loadList = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      if (surface === "clients" && clientQueue === "clients") {
        const clientJson = await directoryJson<{
          data: Client[];
          count: number;
          summary?: ClientActiveSummary;
        }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: String(PAGE),
            offset: String(offset),
            ...(status !== "all" ? { status } : {}),
            ...(qFromUrl.trim() ? { q: qFromUrl.trim() } : {}),
          })}`,
          orgId
        );
        setClients(clientJson.data ?? []);
        setPeople([]);
        setPendingPositions([]);
        setCount(clientJson.count ?? 0);
        setActiveSummary(clientJson.summary ?? null);
      } else if (surface === "clients" && clientQueue === "pending_positions") {
        setActiveSummary(null);
        const params = new URLSearchParams({
          approval: "pending",
          limit: String(PAGE),
          offset: String(offset),
        });
        if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
        const posJson = await directoryJson<{
          data: PendingPosition[];
          count: number;
        }>(`/api/directory/positions?${params}`, orgId);
        setPendingPositions(posJson.data ?? []);
        setClients([]);
        setPeople([]);
        setCount(posJson.count ?? 0);
        setClientCounts({ pending_positions: posJson.count ?? 0 });
      } else {
        setActiveSummary(null);
        const params = new URLSearchParams({
          limit: String(PAGE),
          offset: String(offset),
        });
        if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
        if (employeeQueue === "needs_review") {
          params.set("lifecycle", "needs_review");
        }
        if (employeeQueue === "for_verification") {
          params.set("status", "for_verification");
        }
        if (employeeQueue === "missing_statutory") {
          params.set("statutory_filter", "missing");
        }
        if (employeeQueue === "missing_documents") {
          params.set("document_filter", "missing");
        }
        if (employeeQueue === "incomplete_201") {
          params.set("completeness_filter", "incomplete");
        }
        const empJson = await directoryJson<{
          data: QueueEmployee[];
          count: number;
        }>(`/api/directory/employees?${params}`, orgId);
        setPeople(empJson.data ?? []);
        setClients([]);
        setPendingPositions([]);
        setCount(empJson.count ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [clientQueue, employeeQueue, offset, orgId, qFromUrl, status, surface]);

  const fetchSearchSuggestions = useCallback(
    async (query: string): Promise<ListSuggestOption[]> => {
      if (!orgId) return [];
      if (surface === "clients" && clientQueue === "clients") {
        const clientJson = await directoryJson<{
          data: Client[];
        }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: "10",
            offset: "0",
            q: query,
            ...(status !== "all" ? { status } : {}),
          })}`,
          orgId
        );
        return (clientJson.data ?? []).map((client): ListSuggestOption => {
          const directName = directoryDirectLabel(client.name);
          const active = client.active_count ?? 0;
          const peopleCount = client.employee_count ?? 0;
          return {
            id: client.id,
            primary: directName,
            secondary: `${client.status === "active" ? "Active" : "Inactive"} · ${active.toLocaleString()} active · ${peopleCount.toLocaleString()} people`,
            value: directName,
            matchText: client.name,
          };
        });
      }
      if (surface === "clients" && clientQueue === "pending_positions") {
        const posJson = await directoryJson<{ data: PendingPosition[] }>(
          `/api/directory/positions?${new URLSearchParams({
            approval: "pending",
            limit: "10",
            offset: "0",
            q: query,
          })}`,
          orgId
        );
        return (posJson.data ?? []).map((row): ListSuggestOption => {
          const client = nestedPositionClient(row.client);
          return {
            id: row.id,
            primary: row.job_title,
            secondary: client?.name
              ? directoryDirectLabel(client.name)
              : undefined,
            value: row.job_title,
          };
        });
      }
      const params = new URLSearchParams({
        limit: "10",
        offset: "0",
        q: query,
      });
      if (employeeQueue === "needs_review") {
        params.set("lifecycle", "needs_review");
      }
      if (employeeQueue === "for_verification") {
        params.set("status", "for_verification");
      }
      if (employeeQueue === "missing_statutory") {
        params.set("statutory_filter", "missing");
      }
      if (employeeQueue === "missing_documents") {
        params.set("document_filter", "missing");
      }
      if (employeeQueue === "incomplete_201") {
        params.set("completeness_filter", "incomplete");
      }
      const empJson = await directoryJson<{
        data: QueueEmployee[];
      }>(`/api/directory/employees?${params}`, orgId);
      return (empJson.data ?? []).map((employee): ListSuggestOption => {
        const name = displayName(employee);
        const code = employee.employee_code?.trim() || "—";
        const clientName = nestedClientName(employee.client);
        return {
          id: employee.id,
          primary: `${name} · ${code}`,
          secondary: clientName !== "—" ? clientName : undefined,
          value: name,
          matchText: code,
        };
      });
    },
    [clientQueue, employeeQueue, orgId, status, surface]
  );

  async function reviewPendingPosition(
    id: string,
    decision: "approve" | "reject"
  ) {
    let rejection_reason: string | null = null;
    if (decision === "reject") {
      rejection_reason = window.prompt("Rejection reason")?.trim() || null;
      if (!rejection_reason) {
        toast.error("Rejection reason is required");
        return;
      }
    }
    try {
      await directoryJson(`/api/directory/positions/${id}/review`, orgId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, rejection_reason }),
      });
      toast.success(
        decision === "approve" ? "Position approved" : "Position rejected"
      );
      await Promise.all([loadList(), loadWorkCounts()]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    }
  }
  useEffect(() => {
    void loadWorkCounts();
  }, [loadWorkCounts]);

  useEffect(() => {
    if (permissionsLoading) return;
    void loadList();
  }, [loadList, permissionsLoading]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const selectedOrg = orgs.find((org) => org.id === orgId);
  const isOrganic = /organic/i.test(selectedOrg?.name ?? "");
  const filteredEmpty = Boolean(
    qFromUrl ||
      (surface === "clients" &&
        clientQueue === "clients" &&
        status !== "all") ||
      (surface === "clients" && clientQueue === "pending_positions") ||
      surface === "employees"
  );
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);

  function switchOrg(nextId: string) {
    if (nextId === orgId) return;
    writeDirectoryClient(null);
    writeDirectoryOrgId(nextId);
    setOrgId(nextId);
    writeListParams({ offset: 0 });
  }

  const emptyTitle =
    surface === "clients" && clientQueue === "pending_positions"
      ? qFromUrl
        ? "No matching positions"
        : "Queue clear"
      : surface === "clients"
        ? filteredEmpty && (qFromUrl || status !== "all")
          ? "No matching clients"
          : "No clients yet"
        : filteredEmpty && qFromUrl
          ? "No matching people"
          : "Queue clear";
  const emptyDetail =
    surface === "clients" && clientQueue === "pending_positions"
      ? qFromUrl
        ? "Try a different search."
        : "No position rate cards waiting for Account Manager approval."
      : surface === "clients"
        ? qFromUrl || status !== "all"
          ? "Try a different search or status filter."
          : "Add the first client, or wait for Directory import."
        : qFromUrl
          ? "Try a different search or queue."
          : "Nobody is waiting in this queue.";

  if (permissionsLoading) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <DashboardPageHeader
            title={surface === "clients" ? "Clients" : "Employees"}
          />
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!canOpenSurface) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <DashboardPageHeader
            title={surface === "clients" ? "Clients" : "Employees"}
          />
          <HubEmptyState
            title={
              surface === "clients"
                ? "No Clients access"
                : "No Employees access"
            }
            detail={
              surface === "clients"
                ? "Ask an administrator for the Clients page grant."
                : "Ask an administrator for the Employees page grant."
            }
          />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title={surface === "clients" ? "Clients" : "Employees"}
          actions={
            <div className="flex flex-wrap items-center gap-1">
              {isOrganic ? (
                <Button asChild variant="ghost">
                  <Link href="/admin/enrollment">Bundy clock</Link>
                </Button>
              ) : null}
              {rememberedClient && showClientsTab ? (
                <Button asChild variant="ghost">
                  <Link href={`/people/c/${rememberedClient.id}?status=active`}>
                    Resume · {rememberedClient.name}
                  </Link>
                </Button>
              ) : null}
              {surface === "clients" && canAddClient ? (
                <Button asChild>
                  <Link href="/people/clients/new">Add client</Link>
                </Button>
              ) : null}
              {surface === "employees" ? (
                <Button variant="outline" asChild>
                  <Link href="/people/hire-alerts">201 alerts</Link>
                </Button>
              ) : null}
              {surface === "employees" && canAddEmployee && rememberedClient ? (
                <Button asChild>
                  <Link href={`/people/c/${rememberedClient.id}/new`}>
                    Add employee
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="space-y-2">
          {orgs.length > 1 ? (
            <DirectorySegmentedControl
              ariaLabel="Organization"
              value={orgId}
              onChange={switchOrg}
              options={orgs.map((org) => ({
                id: org.id,
                label: directoryOrgLabel(org.name),
              }))}
            />
          ) : null}

          {surface === "clients" ? (
            <DirectorySegmentedControl
              ariaLabel="Client work queues"
              value={clientQueue}
              onChange={(id) =>
                writeListParams({
                  queue: id as ClientQueue,
                  offset: 0,
                })
              }
              options={CLIENT_QUEUES.map((item) => ({
                id: item.id,
                label: item.label,
                count:
                  "countKey" in item
                    ? (clientCounts?.[item.countKey] ?? null)
                    : null,
              }))}
            />
          ) : null}

          {surface === "employees" ? (
            <DirectorySegmentedControl
              ariaLabel="Employee work queues"
              value={employeeQueue}
              onChange={(id) =>
                writeListParams({
                  queue: id as EmployeeQueue,
                  offset: 0,
                })
              }
              options={EMPLOYEE_QUEUES.map((item) => ({
                id: item.id,
                label: item.label,
                count: counts?.[item.countKey] ?? null,
              }))}
            />
          ) : null}
        </div>

        {surface === "clients" && clientQueue === "clients" ? (
          <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <MetricCard
              label="Active clients"
              value={
                <span className="font-bold tabular-nums">
                  {loading && !activeSummary
                    ? "…"
                    : (activeSummary?.active_clients ?? 0).toLocaleString()}
                </span>
              }
              meta={
                selectedOrg
                  ? `Across ${selectedOrg.name}`
                  : "Clients with status active"
              }
              icon={<Icon name="Buildings" size={IconSizes.sm} />}
            />
            <MetricCard
              label="Active on roster"
              value={
                <span className="font-bold tabular-nums">
                  {loading && !activeSummary
                    ? "…"
                    : (activeSummary?.active_employees ?? 0).toLocaleString()}
                </span>
              }
              meta="Headcount across active clients"
              icon={<Icon name="UsersThree" size={IconSizes.sm} />}
            />
          </div>
        ) : null}

        {surface === "clients" && clientQueue === "pending_positions" ? (
          <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <MetricCard
              label="For verification"
              value={
                <span className="font-bold tabular-nums">
                  {clientCounts
                    ? clientCounts.pending_positions.toLocaleString()
                    : "…"}
                </span>
              }
              meta="Position rate cards pending AM approval"
              icon={<Icon name="WarningCircle" size={IconSizes.sm} />}
            />
          </div>
        ) : null}

        {surface === "employees" ? (
          <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <MetricCard
              label="For verification"
              value={
                <span className="font-bold tabular-nums">
                  {counts ? counts.for_verification.toLocaleString() : "…"}
                </span>
              }
              meta="Pending Activate"
              icon={<Icon name="UsersThree" size={IconSizes.sm} />}
            />
            <MetricCard
              label="Needs review"
              value={
                <span className="font-bold tabular-nums">
                  {counts ? counts.needs_review.toLocaleString() : "…"}
                </span>
              }
              meta="Missing from latest cutoff"
              icon={<Icon name="WarningCircle" size={IconSizes.sm} />}
            />
          </div>
        ) : null}

        <div className="mt-4 space-y-4 rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {surface === "clients" && clientQueue === "clients" ? (
              <DirectorySegmentedControl
                ariaLabel="Client status"
                size="sm"
                value={status}
                onChange={(id) =>
                  writeListParams({
                    queue: "clients",
                    status: id,
                    offset: 0,
                  })
                }
                options={STATUS_FILTERS.map((filter) => ({
                  id: filter.value,
                  label: filter.label,
                }))}
              />
            ) : surface === "clients" && clientQueue === "pending_positions" ? (
              <p className="text-sm text-muted-foreground">
                Position rate cards submitted for Account Manager approval.
                Hotel → Michelle; Non-Hotel → Michael.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {employeeQueue === "for_verification"
                  ? "Pending HR verification — Activate after government IDs check out."
                  : employeeQueue === "needs_review"
                    ? "Active people missing from the latest cutoff."
                    : employeeQueue === "missing_statutory"
                      ? "Missing SSS, TIN, PhilHealth, or Pag-IBIG."
                      : employeeQueue === "missing_documents"
                        ? "No current statutory ID scan on file."
                        : "201 files still missing identity, assignment, or IDs."}
              </p>
            )}

            <ListFilterSuggest
              className="w-full min-w-0 sm:max-w-sm"
              inputClassName="min-h-10 bg-muted/60"
              value={q}
              onValueChange={setQ}
              onSelect={(opt) => {
                setQ(opt.value);
                writeListParams({ q: opt.value, offset: 0 });
              }}
              placeholder={
                surface === "clients" && clientQueue === "pending_positions"
                  ? "Search positions"
                  : surface === "clients"
                    ? "Search clients"
                    : "Search people"
              }
              aria-label={
                surface === "clients" && clientQueue === "pending_positions"
                  ? "Search positions"
                  : surface === "clients"
                    ? "Search clients"
                    : "Search people"
              }
              fetchSuggestions={fetchSearchSuggestions}
            />
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !orgId ? (
            <HubEmptyState
              title="No organization on file"
              detail="Import Directory data, or ask an administrator to create one."
            />
          ) : null}

          {!loading && orgId && count === 0 ? (
            <HubEmptyState
              title={emptyTitle}
              detail={emptyDetail}
              action={
                surface === "clients" &&
                clientQueue === "clients" &&
                canAddClient &&
                !qFromUrl &&
                status === "active" ? (
                  <Button asChild>
                    <Link href="/people/clients/new">Add client</Link>
                  </Button>
                ) : null
              }
            />
          ) : null}

          {surface === "clients" &&
          clientQueue === "clients" &&
          clients.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Client</th>
                    <th className="px-3 py-2.5 text-right font-medium tabular-nums">
                      People
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium tabular-nums md:table-cell">
                      Active
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium tabular-nums">
                      Needs review
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium tabular-nums xl:table-cell">
                      Duplicates
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium tabular-nums lg:table-cell">
                      For release
                    </th>
                    <th className="hidden px-3 py-2.5 text-center font-medium lg:table-cell">
                      Last cutoff
                    </th>
                    <th className="w-[5.5rem] px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const needs = client.needs_review_count ?? 0;
                    const dups = client.duplicate_review_count ?? 0;
                    const freq = payLabel(client.pay_frequency);
                    const active = client.status === "active";
                    const directName = directoryDirectLabel(client.name);
                    const legalPrefix = directoryLegalPrefix(client.name);
                    return (
                      <tr
                        key={client.id}
                        role="link"
                        tabIndex={0}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition-colors hover:bg-muted/40",
                          !active && "opacity-60",
                          active &&
                            client.id === rememberedClient?.id &&
                            "bg-accent/50"
                        )}
                        onClick={() => {
                          remember({ id: client.id, name: client.name });
                          router.push(`/people/c/${client.id}?status=active`);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            remember({ id: client.id, name: client.name });
                            router.push(`/people/c/${client.id}?status=active`);
                          }
                        }}
                      >
                        <td className="px-3 py-3 text-left">
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                "font-medium",
                                active
                                  ? "text-foreground"
                                  : "text-muted-foreground"
                              )}
                            >
                              {directName}
                            </span>
                            {legalPrefix ? (
                              <span className="text-xs text-muted-foreground">
                                {legalPrefix}
                              </span>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex whitespace-nowrap rounded px-1.5 py-0.5 text-xs font-medium",
                                  active
                                    ? "bg-primary/10 text-foreground"
                                    : "bg-transparent text-muted-foreground ring-1 ring-inset ring-border"
                                )}
                              >
                                {active ? "Active" : "Inactive"}
                              </span>
                              {freq ? (
                                <span className="text-xs text-muted-foreground">
                                  {freq}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {(client.employee_count ?? 0).toLocaleString()}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums md:table-cell">
                          {(client.active_count ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {needs > 0 ? (
                            <Link
                              href={`/people/c/${client.id}?status=needs_review`}
                              className="font-medium tabular-nums text-foreground underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                remember({ id: client.id, name: client.name });
                              }}
                            >
                              {needs.toLocaleString()}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums xl:table-cell">
                          {dups > 0 ? (
                            <Link
                              href={`/people/c/${client.id}?status=possible_duplicate`}
                              className="font-medium tabular-nums text-foreground underline-offset-2 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                remember({ id: client.id, name: client.name });
                              }}
                            >
                              {dups.toLocaleString()}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground lg:table-cell">
                          {(client.for_release_count ?? 0).toLocaleString()}
                        </td>
                        <td className="hidden px-3 py-3 text-center tabular-nums text-muted-foreground lg:table-cell">
                          {client.latest_payroll_end ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div
                            className="gp-row-actions inline-flex justify-end gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <DirectoryNavIconButton
                              href={`/people/clients/${client.id}`}
                              icon="Buildings"
                              label="Client details"
                              variant="ghost"
                              onClick={() =>
                                remember({
                                  id: client.id,
                                  name: client.name,
                                })
                              }
                            />
                            <DirectoryNavIconButton
                              href={`/people/c/${client.id}?status=active`}
                              icon="UsersThree"
                              label="Employee roster"
                              variant="outline"
                              onClick={() =>
                                remember({
                                  id: client.id,
                                  name: client.name,
                                })
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {surface === "clients" &&
          clientQueue === "pending_positions" &&
          pendingPositions.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Position</th>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="hidden px-3 py-2.5 text-right font-medium tabular-nums md:table-cell">
                      Payroll
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-medium tabular-nums lg:table-cell">
                      Billing
                    </th>
                    <th className="w-[10rem] px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Review</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPositions.map((row) => {
                    const client = nestedPositionClient(row.client);
                    const industry = parseClientIndustry(client?.industry);
                    const canApprove =
                      industry != null &&
                      canApproveClientIndustry({
                        capabilityKeys,
                        industry,
                      });
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-border/60"
                      >
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-foreground">
                              {row.job_title}
                            </span>
                            {row.department ? (
                              <span className="text-xs text-muted-foreground">
                                {row.department}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {client?.name
                            ? directoryDirectLabel(client.name)
                            : "—"}
                          {industry ? (
                            <span className="mt-0.5 block text-xs">
                              {industry === "HOTEL" ? "Hotel" : "Non-Hotel"}
                            </span>
                          ) : null}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums md:table-cell">
                          {row.payroll_daily_rate != null
                            ? Number(row.payroll_daily_rate).toLocaleString()
                            : "—"}
                        </td>
                        <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">
                          {row.billing_daily_rate != null
                            ? Number(row.billing_daily_rate).toLocaleString()
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <HStack
                            gap="1"
                            justify="end"
                            className="gp-row-actions"
                          >
                            {canApprove ? (
                              <>
                                <Button
                                  size="sm"
                                  type="button"
                                  onClick={() =>
                                    void reviewPendingPosition(row.id, "approve")
                                  }
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  type="button"
                                  variant="secondary"
                                  onClick={() =>
                                    void reviewPendingPosition(row.id, "reject")
                                  }
                                >
                                  Reject
                                </Button>
                              </>
                            ) : null}
                            <DirectoryNavIconButton
                              href={`/people/c/${row.client_id}/positions?approval=pending`}
                              icon="Buildings"
                              label="Open client positions"
                              variant="ghost"
                              onClick={() => {
                                if (client) {
                                  remember({
                                    id: client.id,
                                    name: client.name,
                                  });
                                }
                              }}
                            />
                          </HStack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {surface === "employees" && people.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[36rem] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Person</th>
                    <th className="px-3 py-2.5 text-left font-medium">Client</th>
                    <th className="hidden px-3 py-2.5 text-center font-medium md:table-cell">
                      Code
                    </th>
                    <th className="px-3 py-2.5 text-center font-medium">Status</th>
                    <th className="w-[9rem] px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((employee) => {
                    const href = personHref(employee, employeeQueue);
                    return (
                      <tr
                        key={employee.id}
                        className="border-b border-border/60"
                      >
                        <td className="px-3 py-3 text-left font-medium text-foreground">
                          {displayName(employee)}
                        </td>
                        <td className="px-3 py-3 text-left text-muted-foreground">
                          {nestedClientName(employee.client)}
                        </td>
                        <td className="hidden px-3 py-3 text-center font-mono text-xs text-muted-foreground md:table-cell">
                          {employee.employee_code ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <DirectoryStatusBadge
                            status={employee.status}
                            needsReview={
                              employee.lifecycle_flag === "needs_review"
                            }
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <HStack gap="1" justify="end" className="gp-row-actions">
                            {employee.client_id ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  asChild
                                  className="h-9 w-9 p-0"
                                  title={
                                    employeeQueue === "needs_review" ||
                                    employeeQueue === "for_verification"
                                      ? "Resolve"
                                      : "Complete 201"
                                  }
                                >
                                  <Link
                                    href={href}
                                    aria-label={
                                      employeeQueue === "needs_review" ||
                                      employeeQueue === "for_verification"
                                        ? "Resolve"
                                        : "Complete 201"
                                    }
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Icon
                                      name={
                                        employeeQueue === "needs_review" ||
                                        employeeQueue === "for_verification"
                                          ? "WarningCircle"
                                          : "FileText"
                                      }
                                      size={IconSizes.sm}
                                    />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  asChild
                                  className="h-9 w-9 p-0"
                                  title="Open"
                                >
                                  <Link
                                    href={`/people/c/${employee.client_id}/${employee.id}`}
                                    aria-label="Open"
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Icon name="Eye" size={IconSizes.sm} />
                                  </Link>
                                </Button>
                              </>
                            ) : (
                              "—"
                            )}
                          </HStack>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          {pages > 1 ? (
            <HStack justify="between" align="center" className="pt-1">
              <Caption className="tabular-nums text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {count}
              </Caption>
              <HStack gap="2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={offset <= 0 || loading}
                  onClick={() =>
                    writeListParams({ offset: Math.max(0, offset - PAGE) })
                  }
                >
                  Previous
                </Button>
                <Caption className="text-muted-foreground">
                  Page {page} of {pages}
                </Caption>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={offset + PAGE >= count || loading}
                  onClick={() => writeListParams({ offset: offset + PAGE })}
                >
                  Next
                </Button>
              </HStack>
            </HStack>
          ) : null}
        </div>
      </div>
    </DashboardLayout>
  );
}
