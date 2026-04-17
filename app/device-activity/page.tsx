"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useUserRole } from "@/lib/hooks/useUserRole";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BodySmall, Caption } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { VStack, HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { toast } from "sonner";
import { EmployeeSearchSelect } from "@/components/EmployeeSearchSelect";
import { EmployeeAvatar } from "@/components/EmployeeAvatar";
import { normalizeDeviceLabelForDisplay } from "@/utils/device-info";

interface TimeEntryRow {
  id: string;
  employee_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  clock_in_ip: string | null;
  clock_out_ip: string | null;
  clock_in_device: string | null;
  clock_out_device: string | null;
  clock_in_fingerprint: string | null;
  clock_out_fingerprint: string | null;
  clock_in_client_id: string | null;
  clock_out_client_id: string | null;
  status: string;
  employees: {
    employee_id: string;
    full_name: string;
    profile_picture_url?: string | null;
  };
}

function deviceLabel(device: string | null): string {
  if (!device) return "—";
  const d = normalizeDeviceLabelForDisplay(device.trim());
  if (d.length > 48) return d.slice(0, 45) + "...";
  return d;
}

/**
 * Device switch = different device/browser used at clock-out vs clock-in.
 * Prefer fingerprint (stable per device); then client_id (persistent until storage cleared); then device string.
 * IP is not used to avoid false positives from network changes.
 */
function hasDeviceSwitch(entry: TimeEntryRow): boolean {
  const fi = (entry.clock_in_fingerprint ?? "").trim();
  const fo = (entry.clock_out_fingerprint ?? "").trim();
  if (fi && fo) return fi !== fo;
  const ci = (entry.clock_in_client_id ?? "").trim();
  const co = (entry.clock_out_client_id ?? "").trim();
  if (ci && co) return ci !== co;
  const di = (entry.clock_in_device ?? "").trim();
  const do_ = (entry.clock_out_device ?? "").trim();
  if (!do_) return false;
  return di !== do_;
}

