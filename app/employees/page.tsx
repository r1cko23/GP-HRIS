"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, startOfWeek } from "date-fns";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { useCurrentUser } from "@/lib/hooks/useCurrentUser";
import { useSessionQuery } from "@/lib/hooks/useSessionQuery";
import { bustCache } from "@/lib/cache-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BodySmall, Caption } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { CardSection } from "@/components/ui/card-section";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { cn } from "@/lib/utils";
import { DbDesktopBlock, DbMobileBlock } from "@/components/dashboard/DashboardViewport";
import { DashboardMobileField } from "@/components/dashboard/DashboardMobileField";
import {
  dbHeaderActions,
  dbHeaderButton,
  dbMobileListCard,
  dbPageWrapper,
  dbTableShell,
} from "@/lib/dashboard-ui";

interface Employee {
  id: string;
  employee_id: string;
  full_name: string;
  profile_picture_url?: string | null;
  gender?: "male" | "female" | null;
  sil_credits?: number;
  last_name?: string | null;
  first_name?: string | null;
  middle_initial?: string;
  assigned_hotel?: string;
  address?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  tin_number?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  hmo_provider?: string | null;
  position?: string | null;
  job_level?: string | null;
  employee_type?: "office-based" | "client-based" | null;
  monthly_rate?: number | null;
  per_day?: number | null;
  eligible_for_ot?: boolean | null;
  overtime_group_id?: string | null;
  is_active: boolean;
  created_at: string;
  employee_location_assignments?: {
    location_id: string;
    office_locations?: { id: string; name: string } | null;
  }[];
}

interface Location {
  id: string;
  name: string;
}

type EmployeesListResponse = {
  employees: Employee[];
  locations: { id: string; name: string }[];
};

type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  tasks: string | null;
};

const getColorStyleForEmployee = (employeeId: string) => {
  const hash = employeeId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const bg = `hsl(${hue}deg 80% 94%)`;
  const border = `hsl(${hue}deg 70% 82%)`;
  const text = `hsl(${hue}deg 45% 28%)`;
  return { bg, border, text };
};

