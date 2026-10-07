"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { dbPageWrapper, dbTableShell } from "@/lib/dashboard-ui";

const PAGE = 25;

type EventRow = {
  id: string;
  event_type: string;
  producer: string;
  subject: string;
  status: string;
  attempts: number;
  occurred_at: string;
  last_error: string | null;
};

type RolloutRow = {
  id: string;
  client_id: string;
  branch_id: string | null;
  status: string;
  legacy_paths_retired: boolean;
  signed_off_cutoffs: number;
  exit_gate_blockers: string[];
};

export default function PlatformOperationsPage() {
  const [orgId, setOrgId] = useState("");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [eventCount, setEventCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [rollouts, setRollouts] = useState<RolloutRow[]>([]);
  const [rolloutCount, setRolloutCount] = useState(0);
  const [rolloutOffset, setRolloutOffset] = useState(0);
  const [rolloutQ, setRolloutQ] = useState("");
  const [rolloutStatus, setRolloutStatus] = useState("");
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [clientId, setClientId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadDirectoryOrganizations().then((organizations) => {
      const selected = pickDirectoryOrg(organizations, readDirectoryOrgId());
      if (!selected) return setLoading(false);
      writeDirectoryOrgId(selected.id);
      setOrgId(selected.id);
    });
  }, []);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
      });
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const [eventPage, rolloutPage, clientPage] = await Promise.all([
        directoryJson<{
          data: EventRow[];
          count: number;
        }>(`/api/platform/integrations/events?${params}`, orgId),
        directoryJson<{ data: RolloutRow[]; count: number }>(
          `/api/platform/rollouts?${new URLSearchParams({
            limit: String(PAGE),
            offset: String(rolloutOffset),
            ...(rolloutQ.trim() ? { q: rolloutQ.trim() } : {}),
            ...(rolloutStatus ? { status: rolloutStatus } : {}),
          })}`,
          orgId
        ),
        directoryJson<{ data: Array<{ id: string; name: string }> }>(
          "/api/directory/clients?limit=200&offset=0&status=active",
          orgId
        ),
      ]);
      setEvents(eventPage.data);
      setEventCount(eventPage.count);
      setRollouts(rolloutPage.data);
      setRolloutCount(rolloutPage.count);
      setClients(clientPage.data);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Platform data failed");
    } finally {
      setLoading(false);
    }
  }, [offset, orgId, q, rolloutOffset, rolloutQ, rolloutStatus, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function retry(eventId: string) {
    try {
      await directoryJson(
        `/api/platform/integrations/events/${eventId}/retry`,
        orgId,
        { method: "POST" }
      );
      toast.success("Event queued for retry");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Retry failed");
    }
  }

  async function createPilot() {
    if (!clientId) return;
    try {
      await directoryJson("/api/platform/rollouts", orgId, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId }),
      });
      toast.success("Client pilot created");
      setClientId("");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pilot create failed");
    }
  }

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader
          title="Platform operations"
          description="Delivery health, replay, and measured client rollout gates."
        />

        <section className="space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Integration delivery</h2>
              <p className="text-sm text-muted-foreground">
                Failed events stay visible until delivered or reconciled.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                aria-label="Search integration events"
                className="w-64"
                placeholder="Search type or subject"
                value={q}
                onChange={(event) => {
                  setQ(event.target.value);
                  setOffset(0);
                }}
              />
              <select
                aria-label="Integration event status"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setOffset(0);
                }}
              >
                <option value="">All statuses</option>
                {["pending", "delivering", "delivered", "failed", "dead"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </div>
          </div>

          <div className={dbTableShell}>
            <table className="w-full min-w-[820px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Event</th>
                  <th className="px-3 py-2.5 text-center font-medium">Producer</th>
                  <th className="px-3 py-2.5 text-center font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Attempts</th>
                  <th className="w-24 px-3 py-2.5 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="px-3 py-3 text-left">
                      <p className="font-medium">{event.event_type}</p>
                      <p className="text-xs text-muted-foreground">{event.subject}</p>
                    </td>
                    <td className="px-3 py-3 text-center">{event.producer}</td>
                    <td className="px-3 py-3 text-center">
                      <Badge
                        variant={
                          event.status === "delivered"
                            ? "success"
                            : event.status === "dead"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {event.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {event.attempts}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <div className="gp-row-actions inline-flex justify-end">
                        {["failed", "dead"].includes(event.status) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void retry(event.id)}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && events.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      {q || status
                        ? "No events match these filters."
                        : "No integration events are queued."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {eventCount ? offset + 1 : 0}–
              {Math.min(offset + events.length, eventCount)} of {eventCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - PAGE))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={offset + PAGE >= eventCount || loading}
                onClick={() => setOffset(offset + PAGE)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold">Client rollout</h2>
              <p className="text-sm text-muted-foreground">
                Legacy paths cannot retire until coverage, reconciliation, and
                two cutoff sign-offs pass.
              </p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <Input
                aria-label="Search client pilots"
                className="w-56"
                placeholder="Search Client"
                value={rolloutQ}
                onChange={(event) => {
                  setRolloutQ(event.target.value);
                  setRolloutOffset(0);
                }}
              />
              <select
                aria-label="Rollout status"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
                value={rolloutStatus}
                onChange={(event) => {
                  setRolloutStatus(event.target.value);
                  setRolloutOffset(0);
                }}
              >
                <option value="">All statuses</option>
                {["planned", "pilot", "expanded", "retired", "rolled_back"].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
              <select
                aria-label="Client for pilot"
                className="min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              >
                <option value="">Select Client…</option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
              <Button disabled={!clientId} onClick={() => void createPilot()}>
                Start pilot
              </Button>
            </div>
          </div>
          <div className={dbTableShell}>
            <table className="w-full min-w-[680px] text-sm">
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2.5 text-left font-medium">Client</th>
                  <th className="px-3 py-2.5 text-center font-medium">Status</th>
                  <th className="px-3 py-2.5 text-right font-medium">Signed cutoffs</th>
                  <th className="px-3 py-2.5 text-left font-medium">Exit blockers</th>
                </tr>
              </thead>
              <tbody>
                {rollouts.map((rollout) => (
                  <tr key={rollout.id} className="border-b last:border-0">
                    <td className="px-3 py-3">
                      {clients.find((client) => client.id === rollout.client_id)
                        ?.name ?? rollout.client_id}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <Badge variant={rollout.legacy_paths_retired ? "success" : "secondary"}>
                        {rollout.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {rollout.signed_off_cutoffs}
                    </td>
                    <td className="px-3 py-3 text-muted-foreground">
                      {rollout.exit_gate_blockers.length
                        ? rollout.exit_gate_blockers.join(", ")
                        : "None recorded"}
                    </td>
                  </tr>
                ))}
                {!loading && rollouts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                      No client pilots yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Showing {rolloutCount ? rolloutOffset + 1 : 0}–
              {Math.min(rolloutOffset + rollouts.length, rolloutCount)} of{" "}
              {rolloutCount}
            </span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={rolloutOffset === 0 || loading}
                onClick={() =>
                  setRolloutOffset(Math.max(0, rolloutOffset - PAGE))
                }
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={rolloutOffset + PAGE >= rolloutCount || loading}
                onClick={() => setRolloutOffset(rolloutOffset + PAGE)}
              >
                Next
              </Button>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
