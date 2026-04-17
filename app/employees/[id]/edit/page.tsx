"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { BodySmall } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { EmployeeFormFields } from "@/components/employees/EmployeeFormFields";
import {
  createEmptyEmployeeForm,
  employeeRecordToFormData,
  type EmployeeFormData,
  type EmployeeForForm,
} from "@/lib/employees/employeeFormState";
import { saveEmployeeRecord } from "@/lib/employees/saveEmployeeRecord";

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

export default function EditEmployeePage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, isHR, canAccessSalaryInfo } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const [formData, setFormData] = useState<EmployeeFormData>(
    createEmptyEmployeeForm()
  );
  const [editingEmployee, setEditingEmployee] = useState<EmployeeForForm | null>(null);
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

  const loadAll = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [empRes, locRes, ogRes, listRes] = await Promise.all([
        supabase
          .from("employees")
          .select(
            `*,
            employee_location_assignments (
              location_id,
              office_locations ( id, name )
            )`
          )
          .eq("id", id)
          .single(),
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

      if (empRes.error) throw empRes.error;
      if (locRes.error) throw locRes.error;
      if (ogRes.error) throw ogRes.error;
      if (listRes.error) throw listRes.error;

      const row = empRes.data as EmployeeForForm;
      setEditingEmployee(row);
      setFormData(employeeRecordToFormData(row));
      setLocations((locRes.data || []) as Location[]);
      setOvertimeGroups((ogRes.data || []) as OvertimeGroup[]);
      setTransferList(
        ((listRes.data || []) as TransferEmp[]).filter((e) => e.id !== id)
      );
    } catch (e: unknown) {
      console.error(e);
      toast.error("Failed to load employee");
      router.push("/employees");
    } finally {
      setLoading(false);
    }
  }, [id, supabase, router]);

  useEffect(() => {
    if (!permissionsLoading && canRead("employees") && id) {
      loadAll();
    }
  }, [permissionsLoading, canRead, id, loadAll]);

  const toggleLocationSelection = (locationId: string) => {
    setFormData((prev) => {
      const exists = prev.locations.includes(locationId);
      return {
        ...prev,
        locations: exists
          ? prev.locations.filter((l) => l !== locationId)
          : [...prev.locations, locationId],
      };
    });
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingEmployee) return;
    setSubmitting(true);
    try {
      await saveEmployeeRecord({
        supabase,
        formData,
        locations,
        editingEmployee,
        isAdmin,
        isHR,
      });
      const displayName = `${formData.first_name} ${formData.last_name}`.trim();
      toast.success("Employee updated successfully!", {
        description: `${displayName} • ${formData.employee_id}`,
      });
      router.push(`/employees/${editingEmployee.id}`);
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

  const hireDateEditable = isAdmin;
  const titleName = editingEmployee?.full_name || "Employee";

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-4xl pb-32">
        <VStack gap="6" className="w-full">
          <DashboardPageHeader
            above={
              <HStack gap="2" align="center" className="flex-wrap">
                <Button variant="ghost" size="sm" asChild className="-ml-2 h-8 gap-1">
                  <Link href="/employees">
                    <Icon name="CaretLeft" size={IconSizes.sm} />
                    Directory
                  </Link>
                </Button>
                {id ? (
                  <Button variant="ghost" size="sm" asChild className="h-8 gap-1">
                    <Link href={`/employees/${id}`}>
                      <Icon name="User" size={IconSizes.sm} />
                      Profile
                    </Link>
                  </Button>
                ) : null}
              </HStack>
            }
            title="Edit employee"
            description={
              loading ? "Loading…" : `${titleName} · ${editingEmployee?.employee_id ?? ""}`
            }
          />

          <Card>
            <CardHeader>
              <CardTitle>Employee details</CardTitle>
              <CardDescription>
                Employee ID cannot be changed. Hire date can only be changed by admins.
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
                    hireDateEditable={hireDateEditable}
                    employeeIdEditable={false}
                    canAccessSalaryInfo={!!canAccessSalaryInfo}
                    onToggleLocation={toggleLocationSelection}
                  />
                  <div className="sticky bottom-0 -mx-6 border-t bg-background px-6 py-4 mt-8 flex justify-end gap-2">
                    <Button type="button" variant="outline" asChild>
                      <Link href={`/employees/${id}`}>Cancel</Link>
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Saving…" : "Update"}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </VStack>
      </div>
    </DashboardLayout>
  );
}
