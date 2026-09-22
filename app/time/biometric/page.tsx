"use client";

import { useCallback, useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BodySmall, Caption } from "@/components/ui/typography";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  EmployeeSearchSelect,
  type EmployeeOption,
} from "@/components/EmployeeSearchSelect";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useDebounce } from "@/lib/hooks/use-debounce";
import { formatPHTime } from "@/utils/format";

const PAGE = 50;
const DEVICE_SN = "UDP3235201130";

type MapRow = {
  id: string;
  device_user_id: string;
  employee_id: string;
  employee?: { employee_id: string; full_name: string } | null;
  device?: { serial_number: string; name: string } | null;
};

type UnmappedRow = {
  device_id: string;
  device_user_id: string;
  display_name?: string;
  punch_count: number;
  last_punched_at: string;
  device?: { serial_number: string; name: string } | null;
};

export default function BiometricMapsPage() {
  const supabase = createClient();
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [rows, setRows] = useState<MapRow[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [loading, setLoading] = useState(true);

  const [unmapped, setUnmapped] = useState<UnmappedRow[]>([]);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [unmappedOffset, setUnmappedOffset] = useState(0);
  const [unmappedQ, setUnmappedQ] = useState("");
  const debouncedUnmappedQ = useDebounce(unmappedQ, 300);
  const [unmappedLoading, setUnmappedLoading] = useState(true);
  const [syncingNames, setSyncingNames] = useState(false);
  const [skippingTo2026, setSkippingTo2026] = useState(false);
  const [reprocessingAttendance, setReprocessingAttendance] = useState(false);
  const [pickByPin, setPickByPin] = useState<Record<string, string>>({});
  const [mappingPin, setMappingPin] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState<Record<string, string>>({});
  const [savingNamePin, setSavingNamePin] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const [pin, setPin] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, employee_id, full_name, first_name, last_name")
        .eq("is_active", true)
        .order("last_name")
        .limit(500);
      setEmployees((data as EmployeeOption[]) ?? []);
    })();
  }, [supabase]);

  const loadMaps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
      });
      if (debouncedQ) params.set("q", debouncedQ);
      const res = await fetch(`/api/timekeeping/biometric/user-maps?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load");
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load maps");
    } finally {
      setLoading(false);
    }
  }, [offset, debouncedQ]);

  const loadUnmapped = useCallback(async () => {
    setUnmappedLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(unmappedOffset),
      });
      if (debouncedUnmappedQ) params.set("q", debouncedUnmappedQ);
      const res = await fetch(`/api/timekeeping/biometric/unmapped?${params}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load unmapped");
      setUnmapped(json.data ?? []);
      setUnmappedCount(json.count ?? 0);
      const drafts: Record<string, string> = {};
      for (const row of json.data ?? []) {
        drafts[row.device_user_id] = row.display_name || "";
      }
      setNameDraft(drafts);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load unmapped PINs"
      );
    } finally {
      setUnmappedLoading(false);
    }
  }, [unmappedOffset, debouncedUnmappedQ]);

  useEffect(() => {
    void loadMaps();
  }, [loadMaps]);

  useEffect(() => {
    void loadUnmapped();
  }, [loadUnmapped]);

  useEffect(() => {
    setOffset(0);
  }, [debouncedQ]);

  useEffect(() => {
    setUnmappedOffset(0);
  }, [debouncedUnmappedQ]);

  async function saveMapping(deviceUserId: string, empId: string) {
    const res = await fetch("/api/timekeeping/biometric/user-maps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        device_user_id: deviceUserId,
        employee_id: empId,
        device_serial: DEVICE_SN,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "Save failed");
    return json;
  }

  async function addMap() {
    if (!pin.trim() || !employeeId || employeeId === "all") {
      toast.error("Enter device User ID (PIN) and pick an employee");
      return;
    }
    setSaving(true);
    try {
      await saveMapping(pin.trim(), employeeId);
      toast.success("Mapped — GPS bundy disabled; attendance updated from punches");
      setPin("");
      setEmployeeId("");
      await Promise.all([loadMaps(), loadUnmapped()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function mapUnmapped(deviceUserId: string) {
    const empId = pickByPin[deviceUserId];
    if (!empId || empId === "all") {
      toast.error("Pick an employee for this PIN");
      return;
    }
    setMappingPin(deviceUserId);
    try {
      await saveMapping(deviceUserId, empId);
      toast.success(
        `PIN ${deviceUserId} mapped — GPS bundy off; attendance updated`
      );
      setPickByPin((prev) => {
        const next = { ...prev };
        delete next[deviceUserId];
        return next;
      });
      await Promise.all([loadMaps(), loadUnmapped()]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setMappingPin(null);
    }
  }

  async function skipBufferTo2026() {
    setSkippingTo2026(true);
    try {
      const res = await fetch("/api/timekeeping/biometric/skip-to-2026", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Skip failed");
      setSyncStatus(
        `Skip to 2026 queued (stamp ${json.attlog_stamp}). Device logs kept.`
      );
      toast.message("Skipping 2024/2025 upload", {
        description:
          json.message ||
          "Wait about a minute, then punch once. Only 2026 punches will be used.",
        duration: 10000,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Skip failed");
    } finally {
      setSkippingTo2026(false);
    }
  }

  async function reprocessMappedAttendance() {
    setReprocessingAttendance(true);
    try {
      const res = await fetch("/api/timekeeping/biometric/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from: "2026-09-16" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Reprocess failed");
      const ins = Number(json.clock_ins ?? json.clockIns ?? 0);
      const outs = Number(json.clock_outs ?? json.clockOuts ?? 0);
      const considered = Number(json.considered ?? 0);
      setSyncStatus(
        `Attendance updated: ${ins} in / ${outs} out from ${considered} punches`
      );
      toast.success(
        `Attendance sheet updated (${ins} in, ${outs} out)`
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reprocess failed");
    } finally {
      setReprocessingAttendance(false);
    }
  }

  async function syncNamesFromDevice() {
    setSyncingNames(true);
    try {
      const res = await fetch("/api/timekeeping/biometric/sync-names", {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Sync failed");
      setSyncStatus(
        `Queued. Terminal names in DB: ${json.terminal_names ?? 0}. Last seen: ${
          json.last_seen_at
            ? formatPHTime(json.last_seen_at, "MMM d, h:mm a")
            : "never"
        }`
      );
      toast.message("Name sync queued", {
        description:
          json.message ||
          "Wait 1–2 minutes with the terminal online, then Refresh. Or type names in the Name column.",
        duration: 8000,
      });
      // Auto-refresh a few times while device may push USERINFO
      for (const ms of [15000, 30000, 60000]) {
        window.setTimeout(() => {
          void loadUnmapped();
        }, ms);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncingNames(false);
    }
  }

  async function saveTerminalName(deviceUserId: string) {
    const displayName = (nameDraft[deviceUserId] ?? "").trim();
    setSavingNamePin(deviceUserId);
    try {
      const res = await fetch("/api/timekeeping/biometric/device-users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_user_id: deviceUserId,
          display_name: displayName,
          device_serial: DEVICE_SN,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      toast.success(
        displayName
          ? `Saved name for PIN ${deviceUserId}`
          : `Cleared name for PIN ${deviceUserId}`
      );
      await loadUnmapped();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingNamePin(null);
    }
  }

  async function removeMap(id: string) {
    if (!confirm("Remove this biometric mapping?")) return;
    const res = await fetch(
      `/api/timekeeping/biometric/user-maps?id=${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(json.error || "Delete failed");
      return;
    }
    toast.success("Removed");
    await Promise.all([loadMaps(), loadUnmapped()]);
  }

  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, count);
  const unmappedFrom = unmappedCount === 0 ? 0 : unmappedOffset + 1;
  const unmappedTo = Math.min(unmappedOffset + PAGE, unmappedCount);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Biometric (MB10-VL)"
          description="Have staff punch once on the terminal — User IDs show up below. Map each to an enrolled Organic employee; no need to read IDs off the device."
        />

        <section className="mb-6 space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Waiting to map
              </h2>
              <Caption className="text-muted-foreground">
                Only unknown PINs appear here. Already-mapped PINs are in
                Mapped below — this list stays empty when everyone is linked.
              </Caption>
              {syncStatus ? (
                <Caption className="mt-1 text-muted-foreground">
                  {syncStatus}
                </Caption>
              ) : null}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[180px]">
                <Label htmlFor="zk-unmapped-search">Search PIN or name</Label>
                <Input
                  id="zk-unmapped-search"
                  value={unmappedQ}
                  onChange={(e) => setUnmappedQ(e.target.value)}
                  placeholder="PIN or name…"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={skippingTo2026}
                onClick={() => void skipBufferTo2026()}
              >
                {skippingTo2026 ? "Queuing…" : "Skip to 2026 punches"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={reprocessingAttendance}
                onClick={() => void reprocessMappedAttendance()}
              >
                {reprocessingAttendance
                  ? "Updating…"
                  : "Update attendance from punches"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={syncingNames}
                onClick={() => void syncNamesFromDevice()}
              >
                {syncingNames ? "Queuing…" : "Sync names from device"}
              </Button>
            </div>
          </div>

          <BodySmall className="text-muted-foreground">
            {unmappedLoading
              ? "Loading…"
              : unmappedCount === 0
                ? debouncedUnmappedQ
                  ? "No unmapped PINs match this search"
                  : "No unmapped punches yet — ask staff to clock on the MB10 once"
                : `Showing ${unmappedFrom}–${unmappedTo} of ${unmappedCount}`}
          </BodySmall>

          <div className={dbTableShell}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device PIN</TableHead>
                  <TableHead>Name on terminal</TableHead>
                  <TableHead>Punches</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!unmappedLoading && unmapped.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {debouncedUnmappedQ
                        ? "No results for this search"
                        : "Nothing waiting — punches with unknown PINs appear here automatically"}
                    </TableCell>
                  </TableRow>
                ) : (
                  unmapped.map((row) => (
                    <TableRow key={`${row.device_id}:${row.device_user_id}`}>
                      <TableCell className="font-mono">
                        {row.device_user_id}
                      </TableCell>
                      <TableCell className="min-w-[200px]">
                        <div className="flex gap-1">
                          <Input
                            value={
                              nameDraft[row.device_user_id] ??
                              row.display_name ??
                              ""
                            }
                            onChange={(e) =>
                              setNameDraft((prev) => ({
                                ...prev,
                                [row.device_user_id]: e.target.value,
                              }))
                            }
                            placeholder="Type name from terminal…"
                            className="h-8"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            disabled={savingNamePin === row.device_user_id}
                            onClick={() =>
                              void saveTerminalName(row.device_user_id)
                            }
                          >
                            {savingNamePin === row.device_user_id
                              ? "…"
                              : "Save"}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{row.punch_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatPHTime(
                          row.last_punched_at,
                          "MMM d, yyyy h:mm a"
                        )}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <EmployeeSearchSelect
                          employees={employees}
                          value={pickByPin[row.device_user_id] ?? ""}
                          onValueChange={(v) =>
                            setPickByPin((prev) => ({
                              ...prev,
                              [row.device_user_id]: v,
                            }))
                          }
                          showAllOption={false}
                          placeholder="Search enrolled employee…"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          disabled={mappingPin === row.device_user_id}
                          onClick={() => void mapUnmapped(row.device_user_id)}
                        >
                          {mappingPin === row.device_user_id
                            ? "Saving…"
                            : "Map"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={unmappedLoading || unmappedOffset === 0}
              onClick={() =>
                setUnmappedOffset(Math.max(0, unmappedOffset - PAGE))
              }
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={
                unmappedLoading || unmappedOffset + PAGE >= unmappedCount
              }
              onClick={() => setUnmappedOffset(unmappedOffset + PAGE)}
            >
              Next
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={unmappedLoading}
              onClick={() => void loadUnmapped()}
            >
              Refresh
            </Button>
          </div>
        </section>

        <section className="mb-6 space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Mapped
              </h2>
              <Caption className="text-muted-foreground">
                Terminal PIN → Organic employee. Next punch on a mapped PIN
                clocks that person in/out.
              </Caption>
            </div>
            <div className="min-w-[180px]">
              <Label htmlFor="zk-search">Search mapped</Label>
              <Input
                id="zk-search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Device PIN…"
              />
            </div>
          </div>
          <BodySmall className="text-muted-foreground">
            {loading
              ? "Loading…"
              : count === 0
                ? "No mappings yet"
                : `Showing ${from}–${to} of ${count}`}
          </BodySmall>

          <div className={dbTableShell}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device PIN</TableHead>
                  <TableHead>Employee</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {!loading && rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-muted-foreground">
                      {debouncedQ
                        ? "No results for this search"
                        : "Nothing mapped yet — map from Waiting to map above"}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono">
                        {row.device_user_id}
                      </TableCell>
                      <TableCell>{row.employee?.full_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {row.employee?.employee_id ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gp-row-actions"
                          onClick={() => void removeMap(row.id)}
                        >
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || offset + PAGE >= count}
              onClick={() => setOffset(offset + PAGE)}
            >
              Next
            </Button>
          </div>
        </section>

        <details className="mb-6 rounded-md border border-border bg-card p-4 shadow-card">
          <summary className="cursor-pointer text-sm font-medium text-foreground">
            Map a PIN manually (before first punch)
          </summary>
          <Caption className="mt-2 text-muted-foreground">
            Only needed if you already know the terminal User ID and want to map
            before anyone punches.
          </Caption>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="zk-pin">Device User ID (PIN)</Label>
              <Input
                id="zk-pin"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="e.g. 1 or 1001"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Employee (bundy enrolled)</Label>
              <EmployeeSearchSelect
                employees={employees}
                value={employeeId}
                onValueChange={setEmployeeId}
                showAllOption={false}
                placeholder="Search enrolled employee…"
              />
            </div>
          </div>
          <Button
            className="mt-3"
            onClick={() => void addMap()}
            disabled={saving}
          >
            {saving ? "Saving…" : "Save mapping"}
          </Button>
        </details>
      </div>
    </DashboardLayout>
  );
}
