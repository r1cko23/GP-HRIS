"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import {
  directoryJson,
  loadDirectoryOrganizations,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { bustCache } from "@/lib/cache-client";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type DirectorySide = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  status: string | null;
  birth_date: string | null;
  sss_number: string | null;
  tin: string | null;
  bank_account_no: string | null;
  job_title: string | null;
};

type Candidate = {
  directory: DirectorySide;
  method: string;
  score: number;
  reasons: string[];
};

type CaseRow = {
  office: {
    id: string;
    employee_id: string | null;
    full_name: string | null;
    is_active: boolean;
    birth_date: string | null;
    sss_number: string | null;
    tin_number: string | null;
    position: string | null;
    directory_employee_id: string | null;
  };
  candidates: Candidate[];
  current_link: DirectorySide | null;
  decision: "link" | "create" | "skip" | null;
  needs_review: boolean;
  review_reason: string;
};

type Payload = {
  organic_organization_id: string;
  organic_client_id: string | null;
  summary: Record<string, number>;
  cases: CaseRow[];
  count: number;
  limit: number;
  offset: number;
};

const PAGE = 20;

const REVIEW_FILTERS = [
  { value: "needs_review", label: "Needs review" },
  { value: "all", label: "All office" },
  { value: "pending", label: "Undecided" },
  { value: "decided", label: "Decided" },
  { value: "skip", label: "Skipped" },
] as const;

function dirName(row: DirectorySide) {
  return `${row.last_name ?? ""}, ${row.first_name ?? ""}${
    row.middle_name ? ` ${row.middle_name}` : ""
  }`.trim();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <Caption className="text-muted-foreground">{label}</Caption>
      <p className="mt-0.5 break-words text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

type DecideArgs = {
  officeId: string;
  decision: "link" | "create" | "skip";
  directoryId?: string;
  matchMethod?: string;
  truthSide?: "office" | "directory";
  adoptOfficeId?: boolean;
  adoptDirectoryCode?: boolean;
};

function CandidateCard({
  candidate,
  office,
  clientId,
  busy,
  onDecide,
}: {
  candidate: Candidate;
  office: CaseRow["office"];
  clientId: string | null;
  busy: boolean;
  onDecide: (args: DecideArgs) => void;
}) {
  return (
    <div className="rounded-md border border-border p-4">
      <HStack justify="between" align="start" className="mb-3 flex-wrap gap-2">
        <div>
          <p className="font-medium">{dirName(candidate.directory)}</p>
          <Caption className="text-muted-foreground">
            Match: {candidate.method} · {candidate.reasons.join("; ")}
          </Caption>
        </div>
        <Badge variant="outline">{candidate.directory.status}</Badge>
      </HStack>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Field label="Directory code" value={candidate.directory.employee_code} />
        <Field label="Job title" value={candidate.directory.job_title ?? "—"} />
        <Field label="Birthday" value={candidate.directory.birth_date ?? "—"} />
        <Field label="SSS" value={candidate.directory.sss_number ?? "—"} />
        <Field label="TIN" value={candidate.directory.tin ?? "—"} />
        <Field label="Bank" value={candidate.directory.bank_account_no ?? "—"} />
      </div>
      <div className="space-y-2">
        <Caption className="text-muted-foreground">Which record is correct?</Caption>
        <HStack gap="2" className="flex-wrap">
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              onDecide({
                officeId: office.id,
                decision: "link",
                directoryId: candidate.directory.id,
                matchMethod: candidate.method,
                truthSide: "directory",
                adoptDirectoryCode: Boolean(
                  candidate.directory.employee_code &&
                    candidate.directory.employee_code !== office.employee_id
                ),
              })
            }
          >
            Directory is correct (sync all)
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              onDecide({
                officeId: office.id,
                decision: "link",
                directoryId: candidate.directory.id,
                matchMethod: candidate.method,
                truthSide: "office",
                adoptOfficeId: false,
              })
            }
          >
            Office is correct
          </Button>
          {office.employee_id &&
          office.employee_id !== candidate.directory.employee_code ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                onDecide({
                  officeId: office.id,
                  decision: "link",
                  directoryId: candidate.directory.id,
                  matchMethod: candidate.method,
                  truthSide: "office",
                  adoptOfficeId: true,
                })
              }
            >
              Office correct + push ID to Directory
            </Button>
          ) : null}
          {clientId ? (
            <Button size="sm" variant="ghost" asChild>
              <Link href={`/directory/c/${clientId}/${candidate.directory.id}`}>
                Open 201
              </Link>
            </Button>
          ) : null}
        </HStack>
      </div>
    </div>
  );
}