export default function DeviceActivityPage() {
  const supabase = createClient();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const [entries, setEntries] = useState<TimeEntryRow[]>([]);
  const [employees, setEmployees] = useState<{ id: string; employee_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 6), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [onlySwitches, setOnlySwitches] = useState(false);

  // Login devices per employee (multi-device detection)
  interface EmployeeDevicesRow {
    employee_id: string;
    employee_identifier: string;
    full_name: string | null;
    device_count: number;
    last_seen_at: string | null;
    device_labels: string | null;
    abnormal: boolean;
  }
  const [devicesPerEmployee, setDevicesPerEmployee] = useState<EmployeeDevicesRow[]>([]);
  const [devicesPerEmployeeLoading, setDevicesPerEmployeeLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    loadEmployees();
  }, [isAdmin]);

  async function loadDevicesPerEmployee() {
    setDevicesPerEmployeeLoading(true);
    const { data, error } = await supabase.rpc("get_all_employees_devices");
    if (error) {
      console.error("Failed to load devices per employee", error);
      toast.error("Failed to load login devices summary");
      setDevicesPerEmployee([]);
    } else {
      setDevicesPerEmployee((data as EmployeeDevicesRow[]) ?? []);
    }
    setDevicesPerEmployeeLoading(false);
  }

  useEffect(() => {
    if (!isAdmin) return;
    loadDevicesPerEmployee();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    loadEntries();
  }, [dateFrom, dateTo, selectedEmployee, isAdmin]);

  async function loadEmployees() {
    const { data, error } = await supabase
      .from("employees")
      .select("id, employee_id, full_name")
      .eq("is_active", true)
      .order("full_name");
    if (error) {
      console.error("Failed to load employees", error);
      return;
    }
    setEmployees(data ?? []);
  }

  async function loadEntries() {
    setLoading(true);
    const from = startOfDay(new Date(dateFrom + "Z"));
    const to = endOfDay(new Date(dateTo + "Z"));

    let query = supabase
      .from("time_clock_entries")
      .select(
        `
        id,
        employee_id,
        clock_in_time,
        clock_out_time,
        clock_in_ip,
        clock_out_ip,
        clock_in_device,
        clock_out_device,
        clock_in_fingerprint,
        clock_out_fingerprint,
        clock_in_client_id,
        clock_out_client_id,
        status,
        employees (
          employee_id,
          full_name,
          profile_picture_url
        )
      `
      )
      .gte("clock_in_time", from.toISOString())
      .lte("clock_in_time", to.toISOString())
      .order("clock_in_time", { ascending: false });

    if (selectedEmployee !== "all") {
      query = query.eq("employee_id", selectedEmployee);
    }

    const { data, error } = await query;

    if (error) {
      toast.error("Failed to load time entries");
      console.error(error);
      setEntries([]);
      setLoading(false);
      return;
    }

    setEntries((data as unknown) as TimeEntryRow[] ?? []);
    setLoading(false);
  }

  const filteredEntries = useMemo(() => {
    if (!onlySwitches) return entries;
    return entries.filter(hasDeviceSwitch);
  }, [entries, onlySwitches]);

  const stats = useMemo(() => {
    const withSwitch = entries.filter(hasDeviceSwitch).length;
    const withDeviceData = entries.filter(
      (e) => (e.clock_in_device ?? "").trim() || (e.clock_out_device ?? "").trim()
    ).length;
    return {
      total: entries.length,
      withSwitch,
      withDeviceData,
    };
  }, [entries]);

  if (roleLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[200px]">
          <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <VStack gap="4" className="p-8">
          <DashboardPageHeader
            title="Device & login activity"
            description="Only admins can access this page."
          />
        </VStack>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <VStack gap="6" className="w-full pb-8">
        <DashboardPageHeader
          title="Device & login activity"
          description="Track device and IP used during clock-in/out to detect device switching."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
              <Caption>In selected date range</Caption>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Device switch</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">{stats.withSwitch}</div>
              <Caption>Different device/fingerprint at clock-out vs clock-in</Caption>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">With device data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.withDeviceData}</div>
              <Caption>At least one device/IP recorded</Caption>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Login devices per employee</CardTitle>
            <CardDescription>
              Distinct devices each employee has logged in from. Abnormal = more than 2 devices (3+ devices, possible credential sharing).
            </CardDescription>
          </CardHeader>
          <CardContent>
            {devicesPerEmployeeLoading ? (
              <div className="flex items-center justify-center py-8">
                <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
              </div>
            ) : devicesPerEmployee.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                No login device data yet. Devices are recorded when employees log in to the portal.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>ID</TableHead>
                      <TableHead className="text-right">Devices</TableHead>
                      <TableHead>Last seen</TableHead>
                      <TableHead className="max-w-[240px]">Device list</TableHead>
                      <TableHead>Flag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devicesPerEmployee.map((row) => (
                      <TableRow key={row.employee_id}>
                        <TableCell className="font-medium">{row.full_name ?? "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{row.employee_identifier}</TableCell>
                        <TableCell className="text-right">{row.device_count}</TableCell>
                        <TableCell>
                          {row.last_seen_at
                            ? format(new Date(row.last_seen_at), "MMM d, yyyy HH:mm")
                            : "—"}
                        </TableCell>
                        <TableCell className="max-w-[240px] text-muted-foreground" title={row.device_labels ?? undefined}>
                          {row.device_labels
                            ? row.device_labels.split(", ").map((label, idx) => (
                                <div key={idx}>{normalizeDeviceLabelForDisplay(label)}</div>
                              ))
                            : "—"}
                        </TableCell>
                        <TableCell>
                          {row.abnormal ? (
                            <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700">Abnormal</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Narrow by date range, employee, or show only entries where device or IP changed.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <VStack gap="2" align="start" className="min-w-[140px]">
                <Label>From</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </VStack>
              <VStack gap="2" align="start" className="min-w-[140px]">
                <Label>To</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </VStack>
              <VStack gap="2" align="start" className="min-w-[200px]">
                <Label>Employee</Label>
                <EmployeeSearchSelect
                  value={selectedEmployee}
                  onValueChange={setSelectedEmployee}
                  placeholder="All employees"
                  employees={employees}
                  showAllOption={true}
                />
              </VStack>
              <VStack gap="2" align="start" className="min-w-[180px]">
                <Label>Show</Label>
                <Select value={onlySwitches ? "switches" : "all"} onValueChange={(v) => setOnlySwitches(v === "switches")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All entries</SelectItem>
                    <SelectItem value="switches">Only device switches</SelectItem>
                  </SelectContent>
                </Select>
              </VStack>
              <Button variant="outline" onClick={loadEntries} disabled={loading}>
                <Icon name="ArrowsClockwise" size={IconSizes.sm} className={loading ? "animate-spin" : ""} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Time entries</CardTitle>
            <CardDescription>
              Device and IP at clock-in and clock-out. A switch is when the device or IP at clock-out differs from clock-in.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowsClockwise" size={IconSizes.lg} className="animate-spin text-muted-foreground" />
              </div>
            ) : filteredEntries.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No entries match the current filters.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Clock in</TableHead>
                      <TableHead>Clock out</TableHead>
                      <TableHead>Device (in)</TableHead>
                      <TableHead>Device (out)</TableHead>
                      <TableHead>IP (in)</TableHead>
                      <TableHead>IP (out)</TableHead>
                      <TableHead className="w-[100px]">Switch?</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry) => {
                      const switchDetected = hasDeviceSwitch(entry);
                      const emp = entry.employees;
                      const datePh = entry.clock_in_time
                        ? format(new Date(entry.clock_in_time), "MMM d, yyyy")
                        : "—";
                      const timeIn = entry.clock_in_time
                        ? format(new Date(entry.clock_in_time), "h:mm a")
                        : "—";
                      const timeOut = entry.clock_out_time
                        ? format(new Date(entry.clock_out_time), "h:mm a")
                        : "—";
                      return (
                        <TableRow key={entry.id} className={switchDetected ? "bg-amber-50/50" : ""}>
                          <TableCell>
                            <HStack gap="2" align="center">
                              <EmployeeAvatar
                                fullName={emp?.full_name ?? "—"}
                                profilePictureUrl={emp?.profile_picture_url}
                                size="sm"
                              />
                              <span className="font-medium">{emp?.full_name ?? "—"}</span>
                            </HStack>
                          </TableCell>
                          <TableCell>{datePh}</TableCell>
                          <TableCell>{timeIn}</TableCell>
                          <TableCell>{timeOut}</TableCell>
                          <TableCell title={entry.clock_in_device ?? ""} className="max-w-[180px] truncate">
                            {deviceLabel(entry.clock_in_device)}
                          </TableCell>
                          <TableCell title={entry.clock_out_device ?? ""} className="max-w-[180px] truncate">
                            {deviceLabel(entry.clock_out_device)}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{entry.clock_in_ip ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.clock_out_ip ?? "—"}</TableCell>
                          <TableCell>
                            {switchDetected ? (
                              <Badge variant="destructive" className="bg-amber-600 hover:bg-amber-700">Device switch</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-muted/30">
          <CardContent className="pt-6">
            <HStack gap="2" align="start">
              <Icon name="Info" size={IconSizes.md} className="text-muted-foreground shrink-0 mt-0.5" />
              <VStack gap="1" align="start">
                <BodySmall className="font-medium">About device tracking</BodySmall>
                <Caption className="text-muted-foreground">
                  <strong>Device switch</strong> uses (in order): <strong>fingerprint</strong> (hash of browser/device), then <strong>client ID</strong> (persistent UUID in localStorage until user clears site data), then device string. IP is not used so network changes do not trigger false alerts. MAC is not available in browsers; columns exist for kiosk/native app use if needed.
                </Caption>
              </VStack>
            </HStack>
          </CardContent>
        </Card>
      </VStack>
    </DashboardLayout>
  );
}
