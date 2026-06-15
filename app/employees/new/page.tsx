"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { BodySmall } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { EmployeeFormFields } from "@/components/employees/EmployeeFormFields";
import {
  createEmptyEmployeeForm,
  type EmployeeFormData,
} from "@/lib/employees/employeeFormState";
import { saveEmployeeRecord } from "@/lib/employees/saveEmployeeRecord";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

interface Location {
  id: string;
  name: string;
}

interface OvertimeGroup {
  id: string;
  name: string;
  description: string | null;
}

interface TransferEmp {
  id: string;
  employee_id: string;
  full_name: string;
}

export default function NewEmployeePage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, isHR, canAccessSalaryInfo } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [formData, setFormData] = useState<EmployeeFormData>(createEmptyEmployeeForm);
  const [locations, setLocations] = useState<Location[]>([]);
  const [overtimeGroups, setOvertimeGroups] = useState<OvertimeGroup[]>([]);
  const [transferList, setTransferList] = useState<TransferEmp[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (permissionsLoading) return;
    if (!canRead("employees")) {
      router.replace("/overtime-approval");
    }
  }, [canRead, permissionsLoading, router]);

  const loadRefs = useCallback(async () => {
    setLoading(true);
    try {
      const [locRes, ogRes, empRes] = await Promise.all([
        supabase
          .from("office_locations")
          .select("id, name")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("overtime_groups")
          .select("id, name, description")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("employees")
          .select("id, employee_id, full_name")
          .order("full_name", { ascending: true }),
      ]);

      if (locRes.error) throw locRes.error;
      if (ogRes.error) throw ogRes.error;
      if (empRes.error) throw empRes.error;

      setLocations((locRes.data || []) as Location[]);
      setOvertimeGroups((ogRes.data || []) as OvertimeGroup[]);
      setTransferList((empRes.data || []) as TransferEmp[]);
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load form data");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!permissionsLoading && canRead("employees")) {
      loadRefs();
    }
  }, [permissionsLoading, canRead, loadRefs]);

  const toggleLocationSelection = (locationId: string) => {
    setFormData((prev) => {
      const exists = prev.locations.includes(locationId);
      return {
        ...prev,
        locations: exists
          ? prev.locations.filter((id) => id !== locationId)
          : [...prev.locations, locationId],
      };
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const newId = await saveEmployeeRecord({
        supabase,
        formData,
        locations,
        editingEmployee: null,
        isAdmin,
        isHR,
      });
      toast.success("Employee added successfully!", {
        description: `${formData.first_name} ${formData.last_name} • Portal password set to Employee ID`,
      });
      router.push(newId ? `/employees/${newId}` : "/employees");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save employee";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!permissionsLoading && !canRead("employees")) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full p-8">
          <BodySmall>Redirecting…</BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("mx-auto w-full max-w-4xl pb-32", dbPageWrapper)}>
          <DashboardPageHeader
            above={
              <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1 w-fit">
                <Link href="/employees">
                  <Icon name="CaretLeft" size={IconSizes.sm} />
                  Directory
                </Link>
              </Button>
            }
            title="Add employee"
            description="Create a new employee record and portal access."
          />

          <Card>
            <CardHeader>
              <CardTitle>Employee details</CardTitle>
              <CardDescription>
                All sections scroll; use Cancel to return without saving.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <EmployeeFormFields
                    formData={formData}
                    setFormData={setFormData}
                    locations={locations}
                    overtimeGroups={overtimeGroups}
                    transferEmployeeOptions={transferList}
                    hireDateEditable
                    employeeIdEditable
                    canAccessSalaryInfo={!!canAccessSalaryInfo}
                    onToggleLocation={toggleLocationSelection}
                  />
                  <div className="sticky bottom-0 -mx-6 border-t bg-background px-6 py-4 mt-8 flex justify-end gap-2">
                    <Button type="button" variant="outline" asChild>
                      <Link href="/employees">Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving…" : "Create"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
      </div>
    </DashboardLayout>
  );
}
