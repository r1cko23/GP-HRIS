"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { HStack, VStack } from "@/components/ui/stack";
import { Caption, BodySmall } from "@/components/ui/typography";
import { dbTableShell } from "@/lib/dashboard-ui";
import { directoryJson } from "@/lib/directory/browser";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

type CatchupRow = {
  id: string;
  directory_employee_id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  amount: number;
  reason: string;
  status: string;
  source_cutoff_period_id: string;
  apply_cutoff_period_id: string;
};

type NextOpen = {
  id: string;
  period_start: string;
  period_end: string;
  status: string;
} | null;

type RegisterPick = {
  directory_employee_id: string | null;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
};

const PAGE = 25;

export function PayrollCatchupPanel(props: {
  cutoffId: string;
  orgId: string;
  periodStatus: string;
  periodLabel: string;
}) {
  const isPosted = props.periodStatus === "posted";
  const view = isPosted ? "sourced" : "applying";

  const [rows, setRows] = useState<CatchupRow[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    isPosted ? "pending" : "pending"
  );
  const [nextOpen, setNextOpen] = useState<NextOpen>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [picks, setPicks] = useState<RegisterPick[]>([]);
  const [pickId, setPickId] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    if (!props.cutoffId || !props.orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        view,
        limit: String(PAGE),
        offset: String(offset),
      });
      if (qApplied.trim()) params.set("q", qApplied.trim());
      if (statusFilter) params.set("status", statusFilter);

      const json = await directoryJson<{
        data: CatchupRow[];
        count: number;
        next_open: NextOpen;
      }>(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/catchup-corrections?${params}`,
        props.orgId
      );
      setRows(json.data ?? []);
      setCount(json.count ?? 0);
      setNextOpen(json.next_open ?? null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to load catch-up"
      );
    } finally {
      setLoading(false);
    }
  }, [
    offset,
    props.cutoffId,
    props.orgId,
    qApplied,
    statusFilter,
    view,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isPosted || !props.orgId || !props.cutoffId) return;
    let cancelled = false;
    (async () => {
      try {
        const reg = await directoryJson<{
          data: { lines: RegisterPick[] } | null;
        }>(
          `/api/timekeeping/cutoff-periods/${props.cutoffId}/payroll-run?${new URLSearchParams(
            { limit: "200", offset: "0" }
          )}`,
          props.orgId
        );
        if (cancelled) return;
        const lines = (reg.data?.lines ?? []).filter(
          (line) => line.directory_employee_id
        );
        setPicks(lines);
      } catch {
        if (!cancelled) setPicks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isPosted, props.cutoffId, props.orgId]);

  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);

  const selectedPick = useMemo(
    () => picks.find((p) => p.directory_employee_id === pickId) ?? null,
    [pickId, picks]
  );

  async function queueCorrection() {
    if (!pickId) {
      toast.error("Choose an employee from this cutoff’s register");
      return;
    }
    setBusy(true);
    try {
      await directoryJson(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/catchup-corrections`,
        props.orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            directory_employee_id: pickId,
            amount: Number(amount),
            reason,
            apply_cutoff_period_id: nextOpen?.id,
          }),
        }
      );
      toast.success("Catch-up queued for the next open cutoff");
      setAmount("");
      setReason("");
      setPickId("");
      setOffset(0);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not queue");
    } finally {
      setBusy(false);
    }
  }

  async function cancelCorrection(correctionId: string) {
    setBusy(true);
    try {
      await directoryJson(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/catchup-corrections/${correctionId}`,
        props.orgId,
        { method: "DELETE" }
      );
      toast.success("Catch-up cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="cutoff-catchup" className="scroll-mt-24">
      <CardSection
        title={
          isPosted
            ? "Catch-up for next cutoff"
            : "Catch-up applying this cutoff"
        }
      >
        <Caption className="mb-3 block max-w-[65ch] text-muted-foreground">
          {isPosted
            ? "Posted amounts stay frozen. Queue a signed peso correction; it lands on the next open cutoff when that register is built and posted."
            : "Pending corrections add to earnings when you build this cutoff’s register."}
        </Caption>

        {isPosted ? (
          <VStack gap="3" className="mb-4 rounded-lg border border-border/70 bg-muted/20 p-3">
            {nextOpen ? (
              <BodySmall>
                Applies on{" "}
                <Link
                  href={`/payroll/${nextOpen.id}`}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  {nextOpen.period_start}–{nextOpen.period_end}
                </Link>{" "}
                <Badge variant="secondary" className="ml-1 font-normal">
                  {nextOpen.status === "pending_audit"
                    ? "Pending audit"
                    : nextOpen.status.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())}
                </Badge>
              </BodySmall>
            ) : (
              <BodySmall className="text-amber-800">
                No open successor cutoff yet. Open the next period from Payroll,
                then return here to queue catch-up.
              </BodySmall>
            )}

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-1 text-sm sm:col-span-2">
                <span className="text-muted-foreground">Employee (this register)</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={pickId}
                  onChange={(e) => setPickId(e.target.value)}
                  disabled={busy || !nextOpen}
                >
                  <option value="">Select…</option>
                  {picks.map((p) => (
                    <option
                      key={p.directory_employee_id!}
                      value={p.directory_employee_id!}
                    >
                      {[p.last_name, p.first_name].filter(Boolean).join(", ")}
                      {p.employee_code ? ` · ${p.employee_code}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-muted-foreground">Amount (₱)</span>
                <Input
                  type="number"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 500 or -200"
                  disabled={busy || !nextOpen}
                />
              </label>
              <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-1">
                <span className="text-muted-foreground"> </span>
                <Button
                  type="button"
                  className="w-full"
                  disabled={busy || !nextOpen || !pickId || !amount || !reason.trim()}
                  onClick={() => void queueCorrection()}
                >
                  Queue catch-up
                </Button>
              </label>
              <label className="space-y-1 text-sm sm:col-span-2 lg:col-span-4">
                <span className="text-muted-foreground">
                  Reason
                  {selectedPick
                    ? ` · ${selectedPick.last_name}, ${selectedPick.first_name}`
                    : ""}
                </span>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Missed OT on ${props.periodLabel}`}
                  rows={2}
                  disabled={busy || !nextOpen}
                />
              </label>
            </div>
          </VStack>
        ) : null}

        <HStack gap="2" className="mb-3 flex-wrap">
          <Input
            className="max-w-xs"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, ID, or reason"
            aria-label="Search catch-up"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setOffset(0);
              setQApplied(q);
            }}
          >
            Search
          </Button>
          <select
            className="flex h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={statusFilter}
            onChange={(e) => {
              setOffset(0);
              setStatusFilter(e.target.value);
            }}
            aria-label="Filter catch-up status"
          >
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="applied">Applied</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <Badge variant="secondary" className="font-normal">
            {count === 0
              ? "0 corrections"
              : `Showing ${showingFrom}–${showingTo} of ${count}`}
          </Badge>
        </HStack>

        <div className={dbTableShell}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                {isPosted ? <TableHead className="text-right"> </TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell
                    colSpan={isPosted ? 5 : 4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isPosted ? 5 : 4}
                    className="py-8 text-center text-muted-foreground"
                  >
                    {qApplied ||
                    (statusFilter &&
                      statusFilter !== "pending" &&
                      statusFilter !== "applied" &&
                      statusFilter !== "cancelled")
                      ? "No catch-up matches this search/filter."
                      : statusFilter === "applied"
                        ? "No applied catch-up on this cutoff."
                        : statusFilter === "cancelled"
                          ? "No cancelled catch-up on this cutoff."
                          : isPosted
                            ? "No catch-up queued from this posted cutoff yet."
                            : "No catch-up applying to this cutoff."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">
                        {[row.last_name, row.first_name]
                          .filter(Boolean)
                          .join(", ")}
                      </div>
                      <Caption className="font-mono text-muted-foreground">
                        {row.employee_code}
                      </Caption>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatCurrency(Number(row.amount))}
                    </TableCell>
                    <TableCell className="max-w-xs whitespace-normal text-sm">
                      {row.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {row.status}
                      </Badge>
                    </TableCell>
                    {isPosted ? (
                      <TableCell className="text-right">
                        {row.status === "pending" ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void cancelCorrection(row.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {count > PAGE ? (
          <HStack gap="2" className="pt-3">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - PAGE))}
            >
              Previous
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={offset + PAGE >= count || loading}
              onClick={() => setOffset(offset + PAGE)}
            >
              Next
            </Button>
          </HStack>
        ) : null}
      </CardSection>
    </div>
  );
}