export default function EmployeesPage() {
  const supabase = createClient();
  const router = useRouter();
  const { isAdmin, isHR, loading: roleLoading } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const { user } = useCurrentUser();
  const {
    data: listData,
    loading,
    error: listError,
    refresh,
  } = useSessionQuery<EmployeesListResponse>(
    user ? `employees:list:${user.id}` : null,
    "/api/employees/list",
    { enabled: !!user && !permissionsLoading && canRead("employees") }
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"directory" | "schedules">(
    "directory"
  );
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordEmployee, setPasswordEmployee] = useState<Employee | null>(
    null
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [filters, setFilters] = useState<{ employee_id: string }>({
    employee_id: "all",
  });
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedScheduleEntry, setSelectedScheduleEntry] =
    useState<ScheduleRow | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [listPage, setListPage] = useState(1);
  const LIST_PAGE_SIZE = 50;

  const locationMap = useMemo(() => {
    const map = new Map<string, string>();
    locations.forEach((loc) => map.set(loc.id, loc.name));
    return map;
  }, [locations]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  const scheduleAllowed =
    isAdmin || isHR;

  // Account managers (approvers) and viewers have no employees read permission
  useEffect(() => {
    if (permissionsLoading) return;
    if (!canRead("employees")) {
      router.replace("/overtime-approval");
    }
  }, [canRead, permissionsLoading, router]);

  useEffect(() => {
    if (!listData) return;
    setEmployees(listData.employees);
    setLocations(listData.locations);
  }, [listData]);

  useEffect(() => {
    if (listError && employees.length === 0) {
      toast.error(`Failed to load employees: ${listError}`);
    }
  }, [listError, employees.length]);

  useEffect(() => {
    if (activeTab === "schedules" && scheduleAllowed) {
      loadWeek();
    }
  }, [activeTab, weekStart, filters.employee_id, scheduleAllowed]);

  if (!permissionsLoading && !canRead("employees")) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full">
          <BodySmall>Redirecting…</BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  async function fetchEmployees() {
    await bustCache();
    await refresh({ force: true });
  }

  async function loadWeek() {
    setScheduleLoading(true);
    const { data, error } = await supabase.rpc(
      "get_week_schedule_for_manager",
      {
        p_week_start: format(weekStart, "yyyy-MM-dd"),
        p_employee_id:
          filters.employee_id === "all" ? null : filters.employee_id,
      } as any
    );
    if (error) {
      toast.error(error.message || "Failed to load schedules");
    } else {
      setScheduleRows((data || []) as ScheduleRow[]);
    }
    setScheduleLoading(false);
  }

  async function toggleEmployeeStatus(employee: Employee) {
    try {
      // Get current user for audit tracking
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        toast.error("Authentication error. Please log in again.");
        return;
      }

      const { error } = await (supabase.from("employees") as any)
        .update({
          is_active: !employee.is_active,
          updated_by: authUser.id,
        })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success(
        `Employee ${
          employee.is_active ? "deactivated" : "activated"
        } successfully!`,
        {
          description: `${employee.full_name} • ${employee.employee_id}`,
        }
      );
      await bustCache();
      await refresh({ force: true });
    } catch (error: any) {
      console.error("Error toggling employee status:", error);
      toast.error("Failed to update employee status");
    }
  }

  function openPasswordModal(employee: Employee) {
    setPasswordEmployee(employee);
    setNewPassword("");
    setConfirmPassword("");
    setShowPasswordModal(true);
  }

  async function handlePasswordUpdate(e: React.FormEvent) {
    e.preventDefault();

    if (!passwordEmployee) return;

    if (!newPassword.trim()) {
      toast.error("Password cannot be empty");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 4) {
      toast.error("Password must be at least 4 characters long");
      return;
    }

    setPasswordSubmitting(true);

    try {
      // Get current user for audit tracking
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (!authUser) {
        toast.error("Authentication error. Please log in again.");
        setPasswordSubmitting(false);
        return;
      }

      const { error } = await (supabase.from("employees") as any)
        .update({
          portal_password: newPassword.trim(),
          updated_by: authUser.id,
        })
        .eq("id", passwordEmployee.id);

      if (error) throw error;

      toast.success("Portal password updated successfully!", {
        description: `${passwordEmployee.full_name} • ${passwordEmployee.employee_id}`,
      });
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error updating password:", error);
      toast.error(error.message || "Failed to update password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function resetPasswordToDefault(employee: Employee) {
    if (
      !confirm(
        "Reset password to Employee ID? This will set the password to: " +
          employee.employee_id
      )
    ) {
      return;
    }

    setPasswordSubmitting(true);

    try {
      const { error } = await (supabase.from("employees") as any)
        .update({ portal_password: employee.employee_id })
        .eq("id", employee.id);

      if (error) throw error;

      toast.success("Password reset to Employee ID");
      setShowPasswordModal(false);
      fetchEmployees();
    } catch (error: any) {
      console.error("Error resetting password:", error);
      toast.error(error.message || "Failed to reset password");
    } finally {
      setPasswordSubmitting(false);
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.employee_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const listTotalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / LIST_PAGE_SIZE)
  );
  const safeListPage = Math.min(listPage, listTotalPages);
  const pagedEmployees = filteredEmployees.slice(
    (safeListPage - 1) * LIST_PAGE_SIZE,
    safeListPage * LIST_PAGE_SIZE
  );

  const groupedSchedules = weekDays.map((d) => {
    const iso = format(d, "yyyy-MM-dd");
    return {
      date: iso,
      label: format(d, "EEE, MMM d"),
      entries: scheduleRows.filter((r) => r.schedule_date === iso),
    };
  });

  // Helper function to clean position field (remove salary info)
  const cleanPosition = (position: string | null | undefined): string => {
    if (!position) return "";
    // Remove salary information in parentheses like "(22,000)" or "(18,070.00)"
    return position.replace(/\s*\([^)]*\)/g, "").trim();
  };

  // Export employee masterlist to PDF
  async function exportEmployeeMasterlistToPDF() {
    setGeneratingPDF(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const doc = new jsPDF("landscape", "mm", "a4");
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let yPos = 15;

      // Load and add logo
      try {
        const logoResponse = await fetch("/gp-logo.webp");
        if (logoResponse.ok) {
          const logoBlob = await logoResponse.blob();
          const logoDataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(logoBlob);
          });

          // Logo dimensions: 500x185 original, scale to fit
          const logoWidth = 50; // mm
          const logoHeight = (logoWidth * 185) / 500; // Maintain aspect ratio
          const logoX = 15; // Left align

          doc.addImage(logoDataUrl, "WEBP", logoX, yPos, logoWidth, logoHeight);
          yPos += logoHeight + 8;
        }
      } catch (error) {
        console.warn("Logo could not be loaded, continuing without logo", error);
      }

      // Company name
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("GREEN PASTURE", 15, yPos);
      yPos += 6;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("PEOPLE MANAGEMENT INC.", 15, yPos);
      yPos += 8;

      // Document title
      doc.setFontSize(14);
      doc.setFont("helvetica", "normal");
      doc.text("Active List/Master Employees", 15, yPos);
      yPos += 6;

      // Client name and date
      doc.setFontSize(10);
      doc.text("Client Name: GREEN PASTURE PEOPLE I", 15, yPos);
      yPos += 5;
      doc.text(`As of ${format(new Date(), "MM/dd/yyyy")}`, 15, yPos);
      yPos += 10;

      // Prepare table data - use all employees for masterlist
      const tableData = employees.map((emp, index) => {
        // Get department from assigned locations or assigned_hotel
        const department =
          emp.employee_location_assignments
            ?.map((a) => a.office_locations?.name || locationMap.get(a.location_id) || null)
            .filter((name): name is string => Boolean(name))
            .join(", ") || emp.assigned_hotel || "";

        // Clean position to remove salary info
        const cleanPos = cleanPosition(emp.position);

        return [
          (index + 1).toString(), // #
          emp.employee_id || "", // EMPID
          emp.last_name || "", // Last Name
          emp.first_name || "", // First Name
          emp.middle_initial || "", // Middle Name
          emp.address || "", // Address
          "", // Contact No (not in schema)
          department, // Department
          cleanPos, // Position (without salary)
          emp.birth_date ? format(new Date(emp.birth_date), "MM/dd/yyyy") : "", // Birth Date
          emp.hire_date ? format(new Date(emp.hire_date), "MM/dd/yyyy") : "", // Date Hired
          emp.tin_number || "", // Tin #
          emp.sss_number || "", // SSS #
          emp.philhealth_number || "", // Phil Health
          emp.pagibig_number || "", // Pagibig
          emp.is_active ? "Regular" : "Inactive", // Status
          "", // NBIno (not in schema)
          "", // Police Clr (not in schema)
          "", // Brgy (not in schema)
        ];
      });

      // Define table columns
      const columns = [
        "#",
        "EMPID",
        "Last Name",
        "First Name",
        "Middle Name",
        "Address",
        "Contact No",
        "Department",
        "Position",
        "Birth Date",
        "Date Hired",
        "Tin #",
        "SSS #",
        "Phil Health",
        "Pagibig",
        "Status",
        "NBIno",
        "Police Clr",
        "Brgy",
      ];

      // Add table using autoTable
      // Landscape A4: 297mm wide, with 5mm margins = 287mm available
      const availableWidth = pageWidth - 10; // 297 - 10 = 287mm
      autoTable(doc, {
        head: [columns],
        body: tableData,
        startY: yPos,
        styles: {
          fontSize: 5,
          cellPadding: 1,
          overflow: "linebreak",
          lineWidth: 0.1,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [34, 139, 34], // Green color
          textColor: 255,
          fontStyle: "bold",
          fontSize: 5,
          cellPadding: 1,
        },
        columnStyles: {
          0: { cellWidth: 4 }, // #
          1: { cellWidth: 13 }, // EMPID
          2: { cellWidth: 17 }, // Last Name
          3: { cellWidth: 17 }, // First Name
          4: { cellWidth: 9 }, // Middle Name
          5: { cellWidth: 26 }, // Address
          6: { cellWidth: 15 }, // Contact No
          7: { cellWidth: 20 }, // Department
          8: { cellWidth: 19 }, // Position
          9: { cellWidth: 13 }, // Birth Date
          10: { cellWidth: 13 }, // Date Hired
          11: { cellWidth: 13 }, // Tin #
          12: { cellWidth: 13 }, // SSS #
          13: { cellWidth: 13 }, // Phil Health
          14: { cellWidth: 13 }, // Pagibig
          15: { cellWidth: 11 }, // Status
          16: { cellWidth: 11 }, // NBIno
          17: { cellWidth: 11 }, // Police Clr
          18: { cellWidth: 11 }, // Brgy
        },
        margin: { left: 5, right: 5 },
        tableWidth: availableWidth,
        showHead: "everyPage",
        horizontalPageBreak: false,
      });

      // Save PDF
      const fileName = `Employee_Masterlist_${format(new Date(), "yyyy-MM-dd")}.pdf`;
      doc.save(fileName);
      toast.success("Employee masterlist exported successfully!");
    } catch (error: any) {
      console.error("Error exporting PDF:", error);
      toast.error("Failed to export employee masterlist", {
        description: error.message || "An error occurred while generating the PDF",
      });
    } finally {
      setGeneratingPDF(false);
    }
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          title="Employee management"
          description="Manage employee records and view schedules."
          actions={
            <div className={dbHeaderActions}>
              <Button asChild className={dbHeaderButton}>
                <Link
                  href="/employees/new"
                  className="inline-flex items-center justify-center gap-2"
                >
                  <Icon name="Plus" size={IconSizes.sm} />
                  Add Employee
                </Link>
              </Button>
            </div>
          }
        />

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "directory" | "schedules")}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="directory">Directory</TabsTrigger>
            <TabsTrigger value="schedules">Schedules</TabsTrigger>
          </TabsList>

          <TabsContent value="directory" className="space-y-4">
            <CardSection
              title="Directory"
              description="Search, edit, and manage employee portal access."
            >
              <HStack
                justify="between"
                align="end"
                gap="4"
                className="w-full flex-col sm:flex-row sm:items-end"
              >
                <div className="relative w-full min-w-0 flex-1 sm:max-w-md">
                  <Icon
                    name="MagnifyingGlass"
                    size={IconSizes.sm}
                    className="absolute left-3 top-2.5 text-muted-foreground"
                  />
                  <Input
                    type="search"
                    placeholder="Search by name or employee ID..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setListPage(1);
                    }}
                    className="pl-9"
                  />
                </div>
                <HStack gap="2" align="center" className="w-full flex-wrap justify-start sm:w-auto sm:justify-end">
                  {(isAdmin || isHR) && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={exportEmployeeMasterlistToPDF}
                      disabled={generatingPDF || employees.length === 0}
                      className="w-full sm:w-auto"
                    >
                      <Icon
                        name={generatingPDF ? "ArrowsClockwise" : "FilePdf"}
                        size={IconSizes.sm}
                        className={generatingPDF ? "animate-spin" : ""}
                      />
                      {generatingPDF ? "Generating..." : "Download Masterlist"}
                    </Button>
                  )}
                  <HStack gap="2" align="center" className="shrink-0">
                    <Icon
                      name="User"
                      size={IconSizes.sm}
                      className="text-muted-foreground"
                    />
                    <Badge variant="secondary" className="font-normal">
                      {filteredEmployees.length} employees
                    </Badge>
                  </HStack>
                </HStack>
              </HStack>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                </div>
              ) : filteredEmployees.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  {searchTerm
                    ? "No employees found matching your search."
                    : "No employees yet. Add your first employee!"}
                </p>
              ) : (
                <>
                <DbMobileBlock>
                  <div className="space-y-2">
                    {pagedEmployees.map((employee) => {
                      const locationNames =
                        employee.employee_location_assignments
                          ?.map(
                            (assignment) =>
                              assignment.office_locations?.name ||
                              locationMap.get(assignment.location_id) ||
                              null
                          )
                          .filter((name): name is string => Boolean(name)) || [];
                      const allLocations =
                        locationNames.length > 0
                          ? locationNames
                          : employee.assigned_hotel
                          ? [employee.assigned_hotel]
                          : [];

                      return (
                        <div key={employee.id} className={dbMobileListCard}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <Link
                                href={`/employees/${employee.id}`}
                                className="text-sm font-medium text-primary hover:underline"
                              >
                                {employee.full_name}
                              </Link>
                              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                {employee.employee_id}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`shrink-0 text-xs ${
                                employee.is_active
                                  ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                  : "bg-slate-100 text-slate-800 border-slate-200"
                              }`}
                            >
                              {employee.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div className="mt-2 space-y-1">
                            <DashboardMobileField
                              label="Position"
                              value={employee.position || "—"}
                            />
                            <DashboardMobileField
                              label="Job level"
                              value={employee.job_level || "—"}
                            />
                            <DashboardMobileField
                              label="Locations"
                              value={
                                allLocations.length > 0
                                  ? allLocations.join(", ")
                                  : "—"
                              }
                            />
                          </div>
                          <HStack gap="2" justify="end" className="mt-3 flex-wrap">
                            <Button size="sm" variant="outline" asChild className="h-9 px-3">
                              <Link href={`/employees/${employee.id}`}>
                                <Icon name="Eye" size={IconSizes.sm} className="mr-1" />
                                View
                              </Link>
                            </Button>
                            <Button size="sm" variant="outline" asChild className="h-9 px-3">
                              <Link href={`/employees/${employee.id}/edit`}>
                                <Icon name="PencilSimple" size={IconSizes.sm} className="mr-1" />
                                Edit
                              </Link>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPasswordModal(employee)}
                              className="h-9 w-9 p-0"
                              aria-label="Manage portal account"
                            >
                              <Icon name="Key" size={IconSizes.sm} />
                            </Button>
                            <Button
                              size="sm"
                              variant={employee.is_active ? "destructive" : "default"}
                              onClick={() => toggleEmployeeStatus(employee)}
                              className="h-9 w-9 p-0"
                              aria-label={
                                employee.is_active
                                  ? "Deactivate employee"
                                  : "Activate employee"
                              }
                            >
                              <Icon name="Power" size={IconSizes.sm} />
                            </Button>
                          </HStack>
                        </div>
                      );
                    })}
                  </div>
                </DbMobileBlock>
                <DbDesktopBlock className={dbTableShell}>
                  <Table className="min-w-full">
                    <TableHeader>
                      <TableRow className="h-10">
                        <TableHead className="w-[110px] whitespace-nowrap py-2 text-xs font-semibold">
                          Employee ID
                        </TableHead>
                        <TableHead className="min-w-[180px] py-2 text-xs font-semibold">
                          Employee
                        </TableHead>
                        <TableHead className="min-w-[160px] py-2 text-xs font-semibold">
                          Position
                        </TableHead>
                        <TableHead className="min-w-[120px] whitespace-nowrap py-2 text-xs font-semibold">
                          Job Level
                        </TableHead>
                        <TableHead className="min-w-[160px] py-2 text-xs font-semibold">
                          Assigned Locations
                        </TableHead>
                        <TableHead className="w-[90px] whitespace-nowrap py-2 text-xs font-semibold">
                          Status
                        </TableHead>
                        <TableHead className="text-right w-[200px] whitespace-nowrap py-2 text-xs font-semibold">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                        {pagedEmployees.map((employee) => (
                          <TableRow key={employee.id} className="h-auto">
                            <TableCell className="font-semibold whitespace-nowrap py-2">
                              {employee.employee_id}
                            </TableCell>
                            <TableCell className="min-w-[180px] py-2">
                              <Link
                                href={`/employees/${employee.id}`}
                                className="group block min-w-0 rounded-md outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
                              >
                                <HStack gap="4" align="center">
                                  <EmployeeAvatar
                                    profilePictureUrl={
                                      employee.profile_picture_url
                                    }
                                    fullName={employee.full_name}
                                    size="sm"
                                  />
                                  <span className="break-words min-w-0 text-sm font-medium text-foreground underline-offset-4 group-hover:underline">
                                    {employee.full_name}
                                  </span>
                                </HStack>
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm min-w-[160px] py-2 text-center">
                              {employee.position ? (
                                <div className="flex justify-center">
                                  <Badge
                                    variant="outline"
                                    className="text-[11px] leading-tight whitespace-normal bg-slate-50 text-slate-700 border-slate-200 text-center"
                                    title={employee.position}
                                  >
                                    {employee.position}
                                  </Badge>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="min-w-[120px] py-2 text-center">
                              {employee.job_level ? (
                                <div className="flex justify-center">
                                  <Badge
                                    variant="outline"
                                    className={`text-xs whitespace-nowrap text-center ${
                                      employee.job_level === "MANAGERIAL"
                                        ? "bg-emerald-700 text-white border-emerald-800"
                                        : employee.job_level === "SUPERVISORY"
                                        ? "bg-emerald-500 text-white border-emerald-600"
                                        : employee.job_level === "RANK AND FILE"
                                        ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                        : "bg-slate-100 text-slate-700 border-slate-200"
                                    }`}
                                  >
                                    {employee.job_level}
                                  </Badge>
                                </div>
                              ) : (
                                "—"
                              )}
                            </TableCell>
                            <TableCell className="min-w-[160px] text-sm py-2">
                              {(() => {
                                const locationNames =
                                  employee.employee_location_assignments
                                    ?.map(
                                      (assignment) =>
                                        assignment.office_locations?.name ||
                                        locationMap.get(
                                          assignment.location_id
                                        ) ||
                                        null
                                    )
                                    .filter((name): name is string =>
                                      Boolean(name)
                                    ) || [];

                                const allLocations =
                                  locationNames.length > 0
                                    ? locationNames
                                    : employee.assigned_hotel
                                    ? [employee.assigned_hotel]
                                    : [];

                                if (allLocations.length === 0) {
                                  return "—";
                                }

                                // Show first 2 locations as badges, rest in tooltip
                                const displayLocations = allLocations.slice(
                                  0,
                                  2
                                );
                                const remainingCount = allLocations.length - 2;
                                const fullText = allLocations.join(", ");

                                return (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {displayLocations.map((loc, idx) => (
                                      <Badge
                                        key={idx}
                                        variant="outline"
                                        className="text-xs whitespace-normal break-words max-w-[120px]"
                                        title={loc}
                                      >
                                        {loc}
                                      </Badge>
                                    ))}
                                    {remainingCount > 0 && (
                                      <Badge
                                        variant="outline"
                                        className="text-xs whitespace-nowrap"
                                        title={fullText}
                                      >
                                        +{remainingCount}
                                      </Badge>
                                    )}
                                    {allLocations.length > 0 && (
                                      <span
                                        className="sr-only"
                                        title={fullText}
                                      >
                                        {fullText}
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={`text-xs ${
                                  employee.is_active
                                    ? "bg-emerald-100 text-emerald-900 border-emerald-200"
                                    : "bg-slate-100 text-slate-800 border-slate-200"
                                }`}
                              >
                                {employee.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right w-[200px] py-2">
                              <HStack
                                gap="2"
                                justify="end"
                                className="whitespace-nowrap"
                              >
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  asChild
                                  className="h-7 px-2"
                                  title="View profile"
                                >
                                  <Link
                                    href={`/employees/${employee.id}`}
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Icon name="Eye" size={IconSizes.sm} />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  asChild
                                  className="h-7 px-2"
                                  title="Edit employee"
                                >
                                  <Link
                                    href={`/employees/${employee.id}/edit`}
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Icon
                                      name="PencilSimple"
                                      size={IconSizes.sm}
                                    />
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => openPasswordModal(employee)}
                                  title="Manage portal account"
                                  className="h-7 px-2"
                                >
                                  <Icon name="Key" size={IconSizes.sm} />
                                </Button>
                                <Button
                                  size="sm"
                                  variant={
                                    employee.is_active
                                      ? "destructive"
                                      : "default"
                                  }
                                  onClick={() => toggleEmployeeStatus(employee)}
                                  className="h-7 px-2"
                                  title={
                                    employee.is_active
                                      ? "Deactivate employee"
                                      : "Activate employee"
                                  }
                                >
                                  <Icon name="Power" size={IconSizes.sm} />
                                </Button>
                              </HStack>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </DbDesktopBlock>
                {listTotalPages > 1 && (
                  <HStack
                    gap="2"
                    align="center"
                    justify="between"
                    className="pt-3"
                  >
                    <Caption className="text-muted-foreground">
                      Page {safeListPage} of {listTotalPages}
                    </Caption>
                    <HStack gap="2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={safeListPage <= 1}
                        onClick={() => setListPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        disabled={safeListPage >= listTotalPages}
                        onClick={() =>
                          setListPage((p) => Math.min(listTotalPages, p + 1))
                        }
                      >
                        Next
                      </Button>
                    </HStack>
                  </HStack>
                )}
                </>
              )}
            </CardSection>
          </TabsContent>

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle>Schedules</CardTitle>
                <CardDescription>
                  Weekly schedules for account managers, HR, and admins.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {roleLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
                  </div>
                ) : !scheduleAllowed ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                    Only account managers, HR, or admins can view schedules.
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                      <div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label>Week starting (Mon)</Label>
                          <Input
                            type="date"
                            value={format(
                              startOfWeek(weekStart, { weekStartsOn: 1 }),
                              "yyyy-MM-dd"
                            )}
                            onChange={(e) =>
                              setWeekStart(
                                startOfWeek(new Date(e.target.value), {
                                  weekStartsOn: 1,
                                })
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Employee</Label>
                          <EmployeeSearchSelect
                            employees={employees.map((e) => ({
                              id: e.id,
                              employee_id: e.employee_id,
                              full_name: e.full_name ?? "",
                              first_name: e.first_name,
                              last_name: e.last_name,
                            }))}
                            value={filters.employee_id}
                            onValueChange={(value) =>
                              setFilters({ employee_id: value })
                            }
                            showAllOption={true}
                            placeholder="Search by name or employee ID..."
                            className="w-full"
                          />
                        </div>
                      </div>
                      <Button
                        className="w-full sm:w-auto"
                        variant="secondary"
                        onClick={loadWeek}
                        disabled={scheduleLoading}
                      >
                        <Icon name="ArrowsClockwise" size={IconSizes.sm} />
                        {scheduleLoading ? "Refreshing..." : "Refresh"}
                      </Button>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      {groupedSchedules.map((col) => (
                        <Card key={col.date} className="border-muted/60">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base">
                              {col.label}
                            </CardTitle>
                            <CardDescription>{col.date}</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {col.entries.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                No schedules
                              </p>
                            ) : (
                              col.entries.map((entry) => {
                                const color = getColorStyleForEmployee(
                                  entry.employee_id
                                );
                                return (
                                  <div
                                    key={entry.id}
                                    onClick={() =>
                                      setSelectedScheduleEntry(entry)
                                    }
                                    className="rounded-md border px-3 py-2 text-sm cursor-pointer transition-all hover:shadow-md"
                                    style={{
                                      backgroundColor: color.bg,
                                      borderColor: color.border,
                                      color: color.text,
                                    }}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold">
                                        {entry.employee_name}
                                      </span>
                                      <Badge
                                        variant="outline"
                                        className="bg-white/60 text-xs"
                                      >
                                        Shift
                                      </Badge>
                                    </div>
                                    <HStack
                                      gap="2"
                                      align="center"
                                      className="mt-1 text-xs"
                                    >
                                      <Icon
                                        name="CalendarBlank"
                                        size={IconSizes.sm}
                                      />
                                      {formatPHTime(
                                        new Date(entry.schedule_date),
                                        "MMM dd"
                                      )}
                                    </HStack>
                                    {entry.start_time && entry.end_time ? (
                                      <HStack
                                        gap="2"
                                        align="center"
                                        className="mt-1 text-xs"
                                      >
                                        <Icon
                                          name="Clock"
                                          size={IconSizes.sm}
                                        />
                                        {`${formatPHTime(
                                          new Date(
                                            `${entry.schedule_date}T${entry.start_time}`
                                          ),
                                          "h:mm a"
                                        )} - ${formatPHTime(
                                          new Date(
                                            `${entry.schedule_date}T${entry.end_time}`
                                          ),
                                          "h:mm a"
                                        )}`}
                                      </HStack>
                                    ) : (
                                      <HStack
                                        gap="2"
                                        align="center"
                                        className="mt-1 text-xs text-muted-foreground"
                                      >
                                        <Icon
                                          name="Clock"
                                          size={IconSizes.sm}
                                        />
                                        No schedule set
                                      </HStack>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog
          open={!!selectedScheduleEntry}
          onOpenChange={(open) => !open && setSelectedScheduleEntry(null)}
        >
          <DialogContent className="overflow-x-hidden max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {selectedScheduleEntry?.employee_name} -{" "}
                {selectedScheduleEntry &&
                  format(
                    new Date(selectedScheduleEntry.schedule_date),
                    "EEEE, MMM d, yyyy"
                  )}
              </DialogTitle>
              <DialogDescription>Schedule details and tasks</DialogDescription>
            </DialogHeader>
            {selectedScheduleEntry && (
              <div className="mt-4 space-y-4 min-w-0">
                <div className="min-w-0 w-full">
                  <Label className="text-sm font-medium">Schedule</Label>
                  {selectedScheduleEntry.start_time &&
                  selectedScheduleEntry.end_time ? (
                    <p className="mt-2 text-sm">
                      {formatPHTime(
                        new Date(
                          `${selectedScheduleEntry.schedule_date}T${selectedScheduleEntry.start_time}`
                        ),
                        "h:mm a"
                      )}{" "}
                      -{" "}
                      {formatPHTime(
                        new Date(
                          `${selectedScheduleEntry.schedule_date}T${selectedScheduleEntry.end_time}`
                        ),
                        "h:mm a"
                      )}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      No schedule set for this day
                    </p>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <Label className="text-sm font-medium">Tasks</Label>
                  {selectedScheduleEntry.tasks ? (
                    <div className="mt-2 min-w-0 w-full overflow-hidden">
                      <p className="text-sm whitespace-pre-wrap break-words bg-muted p-3 rounded-md overflow-wrap-anywhere word-break-break-all max-w-full">
                        {selectedScheduleEntry.tasks}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground italic">
                      No tasks submitted for this day
                    </p>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Manage Portal Account
              {passwordEmployee?.full_name
                ? ` - ${passwordEmployee.full_name}`
                : ""}
            </DialogTitle>
          </DialogHeader>
          {passwordEmployee && (
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                <p className="text-emerald-900">
                  <strong>Employee ID:</strong> {passwordEmployee.employee_id}
                </p>
                <p className="text-xs text-emerald-800 mt-1">
                  Default password is the employee ID.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  minLength={4}
                  required
                  onChange={(e) => setNewPassword(e.target.value)}
                  disabled={passwordSubmitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  minLength={4}
                  required
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={passwordSubmitting}
                />
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                Employee will use this password to sign in at /employee-login.
              </div>

              <DialogFooter className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    passwordEmployee && resetPasswordToDefault(passwordEmployee)
                  }
                  disabled={passwordSubmitting}
                >
                  <Icon
                    name="ClockClockwise"
                    size={IconSizes.sm}
                    className="mr-2"
                  />
                  Reset to default
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowPasswordModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={passwordSubmitting}>
                    {passwordSubmitting ? "Saving..." : "Update password"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}