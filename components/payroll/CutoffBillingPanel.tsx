"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ListFilterSuggest,
  type ListSuggestOption,
} from "@/components/ListFilterSuggest";
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
import { MetricCard } from "@/components/ui/metric-card";
import { dbKpiGrid, dbTableShell } from "@/lib/dashboard-ui";
import { directoryJson } from "@/lib/directory/browser";
import { formatProseDisplay } from "@/lib/directory/display-value";
import { formatCurrency } from "@/utils/format";
import { toast } from "sonner";

type BillingRun = {
  id: string;
  status: string;
  billing_reference: string;
  billing_date: string;
  line_count: number;
  totals: Record<string, number>;
  fees?: {
    expenses?: Array<{ particular?: string; amount?: number }>;
  } | null;
};

type ExpenseDraft = { particular: string; amount: string };

type BillingLine = {
  id: string;
  employee_code: string | null;
  last_name: string | null;
  first_name: string | null;
  billing_daily_rate: number;
  labor: number;
  mandatories: number;
  billable: number;
};

const PAGE = 50;

function downloadBase64File(base64: string, filename: string, mime: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

export function CutoffBillingPanel(props: {
  cutoffId: string;
  orgId: string;
  periodStatus: string;
}) {
  const posted = props.periodStatus === "posted";
  const [run, setRun] = useState<BillingRun | null>(null);
  const [lines, setLines] = useState<BillingLine[]>([]);
  const [count, setCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [qApplied, setQApplied] = useState("");
  const [billed, setBilled] = useState<"all" | "yes" | "no">("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState<"soa" | "debit-memo" | null>(
    null
  );
  const [expenseDrafts, setExpenseDrafts] = useState<ExpenseDraft[]>([]);
  const [expenseBusy, setExpenseBusy] = useState(false);

  const load = useCallback(async () => {
    if (!props.cutoffId || !props.orgId || !posted) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
      });
      if (qApplied.trim()) params.set("q", qApplied.trim());
      if (billed !== "all") params.set("billed", billed);
      const json = await directoryJson<{
        data: {
          run: BillingRun | null;
          lines: BillingLine[];
          count: number;
        };
      }>(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing?${params}`,
        props.orgId
      );
      const nextRun = json.data?.run ?? null;
      setRun(nextRun);
      setLines(json.data?.lines ?? []);
      setCount(json.data?.count ?? 0);
      const stored = Array.isArray(nextRun?.fees?.expenses)
        ? nextRun!.fees!.expenses!
        : [];
      setExpenseDrafts(
        stored.map((row) => ({
          particular: String(row.particular ?? ""),
          amount: row.amount == null ? "" : String(row.amount),
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [billed, offset, posted, props.cutoffId, props.orgId, qApplied]);

  useEffect(() => {
    void load();
  }, [load]);

  async function downloadExport(type: "soa" | "debit-memo") {
    setExportBusy(type);
    try {
      const params = new URLSearchParams({ type, format: "json" });
      const json = await directoryJson<{
        data: {
          filename: string;
          mime?: string;
          xlsx_base64?: string;
          pdf_base64?: string;
        };
      }>(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing/export?${params}`,
        props.orgId
      );
      const file = json.data;
      if (type === "soa" && file.xlsx_base64) {
        downloadBase64File(
          file.xlsx_base64,
          file.filename,
          file.mime ||
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
      } else if (type === "debit-memo" && file.pdf_base64) {
        downloadBase64File(
          file.pdf_base64,
          file.filename,
          file.mime || "application/pdf"
        );
      } else {
        throw new Error("Export did not return a file");
      }
      toast.success(`Downloaded ${file.filename}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setExportBusy(null);
    }
  }

  async function processBilling() {
    setBusy(true);
    try {
      await directoryJson(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing`,
        props.orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      );
      toast.success("Client billing processed");
      setOffset(0);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Billing failed");
    } finally {
      setBusy(false);
    }
  }

  async function cancelBilling() {
    setBusy(true);
    try {
      await directoryJson(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing`,
        props.orgId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "cancelled" }),
        }
      );
      toast.success("Billing cancelled — payroll is unchanged");
      setRun(null);
      setLines([]);
      setCount(0);
      setExpenseDrafts([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setBusy(false);
    }
  }

  async function saveExpenses() {
    setExpenseBusy(true);
    try {
      const expenses = expenseDrafts
        .map((row) => ({
          particular: row.particular.trim(),
          amount: Number(row.amount),
        }))
        .filter((row) => row.particular && Number.isFinite(row.amount));
      const json = await directoryJson<{ data: { run: BillingRun } }>(
        `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing`,
        props.orgId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenses }),
        }
      );
      setRun(json.data.run);
      const stored = Array.isArray(json.data.run.fees?.expenses)
        ? json.data.run.fees!.expenses!
        : [];
      setExpenseDrafts(
        stored.map((row) => ({
          particular: String(row.particular ?? ""),
          amount: row.amount == null ? "" : String(row.amount),
        }))
      );
      toast.success("SOA expenses saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save expenses failed");
    } finally {
      setExpenseBusy(false);
    }
  }

  if (!posted) return null;

  const totals = run?.totals ?? {};
  const showingFrom = count === 0 ? 0 : offset + 1;
  const showingTo = Math.min(offset + PAGE, count);

  return (
    <div id="client-billing" className="scroll-mt-24 space-y-4">
      <CardSection
        title="Bill the client"
        description="Same hours as the posted register, billed at Directory billing rates — then admin fee, VAT, and EWT. Download SOA and debit memo after Process billing."
      >
        <VStack gap="4" align="stretch">
          <HStack gap="2" className="flex-wrap">
            {!run ? (
              <Button
                type="button"
                disabled={busy || loading}
                onClick={() => void processBilling()}
              >
                Process billing
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void cancelBilling()}
              >
                Cancel billing
              </Button>
            )}
            {run ? (
              <>
                <Badge variant="secondary">
                  {run.billing_reference} · {run.billing_date}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || exportBusy !== null}
                  onClick={() => void downloadExport("soa")}
                >
                  {exportBusy === "soa" ? "Downloading…" : "Download SOA"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || exportBusy !== null}
                  onClick={() => void downloadExport("debit-memo")}
                >
                  {exportBusy === "debit-memo"
                    ? "Downloading…"
                    : "Download debit memo"}
                </Button>
              </>
            ) : (
              <Caption>
                Needs a posted register with billing daily rates. House staff
                have none.
              </Caption>
            )}
          </HStack>

          {run ? (
            <div className={dbKpiGrid}>
              <MetricCard
                label="Labor"
                value={formatCurrency(Number(totals.labor ?? 0))}
              />
              <MetricCard
                label="Mandatories"
                value={formatCurrency(Number(totals.mandatories ?? 0))}
              />
              <MetricCard
                label="Admin fee"
                value={formatCurrency(Number(totals.admin_fee_amount ?? 0))}
              />
              <MetricCard
                label="Amount due"
                value={formatCurrency(Number(totals.amount_due ?? 0))}
              />
            </div>
          ) : null}

          {run ? (
            <div className="space-y-3 rounded-md border border-border/60 p-3">
              <div>
                <BodySmall className="font-medium">SOA Expense sheet</BodySmall>
                <Caption>
                  Pass-through costs only — does not change amount due. Saved on
                  this billing run for the next SOA download.
                </Caption>
              </div>
              <div className="space-y-2">
                {expenseDrafts.length === 0 ? (
                  <Caption>No expense rows yet.</Caption>
                ) : (
                  expenseDrafts.map((row, index) => (
                    <HStack key={index} gap="2" className="flex-wrap items-end">
                      <div className="min-w-[12rem] flex-1">
                        <Caption>Particular</Caption>
                        <Input
                          value={row.particular}
                          disabled={expenseBusy || busy}
                          onChange={(e) => {
                            const next = [...expenseDrafts];
                            next[index] = {
                              ...next[index],
                              particular: e.target.value,
                            };
                            setExpenseDrafts(next);
                          }}
                        />
                      </div>
                      <div className="w-36">
                        <Caption>Amount</Caption>
                        <Input
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          className="tabular-nums"
                          value={row.amount}
                          disabled={expenseBusy || busy}
                          onChange={(e) => {
                            const next = [...expenseDrafts];
                            next[index] = {
                              ...next[index],
                              amount: e.target.value,
                            };
                            setExpenseDrafts(next);
                          }}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={expenseBusy || busy}
                        onClick={() =>
                          setExpenseDrafts(
                            expenseDrafts.filter((_, i) => i !== index)
                          )
                        }
                      >
                        Remove
                      </Button>
                    </HStack>
                  ))
                )}
              </div>
              <HStack gap="2" className="flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={expenseBusy || busy}
                  onClick={() =>
                    setExpenseDrafts([
                      ...expenseDrafts,
                      { particular: "", amount: "" },
                    ])
                  }
                >
                  Add expense
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={expenseBusy || busy}
                  onClick={() => void saveExpenses()}
                >
                  {expenseBusy ? "Saving…" : "Save expenses"}
                </Button>
              </HStack>
            </div>
          ) : null}

          {run ? (
            <>
              <HStack gap="2" className="flex-wrap">
                <ListFilterSuggest
                  className="max-w-xs"
                  value={q}
                  onValueChange={setQ}
                  onSelect={(opt) => {
                    setQ(opt.value);
                    setOffset(0);
                    setQApplied(opt.value);
                  }}
                  placeholder="Search name or code"
                  aria-label="Search billing lines"
                  fetchSuggestions={async (query) => {
                    const params = new URLSearchParams({
                      limit: "10",
                      offset: "0",
                      q: query,
                    });
                    if (billed !== "all") params.set("billed", billed);
                    const json = await directoryJson<{
                      data: { lines: BillingLine[] };
                    }>(
                      `/api/timekeeping/cutoff-periods/${props.cutoffId}/billing?${params}`,
                      props.orgId
                    );
                    return (json.data.lines ?? []).map(
                      (line): ListSuggestOption => {
                        const name = [line.last_name, line.first_name]
                          .filter(Boolean)
                          .join(", ");
                        const code = line.employee_code || "—";
                        return {
                          id: line.id,
                          primary: `${name || "—"} · ${code}`,
                          value: name || code,
                          matchText: code,
                        };
                      }
                    );
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOffset(0);
                    setQApplied(q);
                  }}
                >
                  Search
                </Button>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={billed}
                  onChange={(e) => {
                    setOffset(0);
                    setBilled(e.target.value as "all" | "yes" | "no");
                  }}
                >
                  <option value="all">All lines</option>
                  <option value="yes">With labor</option>
                  <option value="no">Zero labor</option>
                </select>
              </HStack>
              <div className={dbTableShell}>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead className="text-right">Billing daily</TableHead>
                      <TableHead className="text-right">Labor</TableHead>
                      <TableHead className="text-right">Mandatories</TableHead>
                      <TableHead className="text-right">Billable</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <BodySmall>Loading billing…</BodySmall>
                        </TableCell>
                      </TableRow>
                    ) : lines.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5}>
                          <BodySmall>
                            {qApplied || billed !== "all"
                              ? "No people match this search or filter."
                              : "No billing lines."}
                          </BodySmall>
                        </TableCell>
                      </TableRow>
                    ) : (
                      lines.map((line) => (
                        <TableRow key={line.id}>
                          <TableCell>
                            {formatProseDisplay(
                              `${line.last_name}, ${line.first_name}`
                            )}
                            {line.employee_code ? (
                              <Caption className="block">
                                {line.employee_code}
                              </Caption>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(line.billing_daily_rate))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(line.labor))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(line.mandatories))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(line.billable))}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <HStack className="justify-between">
                <Caption>
                  Showing {showingFrom}–{showingTo} of {count}
                </Caption>
                <HStack gap="2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={offset === 0 || loading}
                    onClick={() => setOffset(Math.max(0, offset - PAGE))}
                  >
                    Prev
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
              </HStack>
            </>
          ) : null}
        </VStack>
      </CardSection>
    </div>
  );
}
