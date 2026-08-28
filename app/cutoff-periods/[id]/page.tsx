"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSection } from "@/components/ui/card-section";
import { HStack } from "@/components/ui/stack";
import { Caption } from "@/components/ui/typography";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
} from "@/lib/directory/browser";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Period = {
  id: string;
  status: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  client_id: string;
  notes: string | null;
};

type HoursRow = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  actual_regular_hours: number;
  overtime_hours: number;
  night_diff_hours: number;
  legal_holiday_hours: number;
  special_holiday_hours: number;
  rest_day_hours: number;
  pto_hours: number;
  daily_rate_payroll: number | null;
};

type RegisterLine = {
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  gross_pay: number;
  total_deductions: number;
  net_pay: number;
  deductions: Record<string, number>;
};

const HOURS_PAGE = 50;

export default function OrganicCutoffHubPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [orgId, setOrgId] = useState("");
  const [period, setPeriod] = useState<Period | null>(null);
  const [summary, setSummary] = useState<{
    hours_rows: number;
    punch_rows: number;
  } | null>(null);
  const [hours, setHours] = useState<HoursRow[]>([]);
  const [hoursCount, setHoursCount] = useState(0);
  const [hoursOffset, setHoursOffset] = useState(0);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editReg, setEditReg] = useState("");
  const [editOt, setEditOt] = useState("");
  const [register, setRegister] = useState<{
    run: { id: string; status: string; totals: Record<string, number> } | null;
    lines: RegisterLine[];
  } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const org = await ensureDirectoryOrgId();
      setOrgId(org);
      const json = await directoryJson<{
        data: {
          period: Period;
          summary: { hours_rows: number; punch_rows: number };
          hours?: HoursRow[];
          hours_pagination?: { count: number };
        };
      }>(
        `/api/timekeeping/cutoff-periods/${id}?${new URLSearchParams({
          include: "hours",
          hours_limit: String(HOURS_PAGE),
          hours_offset: String(hoursOffset),
          ...(qApplied.trim() ? { q: qApplied.trim() } : {}),
        })}`,
        org
      );
      setPeriod(json.data.period);
      setSummary(json.data.summary);
      setHours(json.data.hours ?? []);
      setHoursCount(json.data.hours_pagination?.count ?? 0);

      try {
        const reg = await directoryJson<{
          data: {
            run: { id: string; status: string; totals: Record<string, number> };
            lines: RegisterLine[];
          } | null;
        }>(`/api/timekeeping/cutoff-periods/${id}/payroll-run`, org);
        setRegister(
          reg.data
            ? { run: reg.data.run, lines: reg.data.lines ?? [] }
            : null
        );
      } catch {
        setRegister(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load cutoff");
    } finally {
      setLoading(false);
    }
  }, [hoursOffset, id, qApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(label: string, fn: () => Promise<void>) {
    setBusy(label);
    try {
      await fn();
      toast.success(label);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  async function aggregate() {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/aggregate-from-office`,
      orgId,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replace_existing: true }),
      }
    );
  }

  async function setStatus(next: string) {
    await directoryJson(`/api/timekeeping/cutoff-periods/${id}`, orgId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
  }

  async function buildRegister() {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/payroll-run`,
      orgId,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }
    );
  }

  async function postRegister() {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/payroll-run/post`,
      orgId,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }
    );
  }

  async function saveHoursEdit(hoursId: string) {
    await directoryJson(
      `/api/timekeeping/cutoff-periods/${id}/hours/${hoursId}`,
      orgId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          actual_regular_hours: Number(editReg) || 0,
          overtime_hours: Number(editOt) || 0,
          note: "HR draft edit",
        }),
      }
    );
    setEditId(null);
  }

  function downloadExport(type: string) {
    const url = `/api/timekeeping/cutoff-periods/${id}/exports?type=${encodeURIComponent(type)}`;
    // Browser download via fetch with org header is awkward; use json format + blob
    void (async () => {
      try {
        const json = await directoryJson<{
          data: { csv: string; filename: string };
        }>(`${url}&format=json`, orgId);
        const blob = new Blob([json.data.csv], {
          type: "text/csv;charset=utf-8",
        });
        const href = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = href;
        a.download = json.data.filename;
        a.click();
        URL.revokeObjectURL(href);
        toast.success(`Downloaded ${type}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Export failed");
      }
    })();
  }

  const canEditHours =
    period?.status === "draft" || period?.status === "pending_audit";
  const canAggregate = canEditHours;
  const canApprove = period?.status === "pending_audit";
  const canSubmitAudit = period?.status === "draft";
  const canBuildRegister =
    period?.status === "approved" || period?.status === "posted";
  const canPost =
    period?.status === "approved" && register?.run?.status === "draft";

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <Button asChild variant="ghost" size="sm" className="-ml-2">
              <Link href="/cutoff-periods">← Organic cutoffs</Link>
            </Button>
          }
          title="Cutoff hub"
          description={
            period
              ? `${period.period_start} → ${period.period_end} · ${period.status}`
              : "Organic bundy hours, payroll register, and exports"
          }
          actions={
            <HStack gap="2" className="flex-wrap">
              {canAggregate ? (
                <Button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction("Aggregated from bundy", aggregate)
                  }
                >
                  Aggregate bundy
                </Button>
              ) : null}
              {canSubmitAudit ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction("Submitted for audit", () =>
                      setStatus("pending_audit")
                    )
                  }
                >
                  Submit audit
                </Button>
              ) : null}
              {canApprove ? (
                <Button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction("Cutoff approved", () =>
                      setStatus("approved")
                    )
                  }
                >
                  Approve
                </Button>
              ) : null}
              {canBuildRegister ? (
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction("Register built", buildRegister)
                  }
                >
                  Build register
                </Button>
              ) : null}
              {canPost ? (
                <Button
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void runAction("Payroll posted", postRegister)
                  }
                >
                  Post payroll
                </Button>
              ) : null}
            </HStack>
          }
        />

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        {loading && !period ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          </div>
        ) : (
          <>
            <CardSection title="Summary">
              <div className="flex flex-wrap gap-4 text-sm">
                <div>
                  <Caption className="text-muted-foreground">Status</Caption>
                  <p className="font-medium">
                    <Badge variant="outline">{period?.status}</Badge>
                  </p>
                </div>
                <div>
                  <Caption className="text-muted-foreground">Hours rows</Caption>
                  <p className="font-medium tabular-nums">
                    {summary?.hours_rows ?? 0}
                  </p>
                </div>
                <div>
                  <Caption className="text-muted-foreground">Punches</Caption>
                  <p className="font-medium tabular-nums">
                    {summary?.punch_rows ?? 0}
                  </p>
                </div>
                {register?.run ? (
                  <div>
                    <Caption className="text-muted-foreground">Register</Caption>
                    <p className="font-medium">
                      {register.run.status} · net{" "}
                      {Number(register.run.totals?.net_pay ?? 0).toLocaleString()}
                    </p>
                  </div>
                ) : null}
              </div>
            </CardSection>

            <CardSection title="Cutoff hours">
              <HStack gap="2" className="mb-3 flex-wrap">
                <Input
                  className="max-w-sm"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setHoursOffset(0);
                      setQApplied(q);
                    }
                  }}
                  placeholder="Search name or employee ID"
                  aria-label="Search hours"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setHoursOffset(0);
                    setQApplied(q);
                  }}
                >
                  Search
                </Button>
              </HStack>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Reg</TableHead>
                      <TableHead>OT</TableHead>
                      <TableHead>ND</TableHead>
                      <TableHead>LH</TableHead>
                      <TableHead>SH</TableHead>
                      <TableHead>RD</TableHead>
                      <TableHead>PTO</TableHead>
                      <TableHead>Rate</TableHead>
                      {canEditHours ? (
                        <TableHead className="text-right">Edit</TableHead>
                      ) : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hours.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-mono text-xs">
                          {row.employee_code}
                        </TableCell>
                        <TableCell>
                          {row.last_name}, {row.first_name}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {editId === row.id ? (
                            <Input
                              className="h-8 w-20"
                              value={editReg}
                              onChange={(e) => setEditReg(e.target.value)}
                            />
                          ) : (
                            row.actual_regular_hours
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {editId === row.id ? (
                            <Input
                              className="h-8 w-20"
                              value={editOt}
                              onChange={(e) => setEditOt(e.target.value)}
                            />
                          ) : (
                            row.overtime_hours
                          )}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.night_diff_hours}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.legal_holiday_hours}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.special_holiday_hours}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.rest_day_hours}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.pto_hours}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {row.daily_rate_payroll ?? "—"}
                        </TableCell>
                        {canEditHours ? (
                          <TableCell className="text-right">
                            {editId === row.id ? (
                              <HStack gap="1" className="justify-end">
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() =>
                                    void runAction("Hours saved", () =>
                                      saveHoursEdit(row.id)
                                    )
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditId(null)}
                                >
                                  Cancel
                                </Button>
                              </HStack>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditId(row.id);
                                  setEditReg(String(row.actual_regular_hours));
                                  setEditOt(String(row.overtime_hours));
                                }}
                              >
                                Edit
                              </Button>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {hoursCount > HOURS_PAGE ? (
                <HStack gap="2" className="pt-3">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={hoursOffset === 0}
                    onClick={() =>
                      setHoursOffset(Math.max(0, hoursOffset - HOURS_PAGE))
                    }
                  >
                    Previous
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={hoursOffset + HOURS_PAGE >= hoursCount}
                    onClick={() => setHoursOffset(hoursOffset + HOURS_PAGE)}
                  >
                    Next
                  </Button>
                  <Caption className="text-muted-foreground">
                    Showing {hoursOffset + 1}–
                    {Math.min(hoursOffset + HOURS_PAGE, hoursCount)} of{" "}
                    {hoursCount}
                  </Caption>
                </HStack>
              ) : null}
            </CardSection>

            {register?.run ? (
              <CardSection title="Payroll register">
                <div className="mb-3 flex flex-wrap gap-2">
                  {(
                    [
                      "payslips",
                      "sss",
                      "philhealth",
                      "pagibig",
                      "wtax",
                      "bank",
                    ] as const
                  ).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => downloadExport(type)}
                    >
                      Export {type}
                    </Button>
                  ))}
                </div>
                <div className={dbTableShell}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Gross</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {register.lines.map((line, i) => (
                        <TableRow
                          key={`${line.employee_code}-${i}`}
                        >
                          <TableCell className="font-mono text-xs">
                            {line.employee_code}
                          </TableCell>
                          <TableCell>
                            {line.last_name}, {line.first_name}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {Number(line.gross_pay).toLocaleString()}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {Number(line.total_deductions).toLocaleString()}
                          </TableCell>
                          <TableCell className="tabular-nums font-medium">
                            {Number(line.net_pay).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardSection>
            ) : null}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
