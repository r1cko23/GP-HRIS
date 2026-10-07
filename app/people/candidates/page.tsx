"use client";

import { FormEvent, Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
import {
  ListFilterSuggest,
  type ListSuggestOption,
} from "@/components/ListFilterSuggest";
import { CandidateStageBadge } from "@/components/talent/CandidateStageBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { HStack } from "@/components/ui/stack";
import { Caption } from "@/components/ui/typography";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryHeaders,
  directoryJson,
  directoryOrgLabel,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
  type OrgRow,
} from "@/lib/directory/browser";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  canPeopleTalent,
  PAGE_EMPLOYEES_LEGACY,
} from "@/lib/access/people-pages";
import {
  CANDIDATE_STAGES,
  candidateStageLabel,
  type CandidateStage,
} from "@/lib/talent/candidates";

const PAGE_SIZE = 25;
const NEXT_STAGE: Partial<Record<CandidateStage, CandidateStage>> = {
  prospect: "applicant",
  applicant: "screening",
  screening: "submitted",
  submitted: "selected",
};

type Candidate = {
  id: string;
  candidate_number: string;
  employee_id: string | null;
  status: CandidateStage;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  email: string | null;
  mobile: string | null;
  source: string | null;
  consent_status: string;
  available_from: string | null;
  created_at: string;
  conversion_readiness: { ready: boolean; blockers: string[] };
  employee?:
    | { id: string; client_id: string | null }
    | Array<{ id: string; client_id: string | null }>
    | null;
};

type CandidateForm = {
  first_name: string;
  middle_name: string;
  last_name: string;
  email: string;
  mobile: string;
  source: string;
  consent_status: "pending" | "granted";
  available_from: string;
};

const EMPTY_FORM: CandidateForm = {
  first_name: "",
  middle_name: "",
  last_name: "",
  email: "",
  mobile: "",
  source: "",
  consent_status: "pending",
  available_from: "",
};

