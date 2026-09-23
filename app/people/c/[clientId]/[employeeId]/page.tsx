"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { format, formatDistance, parseISO } from "date-fns";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BodySmall, Caption, H1 } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbMobileTabList, dbMobileTabTrigger, dbPageWrapper } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import { toast } from "sonner";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryStatusBadge } from "@/components/directory/DirectoryStatusBadge";
import { DirectoryEmployeeEditPanel } from "@/components/directory/DirectoryEmployeeEditPanel";
import { DirectoryRehireDialog } from "@/components/directory/DirectoryRehireDialog";
import { DirectoryTransferDialog } from "@/components/directory/DirectoryTransferDialog";
import { DirectoryLifecyclePanel } from "@/components/directory/DirectoryLifecyclePanel";
import type {
  CompletenessEditGroup,
  TenureHistoryRow,
} from "@/components/directory/DirectoryLifecyclePanel";
import {
  DirectoryContactsPanel,
  type DirectoryContact,
} from "@/components/directory/DirectoryContactsPanel";
import { DirectoryChildSheetPanel } from "@/components/directory/DirectoryChildSheetPanel";
import { DirectoryClientEmployeeSwitch } from "@/components/directory/DirectoryClientEmployeeSwitch";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { DirectoryStatutoryPreview } from "@/components/directory/DirectoryStatutoryPreview";
import { DirectoryDocumentsPanel } from "@/components/directory/DirectoryDocumentsPanel";
import { compute201Completeness } from "@/lib/directory/completeness";
import { directoryStatusMeta } from "@/lib/directory/employees";
import { isRehireEligible } from "@/lib/directory/tenure";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  canEmployeeSection,
  firstAllowed201Tab,
  hasAnyEmployeeSection,
  tabAllowed,
} from "@/lib/access/employee-sections";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { dash, formatProseDisplay } from "@/lib/directory/display-value";

type Rel = {
  id: string;
  name?: string;
  location?: string;
  job_title?: string;
  department?: string | null;
} | null;

type Employee = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  sex: string | null;
  birth_date: string | null;
  hire_date: string | null;
  first_hire_date?: string | null;
  regular_date: string | null;
  resign_date: string | null;
  status: string;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  ecola: number | string | null;
  tin: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tax_status: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  gcash: string | null;
  pay_through: string | null;
  email: string | null;
  mobile: string | null;
  address: string | null;
  legacy_id: number | null;
  last_payroll_end?: string | null;
  client_latest_payroll_end?: string | null;
  needs_review?: boolean;
  lifecycle_flag?: string;
  lifecycle_hint?: string;
  days_since_last_payroll?: number | null;
  is_current_engagement?: boolean;
  superseded_by?: string | null;
  client_id: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  client: Rel;
  branch: Rel;
  department?: Rel;
  position: Rel;
};

type DuplicatePeer = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  status: string;
  is_current_engagement: boolean;
  client_id: string | null;
};

type FilePayload = {
  employee: Employee;
  duplicate_peers?: DuplicatePeer[];
  contacts: DirectoryContact[];
  dependents: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  job_history: Array<Record<string, unknown>>;
  licenses: Array<Record<string, unknown>>;
  medical: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
  tenures?: TenureHistoryRow[];
};

function Detail({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Caption className="text-muted-foreground">{label}</Caption>
      <p className="mt-0.5 break-words text-sm text-foreground">{value ?? "—"}</p>
    </div>
  );
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value);
  try {
    return format(parseISO(raw.slice(0, 10)), "MMM d, yyyy");
  } catch {
    return raw;
  }
}


function namesAgree(
  a: { last_name: string; first_name: string },
  b: { last_name: string; first_name: string }
) {
  const key = (row: { last_name: string; first_name: string }) =>
    `${row.last_name.trim().toUpperCase()}|${row.first_name.trim().toUpperCase()}`;
  return key(a) === key(b);
}

