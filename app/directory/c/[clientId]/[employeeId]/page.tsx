"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbMobileTabList, dbMobileTabTrigger, dbPageWrapper } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import { DirectoryStatusBadge } from "@/components/directory/DirectoryStatusBadge";
import { DirectoryEmployeeEditPanel } from "@/components/directory/DirectoryEmployeeEditPanel";
import { DirectoryRehireDialog } from "@/components/directory/DirectoryRehireDialog";
import { DirectoryTransferDialog } from "@/components/directory/DirectoryTransferDialog";
import { DirectoryLifecyclePanel } from "@/components/directory/DirectoryLifecyclePanel";
import type { CompletenessEditGroup } from "@/components/directory/DirectoryLifecyclePanel";
import {
  DirectoryContactsPanel,
  type DirectoryContact,
} from "@/components/directory/DirectoryContactsPanel";
import { DirectoryChildSheetPanel } from "@/components/directory/DirectoryChildSheetPanel";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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
  position_id?: string | null;
  client: Rel;
  branch: Rel;
  position: Rel;
};

type FilePayload = {
  employee: Employee;
  contacts: DirectoryContact[];
  dependents: Array<Record<string, unknown>>;
  education: Array<Record<string, unknown>>;
  job_history: Array<Record<string, unknown>>;
  licenses: Array<Record<string, unknown>>;
  medical: Array<Record<string, unknown>>;
  movements: Array<Record<string, unknown>>;
  skills: Array<Record<string, unknown>>;
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

function dash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
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


export default function Directory201Page() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : "";
  const { canAccessSalaryInfo } = useUserRole();
  const [file, setFile] = useState<FilePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editFocusGroup, setEditFocusGroup] =
    useState<CompletenessEditGroup | null>(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load 201 file");
    } finally {
      setLoading(false);
    }
  }, [clientId, employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !file) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error && !file) {
    return (
      <DashboardLayout>
        <div className={cn("mx-auto w-full max-w-5xl pb-24", dbPageWrapper)}>
          <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
            <Link href={`/directory/c/${clientId}`}>
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

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-5xl pb-24", dbPageWrapper)}>
        <div className="space-y-3">
          <DirectoryBreadcrumb
            items={[
              { label: "Directory", href: "/directory" },
              {
                label: emp.client?.name ?? "Client",
                href: `/directory/c/${clientId}`,
              },
              { label: displayName },
            ]}
          />
          <HStack justify="between" align="start" className="flex-wrap gap-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
              <Link href={`/directory/c/${clientId}`}>
                <Icon name="CaretLeft" size={IconSizes.sm} />
                Employees
              </Link>
            </Button>
            <Caption className="text-muted-foreground">201 file</Caption>
          </HStack>
        </div>

        {emp.is_current_engagement === false && emp.superseded_by ? (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="status"
          >
            This is a superseded rehire file.{" "}
            <Link
              href={`/directory/c/${clientId}/${emp.superseded_by}`}
              className="font-medium underline underline-offset-2"
            >
              Open current engagement →
            </Link>
          </div>
        ) : null}

        <Card className="overflow-hidden border-muted/80">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
              <HStack gap="4" align="start" className="min-w-0">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-lg font-semibold text-muted-foreground sm:h-20 sm:w-20">
                  {(emp.first_name?.[0] ?? "?").toUpperCase()}
                  {(emp.last_name?.[0] ?? "").toUpperCase()}
                </div>
                <VStack gap="2" align="start" className="min-w-0">
                  <H1 className="break-words text-2xl leading-tight sm:text-3xl">
                    {displayName}
                  </H1>
                  <HStack gap="2" align="center" className="flex-wrap">
                    <Caption className="font-mono text-sm">
                      {emp.employee_code ?? "—"}
                    </Caption>
                    <DirectoryStatusBadge
                      status={emp.status}
                      showHint
                      needsReview={
                        emp.needs_review === true ||
                        emp.lifecycle_flag === "needs_review"
                      }
                    />
                    {emp.client?.name ? (
                      <Badge variant="outline" className="text-xs">
                        {emp.client.name}
                      </Badge>
                    ) : null}
                  </HStack>
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
                </VStack>
              </HStack>
              {organizationId ? (
                <HStack gap="2" align="center" className="flex-wrap">
                  <DirectoryTransferDialog
                    organizationId={organizationId}
                    employeeId={emp.id}
                    employeeCode={emp.employee_code}
                    currentClientId={emp.client_id}
                    currentClientName={emp.client?.name ?? null}
                    status={emp.status}
                    onTransferred={(nextClientId) => {
                      router.push(
                        `/directory/c/${nextClientId}/${emp.id}`
                      );
                    }}
                  />
                  <DirectoryRehireDialog
                    organizationId={organizationId}
                    employee={emp}
                    onRehired={() => void load()}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditFocusGroup(null);
                      setEditOpen(true);
                    }}
                  >
                    Edit 201 fields
                  </Button>
                </HStack>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {organizationId ? (
          <DirectoryLifecyclePanel
            organizationId={organizationId}
            employee={emp}
            movements={file.movements as Array<Record<string, unknown>>}
            onChanged={() => void load()}
            onEditCompleteness={(group) => {
              setEditFocusGroup(group);
              setEditOpen(true);
              window.setTimeout(() => {
                document
                  .getElementById("directory-edit-panel")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" });
              }, 50);
            }}
          />
        ) : null}

        {organizationId ? (
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

        <Tabs defaultValue="overview" className="w-full space-y-4">
          <TabsList className={cn(dbMobileTabList, "bg-muted/50")}>
            <TabsTrigger value="overview" className={dbMobileTabTrigger}>
              Overview
            </TabsTrigger>
            <TabsTrigger value="job" className={dbMobileTabTrigger}>
              Job &amp; workplace
            </TabsTrigger>
            <TabsTrigger value="compliance" className={dbMobileTabTrigger}>
              IDs &amp; benefits
            </TabsTrigger>
            <TabsTrigger value="bank" className={dbMobileTabTrigger}>
              Bank
            </TabsTrigger>
            <TabsTrigger value="contacts" className={dbMobileTabTrigger}>
              Contacts
            </TabsTrigger>
            <TabsTrigger value="dependents" className={dbMobileTabTrigger}>
              Dependents
            </TabsTrigger>
            <TabsTrigger value="education" className={dbMobileTabTrigger}>
              Education
            </TabsTrigger>
            <TabsTrigger value="work" className={dbMobileTabTrigger}>
              Job history
            </TabsTrigger>
            <TabsTrigger value="medical" className={dbMobileTabTrigger}>
              Medical
            </TabsTrigger>
            <TabsTrigger value="licenses" className={dbMobileTabTrigger}>
              Licenses
            </TabsTrigger>
            <TabsTrigger value="skills" className={dbMobileTabTrigger}>
              Skills
            </TabsTrigger>
            <TabsTrigger value="movements" className={dbMobileTabTrigger}>
              Movements
            </TabsTrigger>
          </TabsList>

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
                  <Detail label="Legal name" value={legalName || displayName} />
                  <Detail label="Sex" value={dash(emp.sex)} />
                  <Detail label="Birth date" value={formatDate(emp.birth_date)} />
                  <Detail label="Email" value={dash(emp.email)} />
                  <Detail label="Mobile" value={dash(emp.mobile)} />
                  <Detail
                    label="Residential address"
                    value={dash(emp.address)}
                    className="sm:col-span-2"
                  />
                </div>
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
                  <Detail label="Client" value={dash(emp.client?.name)} />
                  <Detail label="Branch" value={dash(emp.branch?.name)} />
                  <Detail label="Location" value={dash(emp.branch?.location)} />
                  <Detail label="Position" value={dash(emp.position?.job_title)} />
                  <Detail
                    label="Department"
                    value={dash(emp.position?.department)}
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
                  <p className="mb-3 text-base font-semibold">Compensation</p>
                  {canAccessSalaryInfo ? (
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
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      You do not have salary visibility for this account. Ask an
                      administrator if you need access.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Government &amp; benefits</CardTitle>
                <CardDescription>
                  Statutory IDs from the 201 file.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail label="TIN" value={dash(emp.tin)} />
                  <Detail label="SSS" value={dash(emp.sss_number)} />
                  <Detail label="PhilHealth" value={dash(emp.philhealth_number)} />
                  <Detail label="Pag-IBIG" value={dash(emp.pagibig_number)} />
                  <Detail label="Tax status" value={dash(emp.tax_status)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bank" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pay channel</CardTitle>
                <CardDescription>Bank or wallet used for payout.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 sm:grid-cols-2">
                  <Detail label="Pay through" value={dash(emp.pay_through)} />
                  <Detail label="Bank" value={dash(emp.bank_name)} />
                  <Detail label="Account" value={dash(emp.bank_account_no)} />
                  <Detail label="GCash" value={dash(emp.gcash)} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contacts" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="dependents" className="space-y-4">
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

          <TabsContent value="education" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="work" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="medical" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="licenses" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
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
          </TabsContent>

          <TabsContent value="movements" className="space-y-4">
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
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
