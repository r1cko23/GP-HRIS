"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, format } from "date-fns";
import { formatPHTime } from "@/utils/format";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSection } from "@/components/ui/card-section";
import { H1, BodySmall, Caption } from "@/components/ui/typography";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Input } from "@/components/ui/input";
import { InputGroup } from "@/components/ui/input-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { toast } from "sonner";

type EmployeeOption = { id: string; full_name: string };
type ScheduleRow = {
  id: string;
  employee_id: string;
  employee_name: string;
  schedule_date: string;
  start_time: string;
  end_time: string;
  tasks: string | null;
  day_off: boolean;
};

// Deterministic per-employee colors (inline HSL for more variety)
const getColorStyleForEmployee = (employeeId: string) => {
  const hash = employeeId
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const hue = hash % 360;
  const bg = `hsl(${hue}deg 80% 93%)`;
  const border = `hsl(${hue}deg 70% 80%)`;
  const text = `hsl(${hue}deg 45% 30%)`;
  return { bg, border, text };
};

export default function SchedulesPage() {
  const supabase = createClient();
  const { role, isAdmin, loading: roleLoading } = useUserRole();

  const [weekStart, setWeekStart] = useState<Date>(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [filters, setFilters] = useState<{ employee_id: string }>({
    employee_id: "all",
  });
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<ScheduleRow | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  useEffect(() => {
    const loadMeta = async () => {
      const { data: emps } = await supabase
        .from("employees")
        .select("id, full_name")
        .order("full_name");
      setEmployees(emps || []);
    };
    loadMeta();
  }, [supabase]);

  const loadWeek = async () => {
    setLoading(true);
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
      setRows((data || []) as ScheduleRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadWeek();
  }, [weekStart, filters.employee_id]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin && role !== "account_manager" && role !== "hr") {
    return (
      <DashboardLayout>
        <VStack gap="4" className="w-full">
          <BodySmall>
            Only Account Managers, HR, or Admins can view schedules.
          </BodySmall>
        </VStack>
      </DashboardLayout>
    );
  }

  // Get all unique employees and sort alphabetically
  const allEmployees = useMemo(() => {
    const uniqueEmployees = new Map<string, { id: string; name: string }>();
    rows.forEach((row) => {
      if (!uniqueEmployees.has(row.employee_id)) {
        uniqueEmployees.set(row.employee_id, {
          id: row.employee_id,
          name: row.employee_name,
        });
      }
    });
    return Array.from(uniqueEmployees.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [rows]);

  // Group by day and create a map for quick lookup
  const grouped = useMemo(() => {
    const dayMap = new Map<string, Map<string, ScheduleRow>>();
    
    // Initialize map for all days
    weekDays.forEach((d) => {
      const iso = format(d, "yyyy-MM-dd");
      dayMap.set(iso, new Map());
    });
    
    // Populate map with entries
    rows.forEach((row) => {
      const dayEntries = dayMap.get(row.schedule_date);
      if (dayEntries) {
        dayEntries.set(row.employee_id, row);
      }
    });
    
    // Convert to array format with consistent ordering
    return weekDays.map((d) => {
      const iso = format(d, "yyyy-MM-dd");
      const dayEntries = dayMap.get(iso) || new Map();
      
      // Create entries in alphabetical order, filling in missing employees
      const orderedEntries = allEmployees.map((emp) => {
        const entry = dayEntries.get(emp.id);
        return entry || null; // null means no schedule for this employee on this day
      });
      
      return {
        date: iso,
        label: format(d, "EEE, MMM d"),
        entries: orderedEntries.filter((e): e is ScheduleRow => e !== null),
        orderedEntries, // Include null entries for consistent positioning
      };
    });
  }, [weekDays, rows, allEmployees]);

  return (
    <DashboardLayout>
      <VStack gap="4" className="w-full pb-24">
        <HStack
          justify="between"
          align="center"
          className="flex-col md:flex-row gap-3"
        >
          <VStack gap="1" align="start">
            <H1 className="text-xl">Weekly Schedules</H1>
            <BodySmall className="text-xs text-muted-foreground">
              View employee schedules (Mon–Sun)
            </BodySmall>
          </VStack>
          <Card className="w-full md:w-auto">
            <CardContent className="p-3">
              <HStack gap="3" align="end" className="flex-col md:flex-row">
                <InputGroup
                  label="Week"
                  className="w-full sm:w-48"
                >
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
                    className="text-sm"
                  />
                </InputGroup>
                <div className="space-y-1.5 w-full sm:w-48">
                  <Label className="text-xs font-medium">Employee</Label>
                  <Select
                    value={filters.employee_id}
                    onValueChange={(val) =>
                      setFilters((f) => ({ ...f, employee_id: val }))
                    }
                  >
                    <SelectTrigger className="text-sm h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All employees</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="secondary"
                  onClick={loadWeek}
                  disabled={loading}
                  size="sm"
                  className="h-9"
                >
                  <Icon name="ArrowsClockwise" size={IconSizes.xs} />
                  {loading ? "..." : "Refresh"}
                </Button>
              </HStack>
            </CardContent>
          </Card>
        </HStack>

        <CardSection className="overflow-auto p-3">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3 min-w-fit">
            {grouped.map((col) => (
              <div
                key={col.date}
                className="border border-border rounded-lg p-2.5 bg-card min-h-[200px] min-w-[140px]"
              >
                <p className="text-xs font-semibold text-foreground mb-2.5 px-0.5 sticky top-0 bg-card pb-1">
                  {col.label}
                </p>
                {allEmployees.length === 0 ? (
                  <Caption className="text-xs px-0.5 text-muted-foreground">No schedules</Caption>
                ) : (
                  <VStack gap="2">
                    {allEmployees.map((emp, idx) => {
                      const entry = col.orderedEntries?.[idx] || null;
                      if (!entry) {
                        // Empty cell for employee with no schedule on this day
                        return (
                          <div
                            key={`${col.date}-${emp.id}-empty`}
                            className="border border-transparent rounded-md px-2.5 py-2 w-full min-h-[60px]"
                            aria-label={`${emp.name} - No schedule`}
                          />
                        );
                      }
                      
                      const color = getColorStyleForEmployee(entry.employee_id);
                      const isDayOff = entry.day_off;
                      return (
                        <div
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className={`border rounded-md px-2.5 py-2 cursor-pointer transition-all hover:shadow-md w-full ${
                            isDayOff ? "border-dashed border-2" : ""
                          }`}
                          style={{
                            backgroundColor: color.bg,
                            borderColor: isDayOff ? color.border : color.border,
                            color: color.text,
                          }}
                          title={entry.employee_name}
                        >
                          <VStack gap="2" align="start" className="w-full">
                            <HStack gap="2" align="start" justify="between" className="w-full">
                              <p className="font-semibold text-xs leading-snug break-words flex-1 min-w-0 pr-1.5">
                                {entry.employee_name}
                              </p>
                              {isDayOff && (
                                <Badge 
                                  variant="outline" 
                                  className="text-[10px] font-semibold border-2 border-current shrink-0 opacity-80 px-1.5 py-0.5 h-5 flex items-center whitespace-nowrap"
                                >
                                  <Icon name="CalendarX" size={16} className="mr-0.5 shrink-0" />
                                  Off
                                </Badge>
                              )}
                            </HStack>
                            {isDayOff ? (
                              <HStack gap="2" align="center" className="w-full">
                                <Icon
                                  name="Moon"
                                  size={16}
                                  className="shrink-0 opacity-70"
                                />
                                <Caption className="text-[11px] font-medium italic">
                                  Rest day
                                </Caption>
                              </HStack>
                            ) : entry.start_time && entry.end_time ? (
                              <Caption className="text-[11px] leading-snug">
                                {formatPHTime(
                                  new Date(
                                    `${entry.schedule_date}T${entry.start_time}`
                                  ),
                                  "h:mm a"
                                )}{" "}
                                -{" "}
                                {formatPHTime(
                                  new Date(
                                    `${entry.schedule_date}T${entry.end_time}`
                                  ),
                                  "h:mm a"
                                )}
                              </Caption>
                            ) : (
                              <Caption className="text-[11px] text-muted-foreground">
                                No schedule
                              </Caption>
                            )}
                          </VStack>
                        </div>
                      );
                    })}
                  </VStack>
                )}
              </div>
            ))}
          </div>
        </CardSection>

        <Dialog
          open={!!selectedEntry}
          onOpenChange={(open) => !open && setSelectedEntry(null)}
        >
          <DialogContent className="overflow-x-hidden max-w-md">
            <DialogHeader className="pb-3">
              <DialogTitle className="text-base">
                {selectedEntry?.employee_name}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {selectedEntry &&
                  format(
                    new Date(selectedEntry.schedule_date),
                    "EEEE, MMM d, yyyy"
                  )}
              </DialogDescription>
            </DialogHeader>
            {selectedEntry && (
              <VStack gap="3" className="min-w-0">
                <div className="min-w-0 w-full">
                  <HStack gap="2" align="center" justify="between" className="mb-1.5">
                    <Label className="text-xs font-medium">Schedule</Label>
                    {selectedEntry.day_off && (
                      <Badge 
                        variant="outline" 
                        className="border-2 border-current font-semibold opacity-80 text-xs px-2 py-0.5"
                      >
                        <Icon name="CalendarX" size={IconSizes.xs} className="mr-1" />
                        Day Off
                      </Badge>
                    )}
                  </HStack>
                  {selectedEntry.day_off ? (
                    <div className="mt-1.5 p-2 rounded-md bg-muted/50 border border-dashed border-2">
                      <HStack gap="2" align="center">
                        <Icon name="Moon" size={IconSizes.xs} className="shrink-0 opacity-70" />
                        <p className="text-xs font-medium italic">
                          Rest day - No schedule set
                        </p>
                      </HStack>
                    </div>
                  ) : selectedEntry.start_time && selectedEntry.end_time ? (
                    <p className="mt-1.5 text-sm">
                      {formatPHTime(
                        new Date(
                          `${selectedEntry.schedule_date}T${selectedEntry.start_time}`
                        ),
                        "h:mm a"
                      )}{" "}
                      -{" "}
                      {formatPHTime(
                        new Date(
                          `${selectedEntry.schedule_date}T${selectedEntry.end_time}`
                        ),
                        "h:mm a"
                      )}
                    </p>
                  ) : (
                    <p className="mt-1.5 text-xs text-muted-foreground italic">
                      No schedule set for this day
                    </p>
                  )}
                </div>
                <div className="min-w-0 w-full">
                  <Label className="text-xs font-medium mb-1.5 block">Tasks</Label>
                  {selectedEntry.tasks ? (
                    <div className="min-w-0 w-full overflow-hidden">
                      <p className="text-xs whitespace-pre-wrap break-words bg-muted p-2 rounded-md overflow-wrap-anywhere word-break-break-all max-w-full">
                        {selectedEntry.tasks}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      No tasks submitted for this day
                    </p>
                  )}
                </div>
              </VStack>
            )}
          </DialogContent>
        </Dialog>
      </VStack>
    </DashboardLayout>
  );
}