function Duplicate201Strip({
  employeeId,
  employeeCode,
  lastName,
  firstName,
  clientId,
  organizationId,
  peers,
  onParked,
  onParkedOnto,
}: {
  employeeId: string;
  employeeCode: string | null;
  lastName: string;
  firstName: string;
  clientId: string;
  organizationId: string;
  peers: DuplicatePeer[];
  onParked: () => void;
  onParkedOnto: (peer: DuplicatePeer) => void;
}) {
  const [parking, setParking] = useState<string | null>(null);
  const mixedNames = peers.some(
    (peer) => !namesAgree({ last_name: lastName, first_name: firstName }, peer)
  );

  async function park(masterId: string, extraId: string, done: () => void) {
    if (!organizationId) return;
    setParking(`${masterId}:${extraId}`);
    try {
      await directoryJson(
        `/api/directory/employees/${masterId}/collapse-duplicate`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ extra_id: extraId }),
        }
      );
      toast.success("Earlier file linked. Nothing was deleted.");
      done();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not park extra 201"
      );
    } finally {
      setParking(null);
    }
  }

  return (
    <div
      className="mt-3 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-foreground"
      role="status"
    >
      <p className="font-medium">Possible duplicate 201</p>
      <p className="mt-1 text-muted-foreground">
        Same SSS is already current on another file. Park the extra under the
        original 201 — the extra row stays stored. Do not Add employee.
        {mixedNames
          ? " Names differ — confirm this is the same person before parking."
          : null}
      </p>
      <ul className="mt-3 space-y-3">
        {peers.map((peer) => {
          const peerHref = `/people/c/${peer.client_id ?? clientId}/${peer.id}`;
          const peerLabel = `${peer.last_name}, ${peer.first_name}`;
          const extraLabel = peer.employee_code ?? peer.id.slice(0, 8);
          const thisLabel = employeeCode ?? employeeId.slice(0, 8);
          const busy = parking !== null;
          return (
            <li
              key={peer.id}
              className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  href={peerHref}
                  className="font-medium underline underline-offset-2"
                >
                  {peerLabel}
                </Link>
                <span className="ml-2 font-mono text-muted-foreground">
                  {extraLabel}
                </span>
                {peer.client_id && peer.client_id !== clientId ? (
                  <span className="ml-2 text-muted-foreground">
                    Different client
                  </span>
                ) : null}
              </div>
              <HStack gap="2" className="flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11 sm:min-h-10"
                  disabled={busy || !organizationId}
                  onClick={() => {
                    const ok = window.confirm(
                      `Link extra 201 ${extraLabel} (${peerLabel}) under ${thisLabel}? Nothing is deleted.`
                    );
                    if (!ok) return;
                    void park(employeeId, peer.id, onParked);
                  }}
                >
                  {parking === `${employeeId}:${peer.id}`
                    ? "Linking…"
                    : `Link extra ${extraLabel} here`}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11 sm:min-h-10"
                  disabled={busy || !organizationId}
                  onClick={() => {
                    const ok = window.confirm(
                      `Link this 201 ${thisLabel} under ${extraLabel} (${peerLabel})? Only works if that file is the original. Nothing is deleted.`
                    );
                    if (!ok) return;
                    void park(peer.id, employeeId, () => onParkedOnto(peer));
                  }}
                >
                  Link this under {extraLabel}
                </Button>
              </HStack>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function Directory201Page() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab =
    searchParams.get("tab") === "compliance" ||
    searchParams.get("tab") === "documents"
      ? "documents"
      : searchParams.get("tab") === "job"
        ? "job"
        : searchParams.get("tab") === "bank"
          ? "bank"
          : searchParams.get("tab") === "family"
            ? "family"
            : searchParams.get("tab") === "history"
              ? "history"
              : searchParams.get("tab") === "more"
                ? "more"
                : "overview";
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : "";
  const { canAccessSalaryInfo, isAdmin, isHR } = useUserRole();
  const { employeeSections, loading: permissionsLoading } = usePermissions();
  const canLifecycle = canEmployeeSection(employeeSections, "lifecycle");
  const canCore = canEmployeeSection(employeeSections, "core");
  const canGovIds = canEmployeeSection(employeeSections, "government_ids");
  const canDocs = canEmployeeSection(employeeSections, "documents");
  const canPayChannel = canEmployeeSection(employeeSections, "pay_channel");
  const canFamily = canEmployeeSection(employeeSections, "family");
  const canHistory = canEmployeeSection(employeeSections, "history");
  const canMedical = canEmployeeSection(employeeSections, "medical");
  const canEditFile = (isAdmin || isHR) && hasAnyEmployeeSection(employeeSections);
  const activeTab = tabAllowed(requestedTab, employeeSections)
    ? requestedTab
    : firstAllowed201Tab(employeeSections) ?? "overview";
  const [file, setFile] = useState<FilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editFocusGroup, setEditFocusGroup] =
    useState<CompletenessEditGroup | null>(null);
  const [clientSchedules, setClientSchedules] = useState<{
    statutory_schedule: string | null;
    wtax_schedule: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError(null);
    try {
      const org = await ensureDirectoryOrgId();
      setOrganizationId(org);
      const json = await directoryJson<{ data: FilePayload }>(
        `/api/directory/employees/${employeeId}/file?${new URLSearchParams({
          client_id: clientId,
        })}`,
        org
      );
      setFile(json.data);
      if (json.data.employee.client?.id && json.data.employee.client.name) {
        writeDirectoryClient({
          id: json.data.employee.client.id,
          name: json.data.employee.client.name,
        });
      }
      if (clientId) {
        try {
          const clientJson = await directoryJson<{
            data: {
              statutory_schedule?: string | null;
              wtax_schedule?: string | null;
            };
          }>(`/api/directory/clients/${clientId}`, org);
          setClientSchedules({
            statutory_schedule: clientJson.data.statutory_schedule ?? null,
            wtax_schedule: clientJson.data.wtax_schedule ?? null,
          });
        } catch {
          setClientSchedules(null);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 201 file");
    } finally {
      setLoading(false);
    }
  }, [clientId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (searchParams.get("focus") !== "lifecycle") return;
    const el = document.getElementById("directory-lifecycle");
    if (!el) return;
    window.requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [searchParams, file, loading]);

  if ((loading || permissionsLoading) && !file) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!permissionsLoading && !hasAnyEmployeeSection(employeeSections)) {
    return (
      <DashboardLayout>
        <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
            <Link href={`/people/c/${clientId}?status=active`}>
              <Icon name="CaretLeft" size={IconSizes.sm} />
              Back to employees
            </Link>
          </Button>
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            You can open People, but no 201 sections are granted for this
            account. Ask an administrator to enable Core 201, Documents, or
            other sections under Settings → Team &amp; access.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  if (error && !file) {
    return (
      <DashboardLayout>
        <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
            <Link href={`/people/c/${clientId}?status=active`}>
              <Icon name="CaretLeft" size={IconSizes.sm} />
              Back to employees
            </Link>
          </Button>
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const emp = file?.employee;
  if (!emp || !file) return null;

  const displayName = `${emp.last_name}, ${emp.first_name}${
    emp.middle_name ? ` ${emp.middle_name}` : ""
  }`;
  const legalName = [emp.first_name, emp.middle_name, emp.last_name]
    .filter(Boolean)
    .join(" ");
  const tenure =
    emp.hire_date != null && emp.hire_date !== ""
      ? formatDistance(parseISO(String(emp.hire_date).slice(0, 10)), new Date(), {
          addSuffix: false,
        })
      : null;

  function money(value: number | string | null | undefined) {
    if (!canAccessSalaryInfo) return "Hidden";
    if (value === null || value === undefined || value === "") return "—";
    const n = Number(value);
    return Number.isFinite(n) ? formatCurrency(n) : "—";
  }

  const needsReview =
    emp.needs_review === true || emp.lifecycle_flag === "needs_review";
  const completeness = compute201Completeness(emp);
  const payrollHint = directoryStatusMeta(emp.status).payroll;

  function scrollToLifecycle() {
    document
      .getElementById("directory-lifecycle")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openEdit(group?: CompletenessEditGroup | null) {
    setEditFocusGroup(group ?? null);
    setEditOpen(true);
    window.setTimeout(() => {
      document
        .getElementById("directory-edit-panel")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <div className="space-y-1">
          <HubBackLink href={`/people/c/${clientId}?status=active`} label="Roster" />
          <DirectoryBreadcrumb
            items={[
              { label: "People", href: "/people" },
              {
                label: emp.client?.name ?? "Client",
                href: `/people/clients/${clientId}`,
              },
              {
                label: "Employees",
                href: `/people/c/${clientId}?status=active`,
              },
              { label: displayName },
            ]}
          />
        </div>

        <DirectoryClientEmployeeSwitch
          className="mt-3"
          clientId={clientId}
          clientName={emp.client?.name ?? undefined}
          active="employees"
        />

        {emp.is_current_engagement === false && emp.superseded_by ? (
          <div
            className="mt-3 rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-foreground"
            role="status"
          >
            This is a superseded rehire file.{" "}
            <Link
              href={`/people/c/${clientId}/${emp.superseded_by}`}
              className="font-medium underline underline-offset-2"
            >
              Open current engagement →
            </Link>
          </div>
        ) : null}

        {emp.is_current_engagement !== false &&
        canLifecycle &&
        (file.duplicate_peers?.length ?? 0) > 0 ? (
          <Duplicate201Strip
            employeeId={emp.id}
            employeeCode={emp.employee_code}
            lastName={emp.last_name}
            firstName={emp.first_name}
            clientId={clientId}
            organizationId={organizationId}
            peers={file.duplicate_peers ?? []}
            onParked={() => void load()}
            onParkedOnto={(peer) => {
              router.push(
                `/people/c/${peer.client_id ?? clientId}/${peer.id}`
              );
            }}
          />
        ) : null}

        <Card className="overflow-hidden border-muted/80">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
              <div className="flex min-w-0 flex-1 gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-lg font-semibold text-muted-foreground sm:h-20 sm:w-20">
                  {(emp.first_name?.[0] ?? "?").toUpperCase()}
                  {(emp.last_name?.[0] ?? "").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <H1 className="break-words text-2xl leading-tight sm:text-3xl">
                    {displayName}
                  </H1>
                  <div className="flex flex-wrap items-center gap-2">
                    <Caption className="font-mono text-sm">
                      {emp.employee_code ?? "—"}
                    </Caption>
                    <DirectoryStatusBadge
                      status={emp.status}
                      needsReview={needsReview}
                    />
                    {emp.client?.name ? (
                      <Badge variant="outline" className="max-w-full truncate text-xs">
                        {emp.client.name}
                      </Badge>
                    ) : null}
                  </div>
                  {payrollHint ? (
                    <Caption className="block text-muted-foreground">
                      {payrollHint}
                    </Caption>
                  ) : null}
                  {emp.position?.job_title ? (
                    <BodySmall className="text-muted-foreground">
                      {emp.position.job_title}
                    </BodySmall>
                  ) : null}
                  {emp.hire_date ? (
                    <Caption className="text-muted-foreground">
                      Hired {formatDate(emp.hire_date)}
                      {tenure ? ` · ${tenure} on staff` : ""}
                    </Caption>
                  ) : null}
                  {emp.legacy_id != null ? (
                    <Caption className="text-muted-foreground">
                      GREENHRISMAIN {emp.legacy_id}
                    </Caption>
                  ) : null}
                </div>
              </div>
              {organizationId ? (
                <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
                  {needsReview && canLifecycle ? (
                    <Button type="button" size="sm" onClick={scrollToLifecycle}>
                      Resolve lifecycle
                    </Button>
                  ) : null}
                  {canLifecycle && isRehireEligible(emp) ? (
                    <DirectoryRehireDialog
                      organizationId={organizationId}
                      employee={emp}
                      onRehired={() => void load()}
                    />
                  ) : canLifecycle ? (
                    <>
                      {!completeness.ready_for_payroll && canCore ? (
                        <Button
                          type="button"
                          size="sm"
                          variant={needsReview ? "outline" : "default"}
                          asChild
                        >
                          <Link
                            href={`/people/c/${clientId}/${employeeId}/onboard`}
                          >
                            Complete 201
                          </Link>
                        </Button>
                      ) : null}
                      <DirectoryTransferDialog
                        organizationId={organizationId}
                        employeeId={emp.id}
                        employeeCode={emp.employee_code}
                        currentClientId={emp.client_id}
                        currentClientName={emp.client?.name ?? null}
                        status={emp.status}
                        onTransferred={(nextClientId) => {
                          router.push(
                            `/people/c/${nextClientId}/${emp.id}`
                          );
                        }}
                      />
                    </>
                  ) : null}
                  {canEditFile ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openEdit()}
                  >
                    Edit
                  </Button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {organizationId && (canCore || canLifecycle) ? (
          <div id="directory-lifecycle" className="scroll-mt-4">
            <DirectoryLifecyclePanel
              organizationId={organizationId}
              employee={emp}
              movements={file.movements as Array<Record<string, unknown>>}
              tenures={file.tenures ?? []}
              onChanged={() => void load()}
              onEditCompleteness={
                canEditFile ? (group) => openEdit(group) : undefined
              }
            />
          </div>
        ) : null}

        {organizationId && canEditFile ? (
          <div
            id="directory-edit-panel"
            className={cn(!editOpen && "hidden")}
          >
            <DirectoryEmployeeEditPanel
              organizationId={organizationId}
              employee={emp}
              open={editOpen}
              onOpenChange={(next) => {
                setEditOpen(next);
                if (!next) setEditFocusGroup(null);
              }}
              focusGroup={editFocusGroup}
              onSaved={(updated) => {
                setFile((prev) =>
                  prev
                    ? {
                        ...prev,
                        employee: { ...prev.employee, ...updated },
                      }
                    : prev
                );
                setEditOpen(false);
                setEditFocusGroup(null);
                void load();
              }}
            />
          </div>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            const params = new URLSearchParams(searchParams.toString());
            if (tab === "overview") params.delete("tab");
            else params.set("tab", tab);
            const qs = params.toString();
            router.replace(
              `/people/c/${clientId}/${employeeId}${qs ? `?${qs}` : ""}`
            );
          }}
          className="w-full space-y-4"
        >
          <TabsList className={cn(dbMobileTabList, "bg-muted/50")}>
            {canCore ? (
              <TabsTrigger value="overview" className={dbMobileTabTrigger}>
                Overview
              </TabsTrigger>
            ) : null}
            {canCore ? (
              <TabsTrigger value="job" className={dbMobileTabTrigger}>
                Job
              </TabsTrigger>
            ) : null}
            {canGovIds || canDocs ? (
              <TabsTrigger value="documents" className={dbMobileTabTrigger}>
                Documents
              </TabsTrigger>
            ) : null}
            {canPayChannel ? (
              <TabsTrigger value="bank" className={dbMobileTabTrigger}>
                Pay
              </TabsTrigger>
            ) : null}
            {canFamily ? (
              <TabsTrigger value="family" className={dbMobileTabTrigger}>
                Family
              </TabsTrigger>
            ) : null}
            {canHistory ? (
              <TabsTrigger value="history" className={dbMobileTabTrigger}>
                History
              </TabsTrigger>
            ) : null}
            {canHistory || canMedical ? (
              <TabsTrigger value="more" className={dbMobileTabTrigger}>
                More
              </TabsTrigger>
            ) : null}
          </TabsList>

          {canCore ? (
          <>
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Personal</CardTitle>
                <CardDescription>
                  Demographics and contact details on file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail
                    label="Last name"
                    value={formatProseDisplay(emp.last_name)}
                  />
                  <Detail
                    label="First name"
                    value={formatProseDisplay(emp.first_name)}
                  />
                  <Detail
                    label="Middle name"
                    value={formatProseDisplay(emp.middle_name)}
                  />
                  <Detail label="Legal name" value={legalName || displayName} />
                  <Detail label="Status" value={formatProseDisplay(emp.status)} />
                  <Detail label="Sex" value={dash(emp.sex)} />
                  <Detail label="Birth date" value={formatDate(emp.birth_date)} />
                  <Detail label="Email" value={dash(emp.email)} />
                  <Detail label="Mobile" value={dash(emp.mobile)} />
                  <Detail
                    label="Residential address"
                    value={formatProseDisplay(emp.address)}
                    className="sm:col-span-2"
                  />
                </div>
                <p className="mt-6 text-pretty text-sm leading-normal text-muted-foreground">
                  Completeness sits above. Numbers and scans are on{" "}
                  <Link
                    href={`/people/c/${clientId}/${employeeId}?tab=documents`}
                    className="font-medium text-primary underline-offset-2 hover:underline"
                  >
                    Documents
                  </Link>
                  .
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="job" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Role &amp; assignment</CardTitle>
                <CardDescription>
                  Client, branch, position, and employment dates.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail label="Client" value={formatProseDisplay(emp.client?.name)} />
                  <Detail label="Branch" value={formatProseDisplay(emp.branch?.name)} />
                  <Detail label="Location" value={formatProseDisplay(emp.branch?.location)} />
                  <Detail
                    label="Store"
                    value={formatProseDisplay(emp.department?.name)}
                  />
                  <Detail label="Position" value={formatProseDisplay(emp.position?.job_title)} />
                  <Detail
                    label="Department"
                    value={formatProseDisplay(emp.position?.department)}
                  />
                  <Detail label="Hire date" value={formatDate(emp.hire_date)} />
                  <Detail
                    label="First hire date"
                    value={formatDate(emp.first_hire_date ?? emp.hire_date)}
                  />
                  <Detail
                    label="Regular date"
                    value={formatDate(emp.regular_date)}
                  />
                  <Detail
                    label="Resign date"
                    value={formatDate(emp.resign_date)}
                  />
                </div>
                <div className="mt-8 border-t pt-6">
                  <p className="mb-3 text-balance text-base font-semibold leading-snug">
                    Compensation
                  </p>
                  {canAccessSalaryInfo ? (
                    <>
                      <div className="grid gap-6 sm:grid-cols-2">
                        <Detail
                          label="Daily rate (payroll)"
                          value={money(emp.daily_rate)}
                        />
                        <Detail
                          label="Daily rate (billing)"
                          value={money(emp.billing_daily_rate)}
                        />
                        <Detail label="ECOLA" value={money(emp.ecola)} />
                      </div>
                      <div className="mt-6">
                        <p className="mb-3 text-balance text-base font-semibold leading-snug">
                          Statutory preview
                        </p>
                        <DirectoryStatutoryPreview
                          dailyRate={emp.daily_rate}
                          statutorySchedule={clientSchedules?.statutory_schedule}
                          wtaxSchedule={clientSchedules?.wtax_schedule}
                        />
                      </div>
                    </>
                  ) : (
                    <p className="text-pretty text-sm leading-normal text-muted-foreground">
                      You do not have salary visibility for this account. Ask an
                      administrator if you need access.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          </>
          ) : null}

          {canGovIds || canDocs ? (
          <TabsContent value="documents" className="space-y-4">
            {canGovIds ? (
            <Card>
              <CardHeader>
                <CardTitle>Government numbers</CardTitle>
                <CardDescription>
                  Membership numbers used for remittance. Scans sit below.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail label="TIN" value={dash(emp.tin)} />
                  <Detail label="SSS" value={dash(emp.sss_number)} />
                  <Detail label="PhilHealth" value={dash(emp.philhealth_number)} />
                  <Detail label="Pag-IBIG" value={dash(emp.pagibig_number)} />
                  <Detail label="Tax status" value={formatProseDisplay(emp.tax_status)} />
                </div>
              </CardContent>
            </Card>
            ) : null}
            {canDocs ? (
            <Card>
              <CardHeader>
                <CardTitle>Scans</CardTitle>
                <CardDescription>
                  SSS, TIN, PhilHealth, Pag-IBIG, NBI, and other 201 attachments.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryDocumentsPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            ) : null}
          </TabsContent>
          ) : null}

          {canPayChannel ? (
          <TabsContent value="bank" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pay channel</CardTitle>
                <CardDescription>Bank or wallet used for payout.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail label="Pay through" value={formatProseDisplay(emp.pay_through)} />
                  <Detail label="Bank" value={formatProseDisplay(emp.bank_name)} />
                  <Detail label="Account" value={dash(emp.bank_account_no)} />
                  <Detail label="GCash" value={dash(emp.gcash)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          ) : null}

          {canFamily ? (
          <TabsContent value="family" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Emergency contacts</CardTitle>
                <CardDescription>
                  People listed on the 201 file. Admin/HR can add, edit, or
                  remove.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryContactsPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    contacts={file.contacts}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Dependents</CardTitle>
                <CardDescription>Family members on file.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="dependents"
                    rows={file.dependents}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          ) : null}

          {canHistory ? (
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job history</CardTitle>
                <CardDescription>Prior employers on the 201.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="job_history"
                    rows={file.job_history}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Movements</CardTitle>
                <CardDescription>
                  Status and assignment changes on file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="movements"
                    rows={file.movements}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          ) : null}

          {canHistory || canMedical ? (
          <TabsContent value="more" className="space-y-4">
            {canHistory ? (
            <>
            <Card>
              <CardHeader>
                <CardTitle>Education</CardTitle>
                <CardDescription>Schools and levels on the 201.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="education"
                    rows={file.education}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Licenses</CardTitle>
                <CardDescription>Training and license records.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="licenses"
                    rows={file.licenses}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Skills</CardTitle>
                <CardDescription>Skills listed on the 201.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="skills"
                    rows={file.skills}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            </>
            ) : null}
            {canMedical ? (
            <Card>
              <CardHeader>
                <CardTitle>Medical</CardTitle>
                <CardDescription>Medical clearances on file.</CardDescription>
              </CardHeader>
              <CardContent>
                {organizationId ? (
                  <DirectoryChildSheetPanel
                    organizationId={organizationId}
                    employeeId={employeeId}
                    sheetKey="medical"
                    rows={file.medical}
                    onChanged={() => void load()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">Loading…</p>
                )}
              </CardContent>
            </Card>
            ) : null}
          </TabsContent>
          ) : null}
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