function parseOffset(raw: string | null) {
  const value = Number(raw ?? 0);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function personName(row: Candidate) {
  return `${row.last_name}, ${row.first_name}${
    row.middle_name ? ` ${row.middle_name}` : ""
  }`;
}

function linkedEmployee(row: Candidate) {
  if (!row.employee) return null;
  return Array.isArray(row.employee) ? row.employee[0] ?? null : row.employee;
}

function CandidatesFallback() {
  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader title="Candidates" />
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CandidatesPage() {
  return (
    <Suspense fallback={<CandidatesFallback />}>
      <CandidatesContent />
    </Suspense>
  );
}

function CandidatesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { capabilityKeys: rawKeys, canRead, hasCapability, loading: accessLoading } =
    usePermissions();
  const capabilityKeys =
    rawKeys.length > 0
      ? rawKeys
      : canRead("employees")
        ? [PAGE_EMPLOYEES_LEGACY]
        : [];
  const canOpen = canPeopleTalent(capabilityKeys);
  const canCreate =
    hasCapability("fn:candidates.create") ||
    hasCapability("fn:employees.create") ||
    (rawKeys.length === 0 && canRead("employees"));
  const stageParam = searchParams.get("stage") ?? "all";
  const stage =
    stageParam === "all" ||
    (CANDIDATE_STAGES as readonly string[]).includes(stageParam)
      ? stageParam
      : "all";
  const qFromUrl = searchParams.get("q") ?? "";
  const offset = parseOffset(searchParams.get("offset"));

  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [rows, setRows] = useState<Candidate[]>([]);
  const [count, setCount] = useState(0);
  const [query, setQuery] = useState(qFromUrl);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<CandidateForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(
    null
  );

  const setListParams = useCallback(
    (next: { q?: string; stage?: string; offset?: number }) => {
      const params = new URLSearchParams();
      const nextQ = next.q ?? qFromUrl;
      const nextStage = next.stage ?? stage;
      const nextOffset = next.offset ?? offset;
      if (nextQ.trim()) params.set("q", nextQ.trim());
      if (nextStage !== "all") params.set("stage", nextStage);
      if (nextOffset > 0) params.set("offset", String(nextOffset));
      const serialized = params.toString();
      router.replace(
        serialized ? `/people/candidates?${serialized}` : "/people/candidates",
        { scroll: false }
      );
    },
    [offset, qFromUrl, router, stage]
  );

  useEffect(() => setQuery(qFromUrl), [qFromUrl]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (query !== qFromUrl) setListParams({ q: query, offset: 0 });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [qFromUrl, query, setListParams]);

  useEffect(() => {
    let cancelled = false;
    void loadDirectoryOrganizations()
      .then((loaded) => {
        if (cancelled) return;
        setOrganizations(loaded);
        const selected = pickDirectoryOrg(loaded, readDirectoryOrgId());
        if (selected) {
          writeDirectoryOrgId(selected.id);
          setOrganizationId(selected.id);
        } else {
          setLoading(false);
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(
            cause instanceof Error ? cause.message : "Organizations failed"
          );
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadCandidates = useCallback(async () => {
    if (!organizationId || !canOpen) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (qFromUrl.trim()) params.set("q", qFromUrl.trim());
      if (stage !== "all") params.set("stage", stage);
      const response = await directoryJson<{
        data: Candidate[];
        count: number;
      }>(`/api/directory/candidates?${params}`, organizationId);
      setRows(response.data ?? []);
      setCount(response.count ?? 0);
    } catch (cause) {
      setRows([]);
      setCount(0);
      setError(cause instanceof Error ? cause.message : "Candidates failed");
    } finally {
      setLoading(false);
    }
  }, [canOpen, offset, organizationId, qFromUrl, stage]);

  useEffect(() => {
    if (!accessLoading) void loadCandidates();
  }, [accessLoading, loadCandidates]);

  const fetchSuggestions = useCallback(
    async (search: string): Promise<ListSuggestOption[]> => {
      if (!organizationId) return [];
      const params = new URLSearchParams({
        q: search,
        limit: "10",
        offset: "0",
      });
      if (stage !== "all") params.set("stage", stage);
      const result = await directoryJson<{ data: Candidate[] }>(
        `/api/directory/candidates?${params}`,
        organizationId
      );
      return (result.data ?? []).map((candidate) => ({
        id: candidate.id,
        primary: `${personName(candidate)} · ${candidate.candidate_number}`,
        secondary: `${candidateStageLabel(candidate.status)}${
          candidate.email ? ` · ${candidate.email}` : ""
        }`,
        value: personName(candidate),
        matchText: [
          candidate.candidate_number,
          candidate.email,
          candidate.mobile,
        ]
          .filter(Boolean)
          .join(" "),
      }));
    },
    [organizationId, stage]
  );

  async function createCandidate(forceCreate = false) {
    if (!organizationId) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/directory/candidates", {
        method: "POST",
        headers: {
          ...directoryHeaders(organizationId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...form, force_create: forceCreate }),
      });
      const json = (await response.json()) as {
        error?: string;
        dedup_hints?: Candidate[];
      };
      if (
        response.status === 409 &&
        json.dedup_hints?.length &&
        window.confirm(
          `${json.dedup_hints.length} possible duplicate${
            json.dedup_hints.length === 1 ? "" : "s"
          } found. Create a separate candidate anyway?`
        )
      ) {
        await createCandidate(true);
        return;
      }
      if (!response.ok) throw new Error(json.error ?? "Candidate create failed");
      setForm(EMPTY_FORM);
      setShowCreate(false);
      setListParams({ q: "", stage: "all", offset: 0 });
      await loadCandidates();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Candidate create failed"
      );
    } finally {
      setSaving(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void createCandidate();
  }

  async function advanceCandidate(candidate: Candidate) {
    const next = NEXT_STAGE[candidate.status];
    if (!next || !organizationId) return;
    setSavingCandidateId(candidate.id);
    setError(null);
    try {
      await directoryJson(`/api/directory/candidates/${candidate.id}`, organizationId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      await loadCandidates();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Candidate update failed");
    } finally {
      setSavingCandidateId(null);
    }
  }

  async function convertCandidate(candidate: Candidate) {
    if (!organizationId) return;
    setSavingCandidateId(candidate.id);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/candidates/${candidate.id}/convert`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hire_date: candidate.available_from }),
        }
      );
      await loadCandidates();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Candidate conversion failed"
      );
    } finally {
      setSavingCandidateId(null);
    }
  }

  if (accessLoading) return <CandidatesFallback />;
  if (!canOpen) {
    return (
      <DashboardLayout>
        <div className={dbPageWrapper}>
          <DashboardPageHeader title="Candidates" />
          <HubEmptyState
            title="No Candidates access"
            detail="Ask an administrator for the Talent or Employees page grant."
          />
        </div>
      </DashboardLayout>
    );
  }

  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE_SIZE, count);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Candidates"
          description="Recruiting profiles before the person becomes a 201."
          actions={
            canCreate ? (
              <Button type="button" onClick={() => setShowCreate((open) => !open)}>
                {showCreate ? "Close form" : "Add candidate"}
              </Button>
            ) : null
          }
        />

        {showCreate ? (
          <form
            onSubmit={submit}
            className="grid gap-4 rounded-md border border-border bg-card p-4 shadow-card sm:grid-cols-2 sm:p-5 lg:grid-cols-4"
          >
            <Field label="First name" required>
              <Input
                aria-label="First name"
                value={form.first_name}
                onChange={(event) =>
                  setForm({ ...form, first_name: event.target.value })
                }
                autoCapitalizeWords
                required
              />
            </Field>
            <Field label="Middle name">
              <Input
                aria-label="Middle name"
                value={form.middle_name}
                onChange={(event) =>
                  setForm({ ...form, middle_name: event.target.value })
                }
                autoCapitalizeWords
              />
            </Field>
            <Field label="Last name" required>
              <Input
                aria-label="Last name"
                value={form.last_name}
                onChange={(event) =>
                  setForm({ ...form, last_name: event.target.value })
                }
                autoCapitalizeWords
                required
              />
            </Field>
            <Field label="Email">
              <Input
                aria-label="Email"
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm({ ...form, email: event.target.value })
                }
              />
            </Field>
            <Field label="Mobile">
              <Input
                aria-label="Mobile"
                type="tel"
                value={form.mobile}
                onChange={(event) =>
                  setForm({ ...form, mobile: event.target.value })
                }
              />
            </Field>
            <Field label="Source">
              <Input
                aria-label="Source"
                value={form.source}
                onChange={(event) =>
                  setForm({ ...form, source: event.target.value })
                }
                autoCapitalizeWords
                placeholder="Referral, job board…"
              />
            </Field>
            <Field label="Consent">
              <Select
                value={form.consent_status}
                onValueChange={(value: "pending" | "granted") =>
                  setForm({ ...form, consent_status: value })
                }
              >
                <SelectTrigger aria-label="Consent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="granted">Granted</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Available from">
              <Input
                aria-label="Available from"
                type="date"
                value={form.available_from}
                onChange={(event) =>
                  setForm({ ...form, available_from: event.target.value })
                }
              />
            </Field>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save candidate"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={saving}
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowCreate(false);
                }}
              >
                Cancel
              </Button>
              <p className="text-xs text-muted-foreground">
                Email, mobile, and name are checked for possible duplicates.
              </p>
            </div>
          </form>
        ) : null}

        <div className="mt-4 space-y-4 rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Select
              value={stage}
              onValueChange={(value) =>
                setListParams({ stage: value, offset: 0 })
              }
            >
              <SelectTrigger className="sm:w-48" aria-label="Candidate stage">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stages</SelectItem>
                {CANDIDATE_STAGES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {candidateStageLabel(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ListFilterSuggest
              className="w-full sm:max-w-sm"
              value={query}
              onValueChange={setQuery}
              onSelect={(option) => {
                setQuery(option.value);
                setListParams({ q: option.value, offset: 0 });
              }}
              placeholder="Search name, number, email, mobile"
              aria-label="Search candidates"
              fetchSuggestions={fetchSuggestions}
            />
          </div>

          {organizations.length > 1 ? (
            <Select
              value={organizationId}
              onValueChange={(value) => {
                writeDirectoryOrgId(value);
                setOrganizationId(value);
                setListParams({ offset: 0 });
              }}
            >
              <SelectTrigger className="sm:w-64" aria-label="Organization">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {directoryOrgLabel(organization.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          {loading ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Loading candidates…
            </div>
          ) : null}
          {!loading && !error && !organizationId ? (
            <HubEmptyState
              title="No organization on file"
              detail="Ask an administrator to create a Directory organization."
            />
          ) : null}
          {!loading && !error && organizationId && count === 0 ? (
            <HubEmptyState
              title={qFromUrl || stage !== "all" ? "No matching candidates" : "No candidates yet"}
              detail={
                qFromUrl || stage !== "all"
                  ? "Try a different search or stage filter."
                  : "Add the first recruiting profile."
              }
            />
          ) : null}

          {!loading && rows.length > 0 ? (
            <div className={dbTableShell}>
              <table className="w-full min-w-[48rem] text-sm">
                <thead className="border-b border-border bg-muted/40">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-medium">Candidate</th>
                    <th className="px-3 py-2.5 text-center font-medium">Stage</th>
                    <th className="px-3 py-2.5 text-left font-medium">Contact</th>
                    <th className="hidden px-3 py-2.5 text-left font-medium lg:table-cell">Source</th>
                    <th className="px-3 py-2.5 text-center font-medium">Conversion</th>
                    <th className="w-24 px-3 py-2.5 text-right font-medium">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((candidate) => {
                    const employee = linkedEmployee(candidate);
                    return (
                      <tr key={candidate.id} className="border-b border-border/60">
                        <td className="px-3 py-3 text-left">
                          <div className="font-medium text-foreground">
                            {personName(candidate)}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {candidate.candidate_number}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <CandidateStageBadge stage={candidate.status} />
                        </td>
                        <td className="px-3 py-3 text-left text-muted-foreground">
                          <div>{candidate.email ?? "—"}</div>
                          {candidate.mobile ? <div>{candidate.mobile}</div> : null}
                        </td>
                        <td className="hidden px-3 py-3 text-left text-muted-foreground lg:table-cell">
                          {candidate.source ?? "—"}
                        </td>
                        <td className="px-3 py-3 text-center">
                          {candidate.employee_id
                            ? "Converted"
                            : candidate.conversion_readiness.ready
                              ? "Ready"
                              : "Not ready"}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="gp-row-actions inline-flex justify-end">
                            {employee?.client_id ? (
                              <Button asChild size="sm" variant="outline">
                                <Link href={`/people/c/${employee.client_id}/${employee.id}`}>
                                  Open 201
                                </Link>
                              </Button>
                            ) : candidate.status === "selected" &&
                              candidate.conversion_readiness.ready &&
                              hasCapability("fn:employees.create") ? (
                              <Button
                                size="sm"
                                onClick={() => void convertCandidate(candidate)}
                                disabled={savingCandidateId !== null}
                              >
                                {savingCandidateId === candidate.id
                                  ? "Converting…"
                                  : "Create 201"}
                              </Button>
                            ) : NEXT_STAGE[candidate.status] && canCreate ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void advanceCandidate(candidate)}
                                disabled={savingCandidateId !== null}
                              >
                                {savingCandidateId === candidate.id
                                  ? "Saving…"
                                  : candidateStageLabel(
                                      NEXT_STAGE[candidate.status]!
                                    )}
                              </Button>
                            ) : null}
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
              <Caption className="tabular-nums text-muted-foreground">
                Showing {showingFrom}–{showingTo} of {count}
              </Caption>
              <HStack gap="2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={offset <= 0 || loading}
                  onClick={() =>
                    setListParams({
                      offset: Math.max(0, offset - PAGE_SIZE),
                    })
                  }
                >
                  Previous
                </Button>
                <Caption className="text-muted-foreground">
                  Page {page} of {pages}
                </Caption>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={offset + PAGE_SIZE >= count || loading}
                  onClick={() =>
                    setListParams({ offset: offset + PAGE_SIZE })
                  }
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? " *" : ""}
      </Label>
      {children}
    </div>
  );
}
