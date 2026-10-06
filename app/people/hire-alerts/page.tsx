"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
} from "@/lib/directory/browser";
import { peopleEmployeeHirePath } from "@/lib/hubs";

const PAGE = 25;

type AlertRow = {
  id: string;
  person_name: string;
  status: string;
  created_at: string;
  created_by_name: string | null;
  client_id: string;
  clients: { name: string } | { name: string }[] | null;
  client_branches: { name: string } | { name: string }[] | null;
};

function embedName(
  value: { name: string } | { name: string }[] | null,
): string {
  if (!value) return "—";
  return Array.isArray(value) ? value[0]?.name || "—" : value.name;
}

export default function HireAlertsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Loading…</p>}>
      <HireAlertsInner />
    </Suspense>
  );
}

function HireAlertsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const status = searchParams.get("status") || "open";
  const q = searchParams.get("q") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const [draftQ, setDraftQ] = useState(q);
  const [orgId, setOrgId] = useState("");
  const [rows, setRows] = useState<AlertRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (draftQ === q) return;
      const params = new URLSearchParams(searchParams.toString());
      if (draftQ.trim()) params.set("q", draftQ.trim());
      else params.delete("q");
      params.delete("offset");
      router.replace(`/people/hire-alerts?${params.toString()}`);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [draftQ, q, router, searchParams]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const orgs = await loadDirectoryOrganizations();
      if (cancelled) return;
      const org = pickDirectoryOrg(orgs, readDirectoryOrgId());
      setOrgId(org?.id ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      status,
      limit: String(PAGE),
      offset: String(offset),
    });
    if (q.trim()) params.set("q", q.trim());
    void directoryJson<{ data: AlertRow[]; count: number }>(
      `/api/directory/hire-alerts?${params.toString()}`,
      orgId,
    )
      .then((json) => {
        if (cancelled) return;
        setRows(json.data ?? []);
        setCount(json.count ?? 0);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load alerts");
        setRows([]);
        setCount(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orgId, status, q, offset]);

  function writeStatus(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", next);
    params.delete("offset");
    router.replace(`/people/hire-alerts?${params.toString()}`);
  }

  function writeOffset(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    if (next > 0) params.set("offset", String(next));
    else params.delete("offset");
    router.replace(`/people/hire-alerts?${params.toString()}`);
  }

  async function dismiss(id: string) {
    if (!orgId) return;
    setDismissingId(id);
    try {
      await directoryJson(`/api/directory/hire-alerts/${id}`, orgId, { method: "POST" });
      setRows((current) => current.filter((row) => row.id !== id));
      setCount((current) => Math.max(current - 1, 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not dismiss");
    } finally {
      setDismissingId(null);
    }
  }

  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, count);
  const filtered = Boolean(q.trim()) || status !== "open";

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="201 alerts"
          description="Names an Account Supervisor could not find. Input the 201, then they pick that person onto Draft."
        />
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <label className="text-sm text-muted-foreground">
            Search
            <input
              value={draftQ}
              onChange={(event) => setDraftQ(event.target.value)}
              className="mt-1 block min-h-11 w-64 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:min-h-10"
              placeholder="Name"
            />
          </label>
          <label className="text-sm text-muted-foreground">
            Status
            <select
              value={status}
              onChange={(event) => writeStatus(event.target.value)}
              className="mt-1 block min-h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground sm:min-h-10"
            >
              <option value="open">Open</option>
              <option value="dismissed">Dismissed</option>
              <option value="cleared">Cleared</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>
        {error ? (
          <p className="mb-3 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground shadow-card">
            {filtered
              ? "No alerts match this search."
              : "No one is waiting for a 201."}
          </p>
        ) : (
          <div className={dbTableShell}>
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Name</th>
                  <th className="px-4 py-3 text-center font-medium">Site</th>
                  <th className="px-4 py-3 text-center font-medium">From</th>
                  <th className="px-4 py-3 text-center font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="px-4 py-3 text-left font-medium">{row.person_name}</td>
                    <td className="px-4 py-3 text-center">
                      {embedName(row.clients)}
                      <span className="block text-xs text-muted-foreground">
                        {embedName(row.client_branches)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-muted-foreground">
                      {row.created_by_name || "—"}
                    </td>
                    <td className="px-4 py-3 text-center capitalize">{row.status}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="gp-row-actions inline-flex justify-end gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <Link href={peopleEmployeeHirePath(row.client_id)}>Add 201</Link>
                        </Button>
                        {row.status === "open" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={dismissingId === row.id}
                            onClick={() => void dismiss(row.id)}
                          >
                            {dismissingId === row.id ? "Dismissing…" : "Dismiss"}
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            Showing {from}–{to} of {count}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || offset === 0}
              onClick={() => writeOffset(Math.max(offset - PAGE, 0))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={loading || offset + PAGE >= count}
              onClick={() => writeOffset(offset + PAGE)}
            >
              Next
            </Button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
