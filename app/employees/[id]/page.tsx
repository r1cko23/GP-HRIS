"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format, formatDistance } from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { H1, H3, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { cn } from "@/lib/utils";
import { dbPageWrapper } from "@/lib/dashboard-ui";

type OfficeLocationRow = {
  location_id: string;
  office_locations?: { id: string; name: string } | null;
};

type OvertimeGroupRow = {
  id: string;
  name: string;
  description: string | null;
} | null;

type EmployeeProfileRow = {
  id: string;
  employee_id: string;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_initial?: string | null;
  profile_picture_url?: string | null;
  assigned_hotel?: string | null;
  address?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  hire_date?: string | null;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  hmo_provider?: string | null;
  position?: string | null;
  job_level?: string | null;
  employee_type?: string | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  eligible_for_ot?: boolean | null;
  overtime_group_id?: string | null;
  transferred_from_employee_id?: string | null;
  is_active: boolean;
  sil_credits?: number | null;
  sil_days_used?: number;
  sil_allotted?: number;
  maternity_credits?: number | null;
  paternity_credits?: number | null;
  employee_location_assignments?: OfficeLocationRow[];
  overtime_groups?: OvertimeGroupRow;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  try {
    return format(new Date(value), "MMM d, yyyy");
  } catch {
    return "—";
  }
}

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
      <p className="mt-0.5 text-sm text-foreground break-words">{value ?? "—"}</p>
    </div>
  );
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const supabase = createClient();
  const router = useRouter();
  const { canAccessSalaryInfo } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [employee, setEmployee] = useState<EmployeeProfileRow | null>(null);
  const [transferredFrom, setTransferredFrom] = useState<{
    employee_id: string;
    full_name: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canRead("employees")) {
      router.replace("/overtime-approval");
    }
  }, [canRead, permissionsLoading, router]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .select(
          `
            *,
            employee_location_assignments (
              location_id,
              office_locations ( id, name )
            ),
            overtime_groups ( id, name, description )
          `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      const row = data as EmployeeProfileRow;
      setEmployee(row);

      const tfId = row.transferred_from_employee_id;
      if (tfId) {
        const { data: prev } = await supabase
          .from("employees")
          .select("employee_id, full_name")
          .eq("id", tfId)
          .maybeSingle();
        if (prev) {
          setTransferredFrom(prev as { employee_id: string; full_name: string });
        } else {
          setTransferredFrom(null);
        }
      } else {
        setTransferredFrom(null);
      }
    } catch (e: unknown) {
      console.error(e);
      toast.error("Could not load this employee.");
      router.push("/employees");
    } finally {
      setLoading(false);
    }
  }, [id, supabase, router]);

  useEffect(() => {
    if (!permissionsLoading && canRead("employees") && id) {
      load();
    }
  }, [permissionsLoading, canRead, id, load]);

  if (!permissionsLoading && !canRead("employees")) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full p-8">
          <BodySmall>Redirecting…</BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  if (loading || !employee) {
    return (
      <DashboardLayout>
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const locationNames =
    employee.employee_location_assignments
      ?.map((a) => a.office_locations?.name)
      .filter((n): n is string => Boolean(n)) ?? [];

  const tenure =
    employee.hire_date != null && employee.hire_date !== ""
      ? formatDistance(new Date(employee.hire_date), new Date(), {
          addSuffix: false,
        })
      : null;

  const otGroup = employee.overtime_groups;

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-5xl pb-24", dbPageWrapper)}>
          <HStack justify="between" align="start" className="flex-wrap gap-4">
            <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
              <Link href="/employees">
                <Icon name="CaretLeft" size={IconSizes.sm} />
                Employee directory
              </Link>
            </Button>
          </HStack>

          <Card className="overflow-hidden border-muted/80">
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
                <HStack gap="4" align="start" className="min-w-0">
                  <EmployeeAvatar
                    profilePictureUrl={employee.profile_picture_url}
                    fullName={employee.full_name}
                    size="lg"
                    className="h-16 w-16 sm:h-20 sm:w-20 shrink-0"
                  />
                  <VStack gap="2" align="start" className="min-w-0">
                    <H1 className="text-2xl sm:text-3xl leading-tight break-words">
                      {employee.full_name}
                    </H1>
                    <HStack gap="2" align="center" className="flex-wrap">
                      <Caption className="font-mono text-sm">
                        {employee.employee_id}
                      </Caption>
                      <Badge
                        variant="outline"
                        className={
                          employee.is_active
                            ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                            : "bg-slate-100 text-slate-800 border-slate-200"
                        }
                      >
                        {employee.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {employee.job_level ? (
                        <Badge variant="outline" className="text-xs">
                          {employee.job_level}
                        </Badge>
                      ) : null}
                    </HStack>
                    {employee.position ? (
                      <BodySmall className="text-muted-foreground">
                        {employee.position}
                      </BodySmall>
                    ) : null}
                    {employee.hire_date ? (
                      <Caption className="text-muted-foreground">
                        Hired {formatDate(employee.hire_date)}
                        {tenure ? ` · ${tenure} on staff` : ""}
                      </Caption>
                    ) : null}
                  </VStack>
                </HStack>
                <HStack gap="2" className="shrink-0 sm:flex-col sm:items-stretch">
                  <Button asChild>
                    <Link href={`/employees/${employee.id}/edit`}>
                      <Icon name="PencilSimple" size={IconSizes.sm} className="mr-1.5" />
                      Edit record
                    </Link>
                  </Button>
                </HStack>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="overview" className="w-full space-y-4">
            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-muted/50 p-1">
              <TabsTrigger value="overview" className="flex-none">
                Overview
              </TabsTrigger>
              <TabsTrigger value="job" className="flex-none">
                Job &amp; workplace
              </TabsTrigger>
              <TabsTrigger value="compliance" className="flex-none">
                IDs &amp; benefits
              </TabsTrigger>
              <TabsTrigger value="leave" className="flex-none">
                Leave balances
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
                    <Detail
                      label="Legal name"
                      value={
                        [employee.first_name, employee.middle_initial ? `${employee.middle_initial}.` : null, employee.last_name]
                          .filter(Boolean)
                          .join(" ") || employee.full_name
                      }
                    />
                    <Detail
                      label="Gender"
                      value={
                        employee.gender
                          ? employee.gender.charAt(0).toUpperCase() +
                            employee.gender.slice(1)
                          : "—"
                      }
                    />
                    <Detail label="Birth date" value={formatDate(employee.birth_date)} />
                    <Detail label="Residential address" value={employee.address || "—"} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="job" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Role &amp; assignment</CardTitle>
                  <CardDescription>
                    Position, locations, and approval routing group.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Detail label="Position" value={employee.position || "—"} />
                    <Detail label="Job level" value={employee.job_level || "—"} />
                    <Detail
                      label="Employee type"
                      value={
                        employee.employee_type === "client-based"
                          ? "Client-based"
                          : employee.employee_type === "office-based"
                            ? "Office-based"
                            : "—"
                      }
                    />
                    <Detail
                      label="Primary property / hotel label"
                      value={employee.assigned_hotel || "—"}
                    />
                    <Detail
                      label="Eligible for overtime"
                      value={employee.eligible_for_ot ? "Yes" : "No"}
                    />
                  </div>
                  <div>
                    <Caption className="text-muted-foreground">Assigned locations</Caption>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {locationNames.length === 0 ? (
                        <span className="text-sm text-muted-foreground">—</span>
                      ) : (
                        locationNames.map((name) => (
                          <Badge key={name} variant="outline" className="text-xs">
                            {name}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Detail
                      label="Approval group"
                      value={
                        otGroup ? (
                          <span>
                            {otGroup.name}
                            {otGroup.description ? (
                              <span className="text-muted-foreground">
                                {" "}
                                — {otGroup.description}
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          "—"
                        )
                      }
                    />
                    <Detail
                      label="Transferred from (prior record)"
                      value={
                        transferredFrom ? (
                          <Link
                            href={`/employees/${employee.transferred_from_employee_id}`}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {transferredFrom.full_name} ({transferredFrom.employee_id})
                          </Link>
                        ) : (
                          "—"
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="compliance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Government &amp; benefits</CardTitle>
                  <CardDescription>
                    Statutory IDs and HMO. Rates visible only with salary access.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Detail label="TIN" value={employee.tin_number || "—"} />
                    <Detail label="SSS" value={employee.sss_number || "—"} />
                    <Detail label="PhilHealth" value={employee.philhealth_number || "—"} />
                    <Detail label="Pag-IBIG" value={employee.pagibig_number || "—"} />
                    <Detail label="HMO provider" value={employee.hmo_provider || "—"} className="sm:col-span-2" />
                  </div>
                  <div className="mt-8 border-t pt-6">
                    <H3 className="mb-3 text-base">Compensation</H3>
                    {canAccessSalaryInfo ? (
                      <div className="grid gap-6 sm:grid-cols-2">
                        <Detail
                          label="Monthly rate"
                          value={
                            employee.monthly_rate != null
                              ? formatCurrency(employee.monthly_rate)
                              : "—"
                          }
                        />
                        <Detail
                          label="Per day rate"
                          value={
                            employee.per_day != null
                              ? formatCurrency(employee.per_day)
                              : "—"
                          }
                        />
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

            <TabsContent value="leave" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Leave snapshot</CardTitle>
                  <CardDescription>
                    Current balances in the system (SIL, maternity, paternity).
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail
                      label="SIL allotted"
                      value={
                        employee.sil_allotted != null ? String(employee.sil_allotted) : "—"
                      }
                    />
                    <Detail
                      label="SIL days used"
                      value={
                        employee.sil_days_used != null ? String(employee.sil_days_used) : "—"
                      }
                    />
                    <Detail
                      label="SIL credits"
                      value={
                        employee.sil_credits != null ? String(employee.sil_credits) : "—"
                      }
                    />
                    <Detail
                      label="Maternity (days)"
                      value={
                        employee.maternity_credits != null
                          ? String(employee.maternity_credits)
                          : "—"
                      }
                    />
                    <Detail
                      label="Paternity (days)"
                      value={
                        employee.paternity_credits != null
                          ? String(employee.paternity_credits)
                          : "—"
                      }
                    />
                  </div>
                  <p className="mt-6 text-xs text-muted-foreground">
                    Accruals and usage are maintained by payroll rules. Use Schedules
                    and Leave approval for day-to-day changes.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
      </div>
    </DashboardLayout>
  );
}
