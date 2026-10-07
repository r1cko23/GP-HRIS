"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { CardSection } from "@/components/ui/card-section";
import { HStack } from "@/components/ui/stack";
import { BodySmall, Caption } from "@/components/ui/typography";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";
import {
  directoryJson,
  ensureDirectoryOrgId,
} from "@/lib/directory/browser";
import { formatCurrency, formatNumber } from "@/utils/format";
import { toast } from "sonner";

const PAGE = 50;

type QueueStatus = "queued" | "awaiting_ref" | "confirmed";

type QueueItem = {
  run_id: string;
  cutoff_period_id: string;
  client_name: string;
  period_start: string;
  period_end: string;
  payroll_date: string | null;
  queue_status: QueueStatus;
  atm_pax: number | null;
  atm_total: number | null;
  disbursement: {
    id: string;
    upload_date: string | null;
    batch_no: number | null;
    record_count: number;
    total_amount: number;
    bdo_reference: string | null;
    generated_at: string | null;
  } | null;
};

type AtmSheetRow = {
  no: number;
  accountNo: string;
  amount: number;
  name: string;
  dailyRate: number;
  rhWorked: number;
  deptStore: string;
};

type SheetPreview = {
  run_id: string;
  cutoff_period_id: string;
  queue_status: QueueStatus | null;
  pay_out_date: string;
  funding_account: string | null;
  preview: AtmSheetRow[];
  atm_pax: number;
  atm_total: number;
  disbursement: {
    id: string;
    status: string;
    bdo_reference: string | null;
  } | null;
};

function statusBadge(status: QueueStatus) {
  if (status === "confirmed") return "default" as const;
  if (status === "awaiting_ref") return "secondary" as const;
  return "outline" as const;
}