function ManualOrganicPicker({
  organizationId,
  clientId,
  office,
  busy,
  excludeIds,
  onDecide,
}: {
  organizationId: string;
  clientId: string | null;
  office: CaseRow["office"];
  busy: boolean;
  excludeIds: string[];
  onDecide: (args: DecideArgs) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<DirectorySide[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  async function search() {
    const term = q.trim();
    if (!term) return;
    setSearching(true);
    setSearchError(null);
    try {
      const json = await directoryJson<{
        data: Array<{
          id: string;
          employee_code: string | null;
          last_name: string;
          first_name: string;
          middle_name: string | null;
          status: string;
          birth_date?: string | null;
          position?: { job_title?: string | null } | null;
        }>;
      }>(
        `/api/directory/employees?${new URLSearchParams({
          q: term,
          limit: "10",
          include_history: "true",
        })}`,
        organizationId
      );
      const mapped: DirectorySide[] = (json.data ?? [])
        .filter((row) => !excludeIds.includes(row.id))
        .map((row) => ({
          id: row.id,
          employee_code: row.employee_code,
          last_name: row.last_name,
          first_name: row.first_name,
          middle_name: row.middle_name,
          status: row.status,
          birth_date: row.birth_date ?? null,
          sss_number: null,
          tin: null,
          bank_account_no: null,
          job_title: row.position?.job_title ?? null,
        }));
      setResults(mapped);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border p-4">
      <p className="mb-2 text-sm font-medium">Search Organic manually</p>
      <Caption className="mb-3 block text-muted-foreground">
        Use when the office label is a nickname (e.g. search “Michael Razal” for
        MGR G. RAZAL).
      </Caption>
      <HStack gap="2" className="mb-3 flex-wrap">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void search();
          }}
          placeholder="Name or employee code…"
          className="max-w-sm"
          aria-label="Search Organic employees"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={searching || !q.trim()}
          onClick={() => void search()}
        >
          {searching ? "Searching…" : "Search"}
        </Button>
      </HStack>
      {searchError ? (
        <p className="text-sm text-destructive" role="alert">
          {searchError}
        </p>
      ) : null}
      {results.map((directory) => (
        <CandidateCard
          key={directory.id}
          candidate={{
            directory,
            method: "manual",
            score: 0,
            reasons: ["HR manual search"],
          }}
          office={office}
          clientId={clientId}
          busy={busy}
          onDecide={onDecide}
        />
      ))}
    </div>
  );
}

export default function OfficeOrganicReconcilePage() {
  const { isAdmin, isHR } = useUserRole();
  const canDecide = isAdmin || isHR;
  const [organicOrgId, setOrganicOrgId] = useState("");
  const [payload, setPayload] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<
    (typeof REVIEW_FILTERS)[number]["value"]
  >("needs_review");
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [offset, setOffset] = useState(0);
  const [fillBusy, setFillBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const orgs = await loadDirectoryOrganizations();
      const organic =
        orgs.find((org) => org.name.toLowerCase() === "organic") ?? null;
      if (!organic) throw new Error("Organic organization not found");
      writeDirectoryOrgId(organic.id);
      setOrganicOrgId(organic.id);
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        ...(reviewFilter === "needs_review" ? { needs_review: "1" } : { needs_review: "0" }),
        ...(reviewFilter === "pending" ||
        reviewFilter === "decided" ||
        reviewFilter === "skip"
          ? {
              decision:
                reviewFilter === "decided" ? "decided" : reviewFilter,
            }
          : {}),
        ...(qApplied.trim() ? { q: qApplied.trim() } : {}),
      });
      const json = await directoryJson<{ data: Payload }>(
        `/api/directory/reconcile/office-organic?${params}`,
        organic.id
      );
      setPayload(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reconcile queue");
    } finally {
      setLoading(false);
    }
  }, [offset, qApplied, reviewFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function fillMissingFrom201(officeId?: string) {
    if (!organicOrgId) return;
    setFillBusy(true);
    setError(null);
    try {
      const json = await directoryJson<{
        data: {
          dry_run: boolean;
          scanned: number;
          updated: number;
          skipped: number;
          results: Array<{
            full_name: string | null;
            employee_id: string | null;
            filled_fields: string[];
            skipped: boolean;
            reason?: string;
          }>;
        };
      }>(`/api/directory/reconcile/fill-missing-from-201`, organicOrgId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_employee_id: officeId ?? undefined,
          dry_run: false,
          active_only: true,
        }),
      });
      await bustCache();
      const { updated, skipped, scanned } = json.data;
      if (officeId) {
        const row = json.data.results[0];
        if (row?.filled_fields.length) {
          toast.success(`Filled ${row.filled_fields.length} field(s) from 201`, {
            description: `${row.full_name ?? row.employee_id}: ${row.filled_fields.join(", ")}`,
          });
        } else {
          toast.info("Nothing to fill — office already has those 201 values");
        }
      } else {
        toast.success(`Filled missing 201 fields for ${updated} employee(s)`, {
          description: `${scanned} linked scanned · ${skipped} already complete`,
        });
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fill from 201 failed");
    } finally {
      setFillBusy(false);
    }
  }

  async function decide(args: DecideArgs) {
    if (!organicOrgId) return;
    setBusyId(args.officeId);
    setError(null);
    try {
      await directoryJson(`/api/directory/reconcile/office-organic`, organicOrgId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          office_employee_id: args.officeId,
          decision: args.decision,
          directory_employee_id: args.directoryId ?? null,
          match_method: args.matchMethod ?? null,
          truth_side: args.truthSide ?? "office",
          adopt_office_employee_id: args.adoptOfficeId ?? false,
          adopt_directory_employee_code: args.adoptDirectoryCode ?? false,
        }),
      });
      await bustCache();
      if (args.decision === "link" && args.truthSide === "directory") {
        toast.success("Office record synced from Organic Directory", {
          description:
            "Name, ID, rates, government IDs, address, photo, and status were copied where present on the 201.",
        });
      } else if (args.decision === "link") {
        toast.success("Office and Directory linked");
      } else if (args.decision === "create") {
        toast.success("Organic 201 created and linked to office");
      } else {
        toast.success("Reconcile decision saved");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Decision failed");
    } finally {
      setBusyId(null);
    }
  }

  if (!canDecide) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <p className="text-sm text-muted-foreground">
            Admin or HR access is required for office ↔ Organic reconcile.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <DirectoryBreadcrumb
              items={[
                { label: "Directory", href: "/directory" },
                { label: "Office ↔ Organic reconcile" },
              ]}
            />
          }
          title="Link bundy access"
          actions={
            <HStack gap="2" className="flex-wrap">
              <Button
                type="button"
                size="sm"
                disabled={fillBusy}
                onClick={() => void fillMissingFrom201()}
              >
                {fillBusy ? "Filling…" : "Fill missing from 201 (all linked)"}
              </Button>
              <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
                Refresh
              </Button>
            </HStack>
          }
        />

        <div
          className="flex flex-wrap gap-1.5"
          role="tablist"
          aria-label="Reconcile queue filter"
        >
          {REVIEW_FILTERS.map((filter) => {
            const selected = reviewFilter === filter.value;
            return (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => {
                  setOffset(0);
                  setReviewFilter(filter.value);
                }}
                className={
                  selected
                    ? "rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                    : "rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted"
                }
              >
                {filter.label}
              </button>
            );
          })}
        </div>

        <HStack gap="2" className="flex-wrap">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setOffset(0);
                setQApplied(q);
              }
            }}
            placeholder="Search office name or employee code…"
            className="max-w-sm"
            aria-label="Search reconcile queue"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setOffset(0);
              setQApplied(q);
            }}
          >
            Search
          </Button>
        </HStack>

        {payload ? (
          <HStack gap="2" className="flex-wrap">
            <Badge variant="secondary">
              Needs review: {payload.summary.needs_review ?? 0}
            </Badge>
            <Badge variant="outline">Office: {payload.summary.office_total ?? 0}</Badge>
            <Badge variant="outline">Decided: {payload.summary.decided ?? 0}</Badge>
            <Badge variant="outline">Skipped: {payload.summary.skipped ?? 0}</Badge>
          </HStack>
        ) : null}

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : !payload?.cases.length ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              {qApplied || reviewFilter !== "needs_review"
                ? "No rows match your search or filters."
                : "No rows need review. Switch to All office or Undecided to inspect everything."}
            </CardContent>
          </Card>
        ) : (
          <VStack gap="4" align="stretch">
            <Caption className="text-muted-foreground">
              Showing {payload.offset + 1}–
              {Math.min(payload.offset + payload.cases.length, payload.count)} of{" "}
              {payload.count}
            </Caption>
            {payload.cases.map((row) => {
              const busy = busyId === row.office.id;
              return (
                <Card key={row.office.id} className="border-border">
                  <CardHeader className="pb-3">
                    <HStack justify="between" align="start" className="flex-wrap gap-2">
                      <div>
                        <CardTitle className="text-base">
                          {row.office.full_name ?? "—"}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          {row.review_reason}
                        </CardDescription>
                      </div>
                      <Badge variant={row.office.is_active ? "default" : "secondary"}>
                        Office {row.office.is_active ? "active" : "inactive"}
                      </Badge>
                    </HStack>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 rounded-md border border-border bg-muted/30 p-4 lg:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">
                          Office Employees
                        </p>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Employee ID" value={row.office.employee_id} />
                          <Field
                            label="Position"
                            value={row.office.position ?? "—"}
                          />
                          <Field
                            label="Birthday"
                            value={row.office.birth_date ?? "—"}
                          />
                          <Field label="SSS" value={row.office.sss_number ?? "—"} />
                          <Field label="TIN" value={row.office.tin_number ?? "—"} />
                          <Field
                            label="Active"
                            value={row.office.is_active ? "Yes" : "No"}
                          />
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Current Directory link
                        </p>
                        {row.current_link ? (
                          <div className="grid gap-3 sm:grid-cols-2">
                            <Field
                              label="Name"
                              value={dirName(row.current_link)}
                            />
                            <Field
                              label="Code"
                              value={row.current_link.employee_code}
                            />
                            <Field
                              label="Job title"
                              value={row.current_link.job_title ?? "—"}
                            />
                            <Field label="Status" value={row.current_link.status} />
                            <Field
                              label="Bank"
                              value={row.current_link.bank_account_no ?? "—"}
                            />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            Not linked to an Organic 201 yet.
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-sm font-medium">
                        Organic candidates — choose which side is correct, then link
                      </p>
                      {!row.candidates.length ? (
                        <p className="text-sm text-muted-foreground">
                          No automatic candidate. Search Organic below (e.g. Michael
                          Razal for MGR G. RAZAL).
                        </p>
                      ) : null}
                      {row.candidates.map((candidate) => (
                        <CandidateCard
                          key={candidate.directory.id}
                          candidate={candidate}
                          office={row.office}
                          clientId={payload.organic_client_id}
                          busy={busy}
                          onDecide={decide}
                        />
                      ))}
                      <ManualOrganicPicker
                        organizationId={organicOrgId}
                        clientId={payload.organic_client_id}
                        office={row.office}
                        busy={busy}
                        excludeIds={row.candidates.map((c) => c.directory.id)}
                        onDecide={decide}
                      />
                    </div>

                    <HStack gap="2" className="flex-wrap border-t border-border pt-3">
                      {row.current_link ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy || fillBusy}
                          onClick={() => void fillMissingFrom201(row.office.id)}
                        >
                          Fill missing from 201
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() =>
                          void decide({
                            officeId: row.office.id,
                            decision: "create",
                          })
                        }
                      >
                        No match — create new Organic 201 from office
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          void decide({
                            officeId: row.office.id,
                            decision: "skip",
                          })
                        }
                      >
                        Skip (not now)
                      </Button>
                    </HStack>
                  </CardContent>
                </Card>
              );
            })}
            {Math.ceil((payload.count || 0) / PAGE) > 1 ? (
              <HStack justify="between" align="center" className="pt-2">
                <Caption className="text-muted-foreground">
                  Page {Math.floor(payload.offset / PAGE) + 1} of{" "}
                  {Math.max(1, Math.ceil(payload.count / PAGE))}
                </Caption>
                <HStack gap="2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={payload.offset <= 0 || loading}
                    onClick={() => setOffset((value) => Math.max(0, value - PAGE))}
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={payload.offset + PAGE >= payload.count || loading}
                    onClick={() => setOffset((value) => value + PAGE)}
                  >
                    Next
                  </Button>
                </HStack>
              </HStack>
            ) : null}
          </VStack>
        )}
      </div>
    </DashboardLayout>
  );
}
