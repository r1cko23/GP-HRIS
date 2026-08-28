"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  directoryOrgHint,
  directoryOrgLabel,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryClient,
  readDirectoryOrgId,
  writeDirectoryClient,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";

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
  latest_payroll_end?: string | null;
};

const PAGE = 50;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
] as const;

function payLabel(freq: string | null) {
  if (freq === "weekly") return "Weekly";
  if (freq === "monthly") return "Monthly";
  if (freq === "semi-monthly") return "Semi-monthly";
  return null;
}

function remember(client: { id: string; name: string }) {
  writeDirectoryClient(client);
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
          title="Directory"
          description="One person master for everyone. Switch Deployed (client sites) or Organic (GP house). Bundy clock uses linked clock access; deployed hours today come from Payroll Timekeeping."
        />
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    </DashboardLayout>
  );
}

function DirectoryClientsContent() {
  const searchParams = useSearchParams();
  const orgHint = searchParams.get("org");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [status, setStatus] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [rememberedClient, setRememberedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    setRememberedClient(readDirectoryClient());
  }, [orgId]);

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

  const loadClients = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const clientJson = await directoryJson<{
        data: Client[];
        count: number;
      }>(
        `/api/directory/clients?${new URLSearchParams({
          limit: String(PAGE),
          offset: String(offset),
          ...(status !== "all" ? { status } : {}),
          ...(qApplied.trim() ? { q: qApplied.trim() } : {}),
        })}`,
        orgId
      );
      setClients(clientJson.data ?? []);
      setCount(clientJson.count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoading(false);
    }
  }, [orgId, offset, qApplied, status]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const page = Math.floor(offset / PAGE) + 1;
  const pages = Math.max(1, Math.ceil(count / PAGE));
  const peopleInView = clients.reduce(
    (sum, client) => sum + (client.employee_count ?? 0),
    0
  );
  const selectedOrg = orgs.find((org) => org.id === orgId);
  const isOrganic = /organic/i.test(selectedOrg?.name ?? "");
  const filteredEmpty = Boolean(qApplied || status !== "all");

  function switchOrg(nextId: string) {
    if (nextId === orgId) return;
    writeDirectoryClient(null);
    writeDirectoryOrgId(nextId);
    setOffset(0);
    setOrgId(nextId);
  }

  function applySearch() {
    setOffset(0);
    setQApplied(q);
  }

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Directory"
          description="One person master for everyone. Switch Deployed (client sites) or Organic (GP house). Bundy clock uses linked clock access; deployed hours today come from Payroll Timekeeping."
          actions={
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/directory/clients/new">Add client</Link>
              </Button>
              {isOrganic ? (
                <Button asChild variant="outline">
                  <Link href="/employees">Bundy clock access</Link>
                </Button>
              ) : null}
              {rememberedClient ? (
                <Button asChild variant="outline">
                  <Link href={`/directory/c/${rememberedClient.id}`}>
                    Resume · {rememberedClient.name}
                  </Link>
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="space-y-4 rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
          {orgs.length > 1 ? (
            <div>
              <div
                className="flex flex-wrap gap-1.5"
                role="tablist"
                aria-label="Organization"
              >
                {orgs.map((org) => {
                  const selected = org.id === orgId;
                  return (
                    <button
                      key={org.id}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      onClick={() => switchOrg(org.id)}
                      className={cn(
                        "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
                        selected
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {directoryOrgLabel(org.name)}
                    </button>
                  );
                })}
              </div>
              {selectedOrg ? (
                <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
                  {directoryOrgHint(selectedOrg.name)}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div
              className="flex flex-wrap gap-1"
              role="tablist"
              aria-label="Client status"
            >
              {STATUS_FILTERS.map((filter) => {
                const selected = status === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setOffset(0);
                      setStatus(filter.value);
                    }}
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      selected
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>

            <HStack gap="2" className="w-full sm:w-auto">
              <Input
                className="min-h-10 flex-1 sm:min-w-[16rem]"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="Search clients"
                aria-label="Search clients"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="min-h-10"
                onClick={applySearch}
              >
                Search
              </Button>
            </HStack>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border/70 pt-3">
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading…"
                : `${count.toLocaleString()} clients · ${peopleInView.toLocaleString()} people on this page${
                    selectedOrg ? ` · ${selectedOrg.name}` : ""
                  }`}
            </p>
            <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
              <Link href="/directory/reconcile">Link bundy access</Link>
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {!loading && !orgId ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="font-medium text-foreground">No organization yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Directory ETL has not created one.
              </p>
            </div>
          ) : null}

          {!loading && orgId && clients.length === 0 ? (
            <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
              <p className="font-medium text-foreground">
                {filteredEmpty ? "No matching clients" : "No clients yet"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filteredEmpty
                  ? "Try a different search or status filter."
                  : "Create the first client master, or wait for Directory ETL."}
              </p>
              {!filteredEmpty ? (
                <Button asChild className="mt-4">
                  <Link href="/directory/clients/new">Add client</Link>
                </Button>
              ) : null}
            </div>
          ) : null}

          {clients.length > 0 ? (
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
                    <th className="hidden px-3 py-2.5 font-medium tabular-nums lg:table-cell">
                      For release
                    </th>
                    <th className="hidden px-3 py-2.5 font-medium lg:table-cell">
                      Last cutoff
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client) => {
                    const needs = client.needs_review_count ?? 0;
                    const freq = payLabel(client.pay_frequency);
                    const active = client.status === "active";
                    return (
                      <tr
                        key={client.id}
                        className={cn(
                          "border-b border-border/60 transition-colors hover:bg-muted/40",
                          client.id === rememberedClient?.id && "bg-accent/50"
                        )}
                      >
                        <td className="px-3 py-3">
                          <div className="flex flex-col gap-1">
                            <Link
                              href={`/directory/c/${client.id}`}
                              className="font-medium text-foreground underline-offset-2 hover:text-primary hover:underline"
                              onClick={() =>
                                remember({ id: client.id, name: client.name })
                              }
                            >
                              {client.name}
                            </Link>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex rounded px-1.5 py-0.5 text-[11px] font-medium",
                                  active
                                    ? "bg-primary/12 text-foreground"
                                    : "bg-muted text-muted-foreground"
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
                            <span className="inline-flex min-w-[1.75rem] justify-center rounded-md bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-950">
                              {needs.toLocaleString()}
                            </span>
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
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button size="sm" variant="ghost" asChild>
                              <Link
                                href={`/directory/clients/${client.id}`}
                                onClick={() =>
                                  remember({
                                    id: client.id,
                                    name: client.name,
                                  })
                                }
                              >
                                Settings
                              </Link>
                            </Button>
                            <Button size="sm" variant="outline" asChild>
                              <Link
                                href={`/directory/c/${client.id}`}
                                onClick={() =>
                                  remember({
                                    id: client.id,
                                    name: client.name,
                                  })
                                }
                              >
                                Roster
                              </Link>
                            </Button>
                          </div>
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
              <Caption className="text-muted-foreground">
                Showing {offset + 1}–{Math.min(offset + PAGE, count)} of {count}
              </Caption>
              <HStack gap="2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={offset <= 0 || loading}
                  onClick={() => setOffset((value) => Math.max(0, value - PAGE))}
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
                  onClick={() => setOffset((value) => value + PAGE)}
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