function statusLabel(status: QueueStatus) {
  if (status === "confirmed") return "Confirmed";
  if (status === "awaiting_ref") return "Awaiting BDO ref";
  return "Queued";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function periodLabel(item: Pick<QueueItem, "period_start" | "period_end" | "client_name">) {
  return `${item.period_start}–${item.period_end}${
    item.client_name ? ` · ${item.client_name}` : ""
  }`;
}

function downloadBase64Txt(base64: string, filename: string) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "text/plain; charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function BdoQueueInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [cutoffOptions, setCutoffOptions] = useState<QueueItem[]>([]);
  const [rows, setRows] = useState<QueueItem[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<SheetPreview | null>(null);

  const q = searchParams.get("q") ?? "";
  const status = (searchParams.get("status") ?? "") as QueueStatus | "";
  const cutoffId = searchParams.get("cutoff_period_id") ?? "";
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
  const [qDraft, setQDraft] = useState(q);

  const [genOpen, setGenOpen] = useState(false);
  const [uploadDate, setUploadDate] = useState(todayIso());
  const [batchNo, setBatchNo] = useState("1");
  const [refOpen, setRefOpen] = useState(false);
  const [bdoRef, setBdoRef] = useState("");

  const writeParams = useCallback(
    (patch: Record<string, string | number | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      router.replace(`/bdo-queue?${next.toString()}`);
    },
    [router, searchParams]
  );

  useEffect(() => {
    setQDraft(q);
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (qDraft === q) return;
      writeParams({ q: qDraft.trim() || null, offset: 0 });
    }, 300);
    return () => window.clearTimeout(t);
  }, [qDraft, q, writeParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const oid = await ensureDirectoryOrgId();
      setOrgId(oid);
      if (!oid) {
        setRows([]);
        setCount(0);
        setCutoffOptions([]);
        return;
      }

      // Recent cutoffs for the dropdown (DB-paginated — do not pull all posted runs).
      const optionsJson = await directoryJson<{
        data: QueueItem[];
        count: number;
      }>(`/api/payroll/bdo-queue?limit=100&offset=0`, oid);
      setCutoffOptions(optionsJson.data ?? []);

      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
      });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      if (cutoffId) params.set("cutoff_period_id", cutoffId);

      // Reuse options response when it already matches the table query.
      if (!cutoffId && !q.trim() && !status && offset === 0) {
        setRows((optionsJson.data ?? []).slice(0, PAGE));
        setCount(optionsJson.count ?? 0);
      } else {
        const json = await directoryJson<{
          data: QueueItem[];
          count: number;
        }>(`/api/payroll/bdo-queue?${params}`, oid);
        setRows(json.data ?? []);
        setCount(json.count ?? 0);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load queue");
      setRows([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [cutoffId, offset, q, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSheet = useCallback(
    async (oid: string, cutoff: string) => {
      setSheetLoading(true);
      try {
        const json = await directoryJson<{ data: SheetPreview }>(
          `/api/payroll/bdo-queue`,
          oid,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ cutoff_period_id: cutoff }),
          }
        );
        setSheet(json.data);
      } catch (err) {
        setSheet(null);
        toast.error(
          err instanceof Error ? err.message : "Failed to load ATM Payroll sheet"
        );
      } finally {
        setSheetLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!orgId || !cutoffId) {
      setSheet(null);
      return;
    }
    void loadSheet(orgId, cutoffId);
  }, [orgId, cutoffId, loadSheet]);

  const selectedCutoff = useMemo(
    () => cutoffOptions.find((r) => r.cutoff_period_id === cutoffId) ?? null,
    [cutoffId, cutoffOptions]
  );

  async function confirmGenerate() {
    if (!orgId || !sheet) return;
    setBusy(true);
    try {
      const json = await directoryJson<{
        data: {
          filename: string;
          txt_base64: string;
          warnings?: string[];
        };
      }>(`/api/payroll/bdo-disbursements`, orgId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          run_id: sheet.run_id,
          upload_date: uploadDate,
          batch_no: Number(batchNo),
          format: "json",
        }),
      });
      downloadBase64Txt(json.data.txt_base64, json.data.filename);
      if (json.data.warnings?.length) {
        toast.message(json.data.warnings.join("; "));
      }
      toast.success(`Downloaded ${json.data.filename}`);
      setGenOpen(false);
      await load();
      await loadSheet(orgId, sheet.cutoff_period_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generate failed");
    } finally {
      setBusy(false);
    }
  }

  async function redownload() {
    if (!orgId || !sheet?.disbursement) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/payroll/bdo-disbursements/${sheet.disbursement.id}/file`,
        {
          headers: { "x-organization-id": orgId },
          credentials: "include",
        }
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(err?.error || `Download failed (${res.status})`);
      }
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? "bdo-atm.txt";
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(href);
      toast.success(`Downloaded ${filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  async function pasteReference() {
    if (!orgId || !sheet?.disbursement) return;
    setBusy(true);
    try {
      await directoryJson(
        `/api/payroll/bdo-disbursements/${sheet.disbursement.id}`,
        orgId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bdo_reference: bdoRef }),
        }
      );
      toast.success("BDO reference saved — Debit Memo locked");
      setRefOpen(false);
      setBdoRef("");
      await load();
      await loadSheet(orgId, sheet.cutoff_period_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function voidDisbursement() {
    if (!orgId || !sheet?.disbursement) return;
    if (
      !window.confirm(
        sheet.queue_status === "queued"
          ? "Remove this cutoff from the Debit Memo Queue?"
          : "Void this BDO file so you can add this Debit Memo again later?"
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await directoryJson(
        `/api/payroll/bdo-disbursements/${sheet.disbursement.id}`,
        orgId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "void", void_reason: "ops void" }),
        }
      );
      toast.success("Removed from Debit Memo Queue");
      await load();
      await loadSheet(orgId, sheet.cutoff_period_id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Void failed");
    } finally {
      setBusy(false);
    }
  }

  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE, count);
  const sheetTotal = sheet?.atm_total ?? 0;
  const funding = sheet?.funding_account ?? "2110254455";

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Debit Memo Queue"
        />

        <CardSection title="Filters">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label>Cutoff</Label>
              <Select
                value={cutoffId || "all"}
                onValueChange={(value) =>
                  writeParams({
                    cutoff_period_id: value === "all" ? null : value,
                    offset: 0,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select cutoff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All cutoffs</SelectItem>
                  {cutoffOptions.map((opt) => (
                    <SelectItem
                      key={opt.cutoff_period_id}
                      value={opt.cutoff_period_id}
                    >
                      {periodLabel(opt)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={status || "all"}
                onValueChange={(value) =>
                  writeParams({
                    status: value === "all" ? null : value,
                    offset: 0,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="awaiting_ref">Awaiting BDO ref</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bdo-q">Search</Label>
              <Input
                id="bdo-q"
                placeholder="Period, client, or BDO reference"
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
              />
            </div>
          </div>
        </CardSection>

        {cutoffId ? (
          <CardSection
            title={
              <span className="inline-flex items-center gap-2">
                ATM PAYROLL
                {sheet?.queue_status ? (
                  <Badge variant={statusBadge(sheet.queue_status)}>
                    {statusLabel(sheet.queue_status)}
                  </Badge>
                ) : null}
              </span>
            }
          >
            {sheetLoading ? (
              <Caption className="text-muted-foreground">
                Loading Debit Memo ATM sheet…
              </Caption>
            ) : !sheet ? (
              <Caption className="text-muted-foreground">
                Could not load ATM rows for this cutoff.
              </Caption>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border border-border bg-card p-4 text-sm leading-relaxed">
                  <p className="font-semibold tabular-nums">
                    {sheet.pay_out_date}
                  </p>
                  <p className="mt-3 font-semibold">Banco De Oro</p>
                  <p>Julia Vargas Branch</p>
                  <p>Ortigas, Pasig City</p>
                  <p className="mt-3">Gentlemen,</p>
                  <p className="mt-3 max-w-[70ch] text-pretty">
                    This is to authorize your branch to debit the amount of{" "}
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(sheetTotal)}
                    </span>{" "}
                    from Savings Account{" "}
                    <span className="font-mono">#{funding}</span> under the name
                    of Green Pasture People Management Inc for credit to various
                    savings accounts, viz;
                  </p>
                  {selectedCutoff ? (
                    <Caption className="mt-3 block text-muted-foreground">
                      Cutoff {periodLabel(selectedCutoff)}
                      {selectedCutoff.payroll_date
                        ? ` · payroll ${selectedCutoff.payroll_date}`
                        : ""}{" "}
                      ·{" "}
                      <Link
                        href={`/payroll/${selectedCutoff.cutoff_period_id}`}
                        className="text-primary underline-offset-2 hover:underline"
                      >
                        Open cutoff
                      </Link>
                    </Caption>
                  ) : null}
                </div>

                <div className={`${dbTableShell} max-h-[28rem] overflow-auto`}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12 text-right tabular-nums">
                          #
                        </TableHead>
                        <TableHead className="text-center">Account No.</TableHead>
                        <TableHead className="text-right tabular-nums">
                          Amount
                        </TableHead>
                        <TableHead className="text-left">Name of Employee</TableHead>
                        <TableHead className="text-right tabular-nums">
                          Daily Rate
                        </TableHead>
                        <TableHead className="text-right tabular-nums">
                          RH Worked
                        </TableHead>
                        <TableHead className="text-left">Dept/Store</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sheet.preview.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={7}
                            className="text-muted-foreground"
                          >
                            No ATM Debit Memo rows for this cutoff.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {sheet.preview.map((r) => (
                            <TableRow key={`${r.accountNo}-${r.no}`}>
                              <TableCell className="text-right tabular-nums">
                                {r.no}
                              </TableCell>
                              <TableCell className="text-center font-mono text-xs">
                                {r.accountNo}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(r.amount)}
                              </TableCell>
                              <TableCell className="text-left">{r.name}</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(r.dailyRate)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(r.rhWorked)}
                              </TableCell>
                              <TableCell className="text-left">
                                {r.deptStore}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="font-semibold">
                            <TableCell />
                            <TableCell className="text-left">TOTAL</TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(sheetTotal)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {sheet.atm_pax} pax
                            </TableCell>
                            <TableCell colSpan={3} />
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <HStack gap="2" className="flex-wrap">
                  {!sheet.queue_status ? (
                    <Caption className="text-muted-foreground">
                      This cutoff is not on the Debit Memo Queue. Add it from
                      the posted payroll cutoff page.
                    </Caption>
                  ) : null}
                  {sheet.queue_status === "queued" ? (
                    <>
                      <Button
                        type="button"
                        disabled={busy || sheet.preview.length === 0}
                        onClick={() => {
                          setUploadDate(todayIso());
                          setBatchNo("1");
                          setGenOpen(true);
                        }}
                      >
                        Generate .txt
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => void voidDisbursement()}
                      >
                        Remove from queue
                      </Button>
                    </>
                  ) : null}
                  {sheet.queue_status === "awaiting_ref" ||
                  sheet.queue_status === "confirmed" ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy}
                      onClick={() => void redownload()}
                    >
                      Re-download .txt
                    </Button>
                  ) : null}
                  {sheet.queue_status === "awaiting_ref" ? (
                    <>
                      <Button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setBdoRef("");
                          setRefOpen(true);
                        }}
                      >
                        Paste BDO reference
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="text-destructive"
                        disabled={busy}
                        onClick={() => void voidDisbursement()}
                      >
                        Void
                      </Button>
                    </>
                  ) : null}
                  {sheet.queue_status === "confirmed" ? (
                    <BodySmall className="font-mono text-xs text-muted-foreground">
                      Locked · Ref {sheet.disbursement?.bdo_reference}
                    </BodySmall>
                  ) : null}
                </HStack>
              </div>
            )}
          </CardSection>
        ) : (
          <CardSection title="Select a cutoff">
            <Caption className="text-muted-foreground">
              Choose a cutoff already on the Debit Memo Queue, or add one from a
              posted payroll cutoff page.
            </Caption>
          </CardSection>
        )}

        <CardSection title="Queue">
          <div className={dbTableShell}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Period</TableHead>
                  <TableHead className="text-left">Client</TableHead>
                  <TableHead className="text-center">Payroll date</TableHead>
                  <TableHead className="text-right tabular-nums">ATM pax</TableHead>
                  <TableHead className="text-right tabular-nums">
                    ATM total
                  </TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">BDO ref</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-muted-foreground">
                      {q || status || cutoffId
                        ? "No results for this search/filter."
                        : "No cutoffs on the Debit Memo Queue yet. Add one from a posted payroll."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => (
                    <TableRow key={row.run_id}>
                      <TableCell className="text-center tabular-nums">
                        {row.period_start}–{row.period_end}
                      </TableCell>
                      <TableCell className="text-left">
                        {row.client_name || "—"}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {row.payroll_date ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.atm_pax ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.atm_total != null
                          ? formatCurrency(row.atm_total)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant={statusBadge(row.queue_status)}>
                          {statusLabel(row.queue_status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[10rem] truncate text-center font-mono text-xs">
                        {row.disbursement?.bdo_reference ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <HStack gap="1" className="gp-row-actions justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant={
                              cutoffId === row.cutoff_period_id
                                ? "default"
                                : "outline"
                            }
                            onClick={() =>
                              writeParams({
                                cutoff_period_id: row.cutoff_period_id,
                                offset: 0,
                              })
                            }
                          >
                            Review sheet
                          </Button>
                        </HStack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <HStack gap="2" className="mt-3 items-center">
            <Caption className="text-muted-foreground">
              Showing {from}–{to} of {count}
            </Caption>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset === 0 || loading}
              onClick={() => writeParams({ offset: Math.max(0, offset - PAGE) })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={offset + PAGE >= count || loading}
              onClick={() => writeParams({ offset: offset + PAGE })}
            >
              Next
            </Button>
          </HStack>
        </CardSection>

        <Dialog open={genOpen} onOpenChange={setGenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate BDO ATM .txt</DialogTitle>
              <DialogDescription>
                You reviewed {sheet?.atm_pax ?? 0} ATM rows totaling{" "}
                {formatCurrency(sheetTotal)}. Set upload date and batch for the
                BDO file header, then download.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="bdo-upload-date">Upload date</Label>
                <Input
                  id="bdo-upload-date"
                  type="date"
                  value={uploadDate}
                  min={todayIso()}
                  onChange={(e) => setUploadDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bdo-batch">Batch (1–99)</Label>
                <Input
                  id="bdo-batch"
                  type="number"
                  min={1}
                  max={99}
                  value={batchNo}
                  onChange={(e) => setBatchNo(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGenOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !sheet?.preview.length}
                onClick={() => void confirmGenerate()}
              >
                Download .txt
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={refOpen} onOpenChange={setRefOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Paste BDO reference</DialogTitle>
              <DialogDescription>
                After BDO processes the upload, paste the transaction reference
                here. This locks the Debit Memo so it cannot be paid twice.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="bdo-ref">BDO reference</Label>
              <Input
                id="bdo-ref"
                value={bdoRef}
                onChange={(e) => setBdoRef(e.target.value)}
                placeholder="Reference from BDO Online"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !bdoRef.trim()}
                onClick={() => void pasteReference()}
              >
                Save & lock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default function BdoQueuePage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className={dbPageWrapper}>Loading…</div>
        </DashboardLayout>
      }
    >
      <BdoQueueInner />
    </Suspense>
  );
}
