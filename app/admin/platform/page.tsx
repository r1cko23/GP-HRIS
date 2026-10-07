"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable } from "@/components/ui/data-table";
import { FilterBar } from "@/components/ui/filter-bar";
import { StatusBadge, type StatusBadgeTone } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { dbPageWrapper } from "@/lib/dashboard-ui";

const PAGE = 25;

const selectClass =
  "min-h-11 rounded-md border border-input bg-background px-3 text-sm sm:min-h-10";

function eventTone(status: string): StatusBadgeTone {
  if (status === "delivered") return "success";
  if (status === "dead") return "danger";
  if (status === "failed") return "warning";
  return "neutral";
}

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

  const rolloutClientName = (clientIdValue: string) =>
    clients.find((client) => client.id === clientIdValue)?.name ??
    clientIdValue;

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <PageHeader
          title="Platform operations"
        />

        <section className="space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div>
            <h2 className="font-semibold">Integration delivery</h2>
            <p className="text-sm text-muted-foreground">
              Failed events stay visible until delivered or reconciled.
            </p>
          </div>
          <DataTable<EventRow>
            rows={events}
            rowKey={(event) => event.id}
            loading={loading && events.length === 0}
            minWidthClassName="min-w-[820px]"
            emptyTitle={
              q || status ? "No events match these filters" : "No integration events queued"
            }
            emptyDetail={
              q || status
                ? "Try a different search or status."
                : "Events appear here when siblings publish to the platform."
            }
            toolbar={
              <FilterBar>
                <Input
                  aria-label="Search integration events"
                  className="w-full sm:w-64"
                  placeholder="Search type or subject"
                  value={q}
                  onChange={(event) => {
                    setQ(event.target.value);
                    setOffset(0);
                  }}
                />
                <select
                  aria-label="Integration event status"
                  className={selectClass}
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
              </FilterBar>
            }
            pagination={{
              showingLabel: `Showing ${eventCount ? offset + 1 : 0}–${Math.min(
                offset + events.length,
                eventCount
              )} of ${eventCount}`,
              previousDisabled: offset === 0 || loading,
              nextDisabled: offset + PAGE >= eventCount || loading,
              onPrevious: () => setOffset(Math.max(0, offset - PAGE)),
              onNext: () => setOffset(offset + PAGE),
            }}
            columns={[
              {
                id: "event",
                header: "Event",
                cell: (event) => (
                  <>
                    <p className="font-medium">{event.event_type}</p>
                    <p className="text-xs text-muted-foreground">
                      {event.subject}
                    </p>
                  </>
                ),
              },
              {
                id: "producer",
                header: "Producer",
                align: "center",
                cell: (event) => event.producer,
              },
              {
                id: "status",
                header: "Status",
                align: "center",
                cell: (event) => (
                  <StatusBadge tone={eventTone(event.status)}>
                    {event.status}
                  </StatusBadge>
                ),
              },
              {
                id: "attempts",
                header: "Attempts",
                align: "right",
                className: "tabular-nums",
                cell: (event) => event.attempts,
              },
              {
                id: "actions",
                header: <span className="sr-only">Actions</span>,
                align: "right",
                headerClassName: "w-24",
                cell: (event) => (
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
                ),
              },
            ]}
          />
        </section>

        <section className="space-y-3 rounded-md border border-border bg-card p-4 shadow-card">
          <div>
            <h2 className="font-semibold">Client rollout</h2>
            <p className="text-sm text-muted-foreground">
              Legacy paths cannot retire until coverage, reconciliation, and
              two cutoff sign-offs pass.
            </p>
          </div>
          <DataTable<RolloutRow>
            rows={rollouts}
            rowKey={(rollout) => rollout.id}
            loading={loading && rollouts.length === 0}
            minWidthClassName="min-w-[680px]"
            emptyTitle={
              rolloutQ || rolloutStatus
                ? "No client pilots match these filters"
                : "No client pilots yet"
            }
            emptyDetail={
              rolloutQ || rolloutStatus
                ? "Try a different search or status."
                : "Select a client and start a pilot."
            }
            toolbar={
              <FilterBar
                trailing={
                  <>
                    <select
                      aria-label="Client for pilot"
                      className={selectClass}
                      value={clientId}
                      onChange={(event) => setClientId(event.target.value)}
                    >
                      <option value="">Select client…</option>
                      {clients.map((client) => (
                        <option key={client.id} value={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                    <Button disabled={!clientId} onClick={() => void createPilot()}>
                      Start pilot
                    </Button>
                  </>
                }
              >
                <Input
                  aria-label="Search client pilots"
                  className="w-full sm:w-56"
                  placeholder="Search client"
                  value={rolloutQ}
                  onChange={(event) => {
                    setRolloutQ(event.target.value);
                    setRolloutOffset(0);
                  }}
                />
                <select
                  aria-label="Rollout status"
                  className={selectClass}
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
              </FilterBar>
            }
            pagination={{
              showingLabel: `Showing ${
                rolloutCount ? rolloutOffset + 1 : 0
              }–${Math.min(
                rolloutOffset + rollouts.length,
                rolloutCount
              )} of ${rolloutCount}`,
              previousDisabled: rolloutOffset === 0 || loading,
              nextDisabled: rolloutOffset + PAGE >= rolloutCount || loading,
              onPrevious: () =>
                setRolloutOffset(Math.max(0, rolloutOffset - PAGE)),
              onNext: () => setRolloutOffset(rolloutOffset + PAGE),
            }}
            columns={[
              {
                id: "client",
                header: "Client",
                cell: (rollout) => rolloutClientName(rollout.client_id),
              },
              {
                id: "status",
                header: "Status",
                align: "center",
                cell: (rollout) => (
                  <StatusBadge
                    tone={rollout.legacy_paths_retired ? "success" : "neutral"}
                  >
                    {rollout.status}
                  </StatusBadge>
                ),
              },
              {
                id: "signed",
                header: "Signed cutoffs",
                align: "right",
                className: "tabular-nums",
                cell: (rollout) => rollout.signed_off_cutoffs,
              },
              {
                id: "blockers",
                header: "Exit blockers",
                className: "text-muted-foreground",
                cell: (rollout) =>
                  rollout.exit_gate_blockers.length
                    ? rollout.exit_gate_blockers.join(", ")
                    : "None recorded",
              },
            ]}
          />
        </section>
      </div>
    </DashboardLayout>
  );
}
