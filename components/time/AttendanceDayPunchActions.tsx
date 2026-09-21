"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildApproveUpdate,
  buildRejectUpdate,
} from "@/lib/timekeeping/clock-entry-edits";
import {
  punchEntryPlaceLabel,
  punchEntryStatusLabel,
  punchHoursLabel,
} from "@/lib/timekeeping/attendance-card";
import { clockSourceLabel } from "@/lib/timekeeping/zkteco-attlog";
import {
  resolveLocationDetails,
  type OfficeLocation,
} from "@/lib/location";

export type DayPunch = {
  id: string;
  clockInTime: string;
  clockOutTime: string | null;
  status: string;
  regularHours?: number | null;
  totalHours?: number | null;
  clockInDevice?: string | null;
  clockOutDevice?: string | null;
  clockInLocation?: string | null;
  clockOutLocation?: string | null;
  isManualEntry?: boolean;
};

function punchTimeLabel(punch: DayPunch): string {
  const inn = format(new Date(punch.clockInTime), "MMM d, h:mm a");
  const out = punch.clockOutTime
    ? format(new Date(punch.clockOutTime), "h:mm a")
    : "no clock out";
  return `${inn} – ${out}`;
}

function punchStatusTone(statusLabel: string): string {
  switch (statusLabel) {
    case "Incomplete":
      return "bg-orange-100 text-orange-800 border-orange-200";
    case "Needs review":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "Approved":
    case "Auto approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "Rejected":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-muted text-foreground border-border";
  }
}

function GpsLine({
  label,
  location,
  officeLocations,
}: {
  label?: string;
  location: string | null | undefined;
  officeLocations: OfficeLocation[];
}) {
  const details = resolveLocationDetails(location ?? null, officeLocations);
  const place = punchEntryPlaceLabel(details);
  if (!place) return null;

  return (
    <p className="mt-0.5 min-w-0 truncate text-[11px] text-muted-foreground">
      {label ? <span className="font-medium text-foreground/70">{label} </span> : null}
      <span title={place}>{place}</span>
    </p>
  );
}

function PunchEntryCard({
  punch,
  officeLocations,
}: {
  punch: DayPunch;
  officeLocations: OfficeLocation[];
}) {
  const statusLabel = punchEntryStatusLabel(punch);
  const hours = punchHoursLabel({
    regularHours: punch.regularHours ?? null,
    totalHours: punch.totalHours ?? null,
  });
  const source = clockSourceLabel(punch.clockInDevice, punch.isManualEntry ?? false);
  const inDetails = resolveLocationDetails(punch.clockInLocation ?? null, officeLocations);
  const outDetails = punch.clockOutTime
    ? resolveLocationDetails(punch.clockOutLocation ?? null, officeLocations)
    : null;
  const samePlace =
    !outDetails ||
    (inDetails.name === outDetails.name &&
      inDetails.coordinates === outDetails.coordinates);

  return (
    <div className="min-w-0 text-left">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-medium tabular-nums tracking-tight">
          {format(new Date(punch.clockInTime), "h:mm a")}
          <span className="mx-1 text-muted-foreground">–</span>
          {punch.clockOutTime
            ? format(new Date(punch.clockOutTime), "h:mm a")
            : "open"}
        </p>
        <span
          className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${punchStatusTone(statusLabel)}`}
        >
          {statusLabel}
        </span>
        {hours ? (
          <span className="text-[11px] tabular-nums text-muted-foreground">{hours}</span>
        ) : null}
        {source ? (
          <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium">
            {source}
          </Badge>
        ) : null}
      </div>
      {samePlace || !punch.clockOutTime ? (
        <GpsLine location={punch.clockInLocation} officeLocations={officeLocations} />
      ) : (
        <>
          <GpsLine
            label="In"
            location={punch.clockInLocation}
            officeLocations={officeLocations}
          />
          <GpsLine
            label="Out"
            location={punch.clockOutLocation}
            officeLocations={officeLocations}
          />
        </>
      )}
    </div>
  );
}

export function AttendanceDayPunchActions({
  date,
  punches,
  canReview,
  officeLocations = [],
  onChanged,
}: {
  date: string;
  punches: DayPunch[];
  canReview: boolean;
  officeLocations?: OfficeLocation[];
  onChanged: () => void;
}) {
  const supabase = createClient();
  const reviewable = punches.filter((punch) => punch.status === "clocked_out");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const active =
    punches.find((punch) => punch.id === activeId) ?? reviewable[0] ?? punches[0] ?? null;

  function openReview() {
    const first = reviewable[0];
    setActiveId(first?.id ?? null);
    setNotes("");
    setReviewOpen(true);
  }

  async function approve() {
    if (!active) return;
    setSaving(true);
    const { error } = await (supabase.from("time_clock_entries") as any)
      .update(buildApproveUpdate(notes))
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to approve entry");
      return;
    }
    toast.success("Time entry approved successfully!", {
      description: "Entry has been verified and approved",
    });
    setReviewOpen(false);
    onChanged();
  }

  async function reject() {
    if (!active) return;
    const built = buildRejectUpdate(notes);
    if ("error" in built) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    const { error } = await (supabase.from("time_clock_entries") as any)
      .update(built.update)
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to reject entry");
      return;
    }
    toast.success("Time entry rejected", {
      description: "The entry has been declined",
    });
    setReviewOpen(false);
    onChanged();
  }

  const hasActions = canReview && reviewable.length > 0;

  if (punches.length === 0 && !hasActions) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <>
      <div className="flex min-w-[16rem] max-w-md flex-col gap-2">
        {punches.length > 0 ? (
          <ul className="space-y-3">
            {punches.map((punch) => (
              <li key={punch.id}>
                <PunchEntryCard punch={punch} officeLocations={officeLocations} />
              </li>
            ))}
          </ul>
        ) : (
          <span className="text-sm text-muted-foreground">No entry</span>
        )}
        {hasActions ? (
          <div className="gp-row-actions flex flex-wrap items-center gap-1">
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={openReview}>
              Review
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review punch</DialogTitle>
            <DialogDescription>
              Approve or reject this clock entry for {date}.
            </DialogDescription>
          </DialogHeader>
          {reviewable.length > 1 ? (
            <div className="flex flex-col gap-1">
              {reviewable.map((punch) => (
                <Button
                  key={punch.id}
                  type="button"
                  variant={punch.id === active?.id ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => setActiveId(punch.id)}
                >
                  {punchTimeLabel(punch)}
                </Button>
              ))}
            </div>
          ) : active ? (
            <p className="text-sm">{punchTimeLabel(active)}</p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`review-notes-${date}`}>Notes</Label>
            <Textarea
              id={`review-notes-${date}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Required if you reject"
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setReviewOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={saving || !active} onClick={reject}>
              Reject
            </Button>
            <Button type="button" disabled={saving || !active} onClick={approve}>
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
