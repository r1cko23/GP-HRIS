"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { BenefitsScopeNote } from "@/components/benefits/BenefitsScopeNote";
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
import { Caption } from "@/components/ui/typography";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";

type Org = { id: string; name: string };
type Client = { id: string; name: string };
type Employee = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  client_id: string | null;
  tin: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
};

const PAGE = 50;
const COMPLETENESS = [
  { value: "all", label: "All" },
  { value: "missing", label: "Missing IDs" },
  { value: "complete", label: "Complete" },
] as const;

function hasId(value: string | null): boolean {
  return Boolean(value && value.trim());
}

function StatutoryFallback() {
  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Statutory IDs"
          description="Membership numbers and TIN on the 201 file—not contribution amounts."
        />
      </div>
    </DashboardLayout>
  );
}

export default function StatutoryPage() {
  return (
    <Suspense fallback={<StatutoryFallback />}>
      <StatutoryContent />
    </Suspense>
  );
}

function StatutoryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const clientId = searchParams.get("client") ?? "";
  const completeness = searchParams.get("completeness") ?? "all";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [rows, setRows] = useState<Employee[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const setParams = useCallback(
    (patch: Record<string, string | number>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        const text = String(value);
        if (!text || text === "all" || text === "0") next.delete(key);
        else next.set(key, text);
      }
      if ("q" in patch || "client" in patch || "completeness" in patch) {
        next.delete("offset");
      }
      const qs = next.toString();
      router.replace(qs ? `/benefits/statutory?${qs}` : "/benefits/statutory", {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadDirectoryOrganizations();
        if (cancelled) return;
        setOrgs(loaded);
        const picked = pickDirectoryOrg(loaded, readDirectoryOrgId());
        if (picked) {
          writeDirectoryOrgId(picked.id);
          setOrgId(picked.id);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Organizations failed");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      try {
        const json = await directoryJson<{ data: Client[] }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: "200",
            offset: "0",
          })}`,
          orgId
        );
        if (!cancelled) setClients(json.data ?? []);
      } catch {
        if (!cancelled) setClients([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        statutory: "1",
      });
      if (q.trim()) params.set("q", q.trim());
      if (clientId) params.set("client_id", clientId);
      if (completeness === "missing") params.set("statutory_filter", "missing");
      if (completeness === "complete") params.set("statutory_filter", "complete");
      const json = await directoryJson<{ data: Employee[]; count: number }>(
        `/api/directory/employees?${params}`,
        orgId
      );
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Load failed");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [orgId, q, clientId, completeness, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);
  const clientName = useMemo(() => {
    const map = new Map(clients.map((c) => [c.id, c.name]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "—");
  }, [clients]);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Statutory IDs"
          description="Membership numbers and TIN on the 201 file—not contribution amounts."
        />
        <BenefitsScopeNote scope="statutory" />

        <CardSection>
          <HStack className="mb-4 flex-col items-stretch gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="statutory-search">
                Search
              </label>
              <Input
                id="statutory-search"
                type="search"
                placeholder="Name or employee code"
                defaultValue={q}
                onChange={(e) => {
                  const value = e.target.value;
                  window.clearTimeout((window as Window & { __statQ?: number }).__statQ);
                  (window as Window & { __statQ?: number }).__statQ = window.setTimeout(() => {
                    setParams({ q: value });
                  }, 300);
                }}
              />
            </div>
            <div className="sm:w-48">
              <label className="mb-1 block text-xs text-muted-foreground" htmlFor="statutory-client">
                Client
              </label>
              <select
                id="statutory-client"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={clientId}
                onChange={(e) => setParams({ client: e.target.value })}
              >
                <option value="">All clients</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1">
              {COMPLETENESS.map((item) => (
                <Button
                  key={item.value}
                  type="button"
                  size="sm"
                  variant={completeness === item.value ? "default" : "outline"}
                  onClick={() => setParams({ completeness: item.value })}
                >
                  {item.label}
                </Button>
              ))}
            </div>
          </HStack>

          {orgs.length > 1 ? (
            <Caption className="mb-3 block text-muted-foreground">
              Organization: {orgs.find((o) => o.id === orgId)?.name}
            </Caption>
          ) : null}

          {error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : loading ? (
            <p className="text-sm text-muted-foreground">Loading statutory IDs…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {q || clientId || completeness !== "all"
                ? "No people match this search or filter."
                : "No people on file yet."}
            </p>
          ) : (
            <>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Client</TableHead>
                      <TableHead>TIN</TableHead>
                      <TableHead>SSS</TableHead>
                      <TableHead>PhilHealth</TableHead>
                      <TableHead>Pag-IBIG</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium">
                          {row.last_name}, {row.first_name}
                        </TableCell>
                        <TableCell>{row.employee_code || "—"}</TableCell>
                        <TableCell>{clientName(row.client_id)}</TableCell>
                        <TableCell>
                          <IdBadge ok={hasId(row.tin)} />
                        </TableCell>
                        <TableCell>
                          <IdBadge ok={hasId(row.sss_number)} />
                        </TableCell>
                        <TableCell>
                          <IdBadge ok={hasId(row.philhealth_number)} />
                        </TableCell>
                        <TableCell>
                          <IdBadge ok={hasId(row.pagibig_number)} />
                        </TableCell>
                        <TableCell>
                          {row.client_id ? (
                            <Button asChild size="sm" variant="outline">
                              <Link
                                href={`/people/c/${row.client_id}/${row.id}?tab=compliance`}
                              >
                                Open 201
                              </Link>
                            </Button>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <HStack className="mt-4 justify-between">
                <Caption className="tabular-nums">
                  Showing {showingFrom}–{showingTo} of {count}
                </Caption>
                <HStack>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || offset === 0}
                    onClick={() => setParams({ offset: Math.max(offset - PAGE, 0) })}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={loading || offset + PAGE >= count}
                    onClick={() => setParams({ offset: offset + PAGE })}
                  >
                    Next
                  </Button>
                </HStack>
              </HStack>
            </>
          )}
        </CardSection>
      </div>
    </DashboardLayout>
  );
}

function IdBadge({ ok }: { ok: boolean }) {
  return (
    <Badge variant={ok ? "secondary" : "outline"} className="font-normal">
      {ok ? "On file" : "Missing"}
    </Badge>
  );
}
