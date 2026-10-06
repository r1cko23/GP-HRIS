"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { directoryJson } from "@/lib/directory/browser";
import {
  TIMESHEET_PAY_FORMATS,
  timesheetPayFormatLabel,
  type TimesheetPayFormat,
} from "@/lib/directory/timesheet-pay-format";
import { toast } from "sonner";

const PAGE = 25;

type SiteRow = {
  id: string;
  name: string;
  location: string | null;
  is_active: boolean;
  timesheet_pay_format: number | null;
};

type Filter = "all" | "set" | "missing";

export function SiteTimesheetPayFormatPanel({
  clientId,
  organizationId,
}: {
  clientId: string;
  organizationId: string;
}) {
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<SiteRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(q.trim());
      setOffset(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  const load = useCallback(async () => {
    if (!clientId || !organizationId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
        status: "active",
      });
      if (query) params.set("q", query);
      if (filter !== "all") params.set("pay_format", filter);
      const json = await directoryJson<{
        data: SiteRow[];
        count: number | null;
      }>(`/api/directory/clients/${clientId}/branches?${params}`, organizationId);
      setRows(json.data ?? []);
      setCount(json.count ?? json.data?.length ?? 0);
      setDrafts(
        Object.fromEntries(
          (json.data ?? []).map((row) => [
            row.id,
            row.timesheet_pay_format == null ? "" : String(row.timesheet_pay_format),
          ])
        )
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sites");
    } finally {
      setLoading(false);
    }
  }, [clientId, organizationId, offset, query, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(row: SiteRow) {
    const draft = drafts[row.id] ?? "";
    setSavingId(row.id);
    try {
      await directoryJson(
        `/api/directory/clients/${clientId}/branches/${row.id}`,
        organizationId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            timesheet_pay_format: draft === "" ? null : Number(draft),
          }),
        }
      );
      toast.success(`${row.name} pay format saved`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save pay format");
    } finally {
      setSavingId(null);
    }
  }

  const from = count === 0 ? 0 : offset + 1;
  const to = Math.min(offset + rows.length, count);

  return (
    <section className="mt-6 rounded-md border border-border bg-card p-4 shadow-card sm:p-6">
      <h2 className="text-base font-semibold text-foreground">Site pay format</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Each site keeps one timesheet size. A cutoff copies it when timekeeping opens. A site with no format cannot open.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="min-w-[12rem] flex-1 text-sm">
          <span className="mb-1 block text-muted-foreground">Search sites</span>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name or location"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-muted-foreground">Format</span>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as Filter);
              setOffset(0);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sites</SelectItem>
              <SelectItem value="missing">Not set</SelectItem>
              <SelectItem value="set">Set</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      {loading ? (
        <div className="mt-4 h-24 animate-pulse rounded-md bg-muted/50" aria-busy="true" />
      ) : rows.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {query || filter !== "all"
            ? "No sites match this search."
            : "No active sites on this client yet."}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row) => {
            const current = row.timesheet_pay_format == null ? "" : String(row.timesheet_pay_format);
            const draft = drafts[row.id] ?? current;
            const dirty = draft !== current;
            return (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-[10rem] flex-1">
                  <p className="text-sm font-medium text-foreground">{row.name}</p>
                  {row.location ? (
                    <p className="text-xs text-muted-foreground">{row.location}</p>
                  ) : null}
                </div>
                <Select
                  value={draft || "unset"}
                  onValueChange={(value) =>
                    setDrafts((prev) => ({
                      ...prev,
                      [row.id]: value === "unset" ? "" : value,
                    }))
                  }
                >
                  <SelectTrigger className="w-64" aria-label={`Pay format for ${row.name}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">{timesheetPayFormatLabel(null)}</SelectItem>
                    {TIMESHEET_PAY_FORMATS.map((format) => (
                      <SelectItem key={format} value={String(format)}>
                        {timesheetPayFormatLabel(format as TimesheetPayFormat)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  disabled={!dirty || savingId === row.id}
                  onClick={() => void save(row)}
                >
                  {savingId === row.id ? "Saving…" : "Save"}
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Showing {from}–{to} of {count}
        </span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading || offset === 0}
            onClick={() => setOffset((value) => Math.max(0, value - PAGE))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={loading || offset + PAGE >= count}
            onClick={() => setOffset((value) => value + PAGE)}
          >
            Next
          </Button>
        </div>
      </div>
    </section>
  );
}
