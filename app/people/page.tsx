"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import { DirectoryNavIconButton } from "@/components/directory/DirectoryNavIconButton";
import { DirectorySegmentedControl } from "@/components/directory/DirectorySegmentedControl";
import { DirectoryStatusBadge } from "@/components/directory/DirectoryStatusBadge";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
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

type WorkCounts = {
  needs_review: number;
  missing_statutory: number;
  missing_documents: number;
  incomplete_201: number;
};

const PAGE = 50;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

const PEOPLE_QUEUES = [
  { id: "clients", label: "Clients" },
  { id: "needs_review", label: "Needs review", countKey: "needs_review" },
  { id: "missing_statutory", label: "Missing IDs", countKey: "missing_statutory" },
  {
    id: "missing_documents",
    label: "Missing documents",
    countKey: "missing_documents",
  },
  { id: "incomplete_201", label: "Incomplete 201", countKey: "incomplete_201" },
] as const;

type PeopleQueue = (typeof PEOPLE_QUEUES)[number]["id"];
const QUEUE_IDS = new Set<string>(PEOPLE_QUEUES.map((queue) => queue.id));

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

function personHref(employee: QueueEmployee, queue: PeopleQueue) {
  if (!employee.client_id) return "/people";
  const base = `/people/c/${employee.client_id}/${employee.id}`;
  if (queue === "needs_review") {
    return `${base}?focus=lifecycle`;
  }
  if (queue !== "clients") return `${base}/onboard`;
  return base;
}

export default function DirectoryClientsPage() {
  return (
    <Suspense fallback={<DirectoryClientsFallback />}>
      <DirectoryClientsContent />
    </Suspense>
  );
}

function DirectoryClientsFallback() {
  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="People"
          description="Work queues, clients, and 201 files."
        />
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    </DashboardLayout>
  );
}

function DirectoryClientsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orgHint = searchParams.get("org");
  const queueParam = searchParams.get("queue") ?? "clients";
  const queue = (
    QUEUE_IDS.has(queueParam) ? queueParam : "clients"
  ) as PeopleQueue;
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
  const [counts, setCounts] = useState<WorkCounts | null>(null);
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
      queue?: PeopleQueue;
      status?: string;
      q?: string;
      offset?: number;
    }) => {
      const paramsNext = new URLSearchParams();
      if (orgHint) paramsNext.set("org", orgHint);
      const nextQueue = next.queue ?? queue;
      if (nextQueue !== "clients") paramsNext.set("queue", nextQueue);
      const nextStatus = next.status ?? status;
      if (nextQueue === "clients") {
        // Persist explicitly so "all" is distinct from default active.
        paramsNext.set("status", nextStatus);
      }
      const nextQ = next.q !== undefined ? next.q : qFromUrl;
      if (nextQ.trim()) paramsNext.set("q", nextQ.trim());
      const nextOffset = next.offset !== undefined ? next.offset : offset;
      if (nextOffset > 0) paramsNext.set("offset", String(nextOffset));
      const qs = paramsNext.toString();
      router.replace(qs ? `/people?${qs}` : "/people", { scroll: false });
    },
    [offset, orgHint, qFromUrl, queue, router, status]
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
    try {
      const json = await directoryJson<{ data: WorkCounts }>(
        "/api/directory/work-queues",
        orgId
      );
      setCounts(json.data);
    } catch {
      setCounts(null);
    }
  }, [orgId]);

  const loadList = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      if (queue === "clients") {
        const clientJson = await directoryJson<{
          data: Client[];
          count: number;
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
        setCount(clientJson.count ?? 0);
      } else {
        const params = new URLSearchParams({
          limit: String(PAGE),
          offset: String(offset),
        });
        if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
        if (queue === "needs_review") params.set("lifecycle", "needs_review");
        if (queue === "missing_statutory") {
          params.set("statutory_filter", "missing");
        }
        if (queue === "missing_documents") {
          params.set("document_filter", "missing");
        }
        if (queue === "incomplete_201") {
          params.set("completeness_filter", "incomplete");
        }
        const empJson = await directoryJson<{
          data: QueueEmployee[];
          count: number;
        }>(`/api/directory/employees?${params}`, orgId);
        setPeople(empJson.data ?? []);
        setClients([]);
        setCount(empJson.count ?? 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load list");
    } finally {
      setLoading(false);
    }
  }, [offset, orgId, qFromUrl, queue, status]);

  useEffect(() => {
    void loadWorkCounts();
  }, [loadWorkCounts]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const peopleInView = clients.reduce(
    (sum, client) => sum + (client.employee_count ?? 0),
    0
  );
  const selectedOrg = orgs.find((org) => org.id === orgId);
  const isOrganic = /organic/i.test(selectedOrg?.name ?? "");
  const filteredEmpty = Boolean(
    qFromUrl || (queue === "clients" && status !== "all") || queue !== "clients"
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
    queue === "clients"
      ? filteredEmpty && (qFromUrl || status !== "all")
        ? "No matching clients"
        : "No clients yet"
      : filteredEmpty && qFromUrl
        ? "No matching people"
        : "Queue clear";
  const emptyDetail =
    queue === "clients"
      ? qFromUrl || status !== "all"
        ? "Try a different search or status filter."
        : "Add the first client, or wait for Directory import."
      : qFromUrl
        ? "Try a different search or queue."
        : "Nobody is waiting in this queue.";

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="People"
          description="Work queues, clients, and 201 files."
          actions={
            <div className="flex flex-wrap items-center gap-1">
              {isOrganic ? (
                <Button asChild variant="ghost">
                  <Link href="/time/enrollment">Bundy clock</Link>
                </Button>
              ) : null}
              {rememberedClient ? (
                <Button asChild variant="ghost">
                  <Link href={`/people/c/${rememberedClient.id}?status=active`}>
                    Resume · {rememberedClient.name}
                  </Link>
                </Button>
              ) : null}
              <Button asChild>
                <Link href="/people/clients/new">Add client</Link>
              </Button>
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

          <DirectorySegmentedControl
            ariaLabel="People queues"
            value={queue}
            onChange={(id) =>
              writeListParams({
                queue: id as PeopleQueue,
                offset: 0,
              })
            }
            options={PEOPLE_QUEUES.map((item) => ({
              id: item.id,
              label: item.label,
              count:
                "countKey" in item ? (counts?.[item.countKey] ?? null) : null,
            }))}
          />
        </div>

        <div className="mt-4 space-y-4 rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {queue === "clients" ? (
              <DirectorySegmentedControl
                ariaLabel="Client status"
                size="sm"
                value={status}
                onChange={(id) =>
                  writeListParams({
                    status: id,
                    offset: 0,
                  })
                }
                options={STATUS_FILTERS.map((filter) => ({
                  id: filter.value,
                  label: filter.label,
                }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {queue === "needs_review"
                  ? "Active people missing from the latest cutoff."
                  : queue === "missing_statutory"
                    ? "Missing SSS, TIN, PhilHealth, or Pag-IBIG."
                    : queue === "missing_documents"
                      ? "No current statutory ID scan on file."
                      : "201 files still missing identity, assignment, or IDs."}
              </p>
            )}

            <Input
              className="min-h-10 w-full bg-muted/60 sm:max-w-sm"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={
                queue === "clients" ? "Search clients" : "Search people"
              }
              aria-label={
                queue === "clients" ? "Search clients" : "Search people"
              }
            />
          </div>

          <div className="border-t border-border/70 pt-3">
            <p className="text-pretty text-sm leading-normal tabular-nums text-muted-foreground">
              {loading
                ? "Loading…"
                : queue === "clients"
                  ? `${count.toLocaleString()} clients · ${peopleInView.toLocaleString()} people on this page${
                      selectedOrg ? ` · ${selectedOrg.name}` : ""
                    }`
                  : `${count.toLocaleString()} people${
                      selectedOrg ? ` · ${selectedOrg.name}` : ""
                    }`}
            </p>
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
                queue === "clients" && !qFromUrl && status === "active" ? (
                  <Button asChild>
                    <Link href="/people/clients/new">Add client</Link>
                  </Button>
                ) : null
              }
            />
          ) : null}

          {queue === "clients" && clients.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">People</th>
                    <th className="hidden px-3 py-2.5 font-medium tabular-nums md:table-cell">
                      Active
                    </th>
                    <th className="px-3 py-2.5 font-medium tabular-nums">
                      Needs review
                    </th>
                    <th className="hidden px-3 py-2.5 font-medium tabular-nums xl:table-cell">
                      Duplicates
                    </th>
                    <th className="hidden px-3 py-2.5 font-medium tabular-nums lg:table-cell">
                      For release
                    </th>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">
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
                        <td className="px-3 py-3">
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
                        <td className="px-3 py-3 tabular-nums text-muted-foreground">
                          {(client.employee_count ?? 0).toLocaleString()}
                        </td>
                        <td className="hidden px-3 py-3 tabular-nums md:table-cell">
                          {(client.active_count ?? 0).toLocaleString()}
                        </td>
                        <td className="px-3 py-3 tabular-nums">
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
                        <td className="hidden px-3 py-3 tabular-nums xl:table-cell">
                          {dups > 0 ? (
                            <Link
                              href={`/people/c/${client.id}?status=possible_duplicate`}
                              className="inline-flex min-w-[1.75rem] justify-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-semibold text-foreground hover:bg-muted/80"
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
                        <td className="hidden px-3 py-3 tabular-nums text-muted-foreground lg:table-cell">
                          {(client.for_release_count ?? 0).toLocaleString()}
                        </td>
                        <td className="hidden px-3 py-3 tabular-nums text-muted-foreground lg:table-cell">
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

          {queue !== "clients" && people.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 font-medium">Person</th>
                    <th className="px-3 py-2.5 font-medium">Client</th>
                    <th className="hidden px-3 py-2.5 font-medium md:table-cell">
                      Code
                    </th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="w-[9rem] px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {people.map((employee) => {
                    const href = personHref(employee, queue);
                    return (
                      <tr
                        key={employee.id}
                        className="border-b border-border/60"
                      >
                        <td className="px-3 py-3 font-medium text-foreground">
                          {displayName(employee)}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {nestedClientName(employee.client)}
                        </td>
                        <td className="hidden px-3 py-3 font-mono text-xs text-muted-foreground md:table-cell">
                          {employee.employee_code ?? "—"}
                        </td>
                        <td className="px-3 py-3">
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
                                    queue === "needs_review"
                                      ? "Resolve"
                                      : "Complete 201"
                                  }
                                >
                                  <Link
                                    href={href}
                                    aria-label={
                                      queue === "needs_review"
                                        ? "Resolve"
                                        : "Complete 201"
                                    }
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Icon
                                      name={
                                        queue === "needs_review"
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
