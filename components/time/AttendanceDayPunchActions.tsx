"use client";

import { useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import {
  buildApproveUpdate,
  buildBulkClockInserts,
  buildClockEditUpdate,
  buildManualClockInsert,
  buildRejectUpdate,
  type BulkClockRow,
} from "@/lib/timekeeping/clock-entry-edits";

export type DayPunch = {
  id: string;
  clockInTime: string;
  clockOutTime: string | null;
  status: string;
};

function toDatetimeLocal(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function punchTimeLabel(punch: DayPunch): string {
  const inn = format(new Date(punch.clockInTime), "MMM d, h:mm a");
  const out = punch.clockOutTime
    ? format(new Date(punch.clockOutTime), "h:mm a")
    : "no clock out";
  return `${inn} – ${out}`;
}

export function AttendanceDayPunchActions({
  employeeId,
  date,
  punches,
  canReview,
  canEdit,
  canAdd,
  showAdd,
  editorLabel,
  onRemove,
  onChanged,
}: {
  employeeId: string;
  date: string;
  punches: DayPunch[];
  canReview: boolean;
  canEdit: boolean;
  canAdd: boolean;
  showAdd: boolean;
  editorLabel: string;
  onRemove?: () => void;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const reviewable = punches.filter((punch) => punch.status === "clocked_out");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [saving, setSaving] = useState(false);

  const active =
    punches.find((punch) => punch.id === activeId) ?? reviewable[0] ?? punches[0] ?? null;

  function openReview() {
    const first = reviewable[0];
    setActiveId(first?.id ?? null);
    setNotes("");
    setReviewOpen(true);
  }

  function openEdit() {
    const first = punches[0];
    if (!first) return;
    setActiveId(first.id);
    setClockIn(toDatetimeLocal(first.clockInTime));
    setClockOut(
      first.clockOutTime
        ? toDatetimeLocal(first.clockOutTime)
        : `${date}T17:00`
    );
    setNotes("");
    setEditOpen(true);
  }

  function openAdd() {
    setClockIn(`${date}T08:00`);
    setClockOut(`${date}T17:00`);
    setNotes("");
    setAddOpen(true);
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

  async function saveEdit() {
    if (!active) return;
    const built = buildClockEditUpdate({
      clockIn: new Date(clockIn),
      clockOut: new Date(clockOut),
      hrNotes: notes,
      editorLabel,
    });
    if ("error" in built) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("time_clock_entries")
      .update(built.update)
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error("Failed to update time entry");
      return;
    }
    toast.success("Time entry updated successfully", {
      description: "Clock in/out times have been updated",
    });
    setEditOpen(false);
    onChanged();
  }

  async function saveAdd() {
    const built = buildManualClockInsert({
      employeeId,
      clockIn: new Date(clockIn),
      clockOut: new Date(clockOut),
      notes,
      editorLabel,
    });
    if ("error" in built) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("time_clock_entries").insert(built.row);
    setSaving(false);
    if (error) {
      toast.error("Failed to create time entry: " + error.message);
      return;
    }
    toast.success("Time entry created successfully", {
      description: "New time entry has been added",
    });
    setAddOpen(false);
    onChanged();
  }

  if (
    !(canReview && reviewable.length > 0) &&
    !(canEdit && punches.length > 0) &&
    !(canAdd && showAdd) &&
    !onRemove
  ) {
    return null;
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-end gap-1">
        {canReview && reviewable.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={openReview}>
            Review
          </Button>
        ) : null}
        {canEdit && punches.length > 0 ? (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={openEdit}>
            Edit
          </Button>
        ) : null}
        {canAdd && showAdd ? (
          <Button type="button" variant="ghost" size="sm" className="h-8" onClick={openAdd}>
            Add punch
          </Button>
        ) : null}
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-destructive hover:bg-destructive/10"
            onClick={onRemove}
          >
            <Icon name="TrashSimple" size={IconSizes.sm} className="mr-1" />
            Remove
          </Button>
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

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit punch</DialogTitle>
            <DialogDescription>Clock out must be after clock in.</DialogDescription>
          </DialogHeader>
          {punches.length > 1 ? (
            <div className="flex flex-col gap-1">
              {punches.map((punch) => (
                <Button
                  key={punch.id}
                  type="button"
                  variant={punch.id === activeId ? "secondary" : "ghost"}
                  className="justify-start"
                  onClick={() => {
                    setActiveId(punch.id);
                    setClockIn(toDatetimeLocal(punch.clockInTime));
                    setClockOut(
                      punch.clockOutTime ? toDatetimeLocal(punch.clockOutTime) : `${date}T17:00`
                    );
                  }}
                >
                  {punchTimeLabel(punch)}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`edit-in-${date}`}>Clock in</Label>
              <Input
                id={`edit-in-${date}`}
                type="datetime-local"
                value={clockIn}
                onChange={(event) => setClockIn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edit-out-${date}`}>Clock out</Label>
              <Input
                id={`edit-out-${date}`}
                type="datetime-local"
                value={clockOut}
                onChange={(event) => setClockOut(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-notes-${date}`}>Notes</Label>
            <Textarea
              id={`edit-notes-${date}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={saveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add punch</DialogTitle>
            <DialogDescription>Manual punch for {date}. It is saved as approved.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`add-in-${date}`}>Clock in</Label>
              <Input
                id={`add-in-${date}`}
                type="datetime-local"
                value={clockIn}
                onChange={(event) => setClockIn(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`add-out-${date}`}>Clock out</Label>
              <Input
                id={`add-out-${date}`}
                type="datetime-local"
                value={clockOut}
                onChange={(event) => setClockOut(event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`add-notes-${date}`}>Notes</Label>
            <Textarea
              id={`add-notes-${date}`}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving} onClick={saveAdd}>
              Add punch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const EMPTY_BULK_ROW: BulkClockRow = { date: "", timeIn: "", timeOut: "", notes: "" };

export function AttendanceBulkAddDialog({
  open,
  onOpenChange,
  employeeId,
  editorLabel,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  editorLabel: string;
  onChanged: () => void;
}) {
  const supabase = createClient();
  const [rows, setRows] = useState<BulkClockRow[]>([{ ...EMPTY_BULK_ROW }]);
  const [saving, setSaving] = useState(false);

  function updateRow(index: number, field: keyof BulkClockRow, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row))
    );
  }

  async function save() {
    const built = buildBulkClockInserts({
      employeeId,
      rows,
      editorLabel,
    });
    if ("error" in built) {
      toast.error(built.error);
      return;
    }
    setSaving(true);
    let successCount = 0;
    let failCount = 0;
    for (let index = 0; index < built.rows.length; index += 50) {
      const batch = built.rows.slice(index, index + 50);
      const { data, error } = await supabase.from("time_clock_entries").insert(batch).select("id");
      if (error) failCount += batch.length;
      else successCount += data?.length || 0;
    }
    setSaving(false);
    if (failCount > 0) {
      toast.error(`Failed to create ${failCount} entries`);
      if (successCount > 0) onChanged();
      return;
    }
    toast.success(`Successfully created ${successCount} time entries`, {
      description: `Added ${successCount} entries for the selected employee`,
    });
    setRows([{ ...EMPTY_BULK_ROW }]);
    onOpenChange(false);
    onChanged();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setRows([{ ...EMPTY_BULK_ROW }]);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bulk add punches</DialogTitle>
          <DialogDescription>
            Adds punches for this employee only. Each row is saved as approved.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-2 pr-2 font-medium">Date</th>
                <th className="py-2 pr-2 font-medium">In</th>
                <th className="py-2 pr-2 font-medium">Out</th>
                <th className="py-2 pr-2 font-medium">Notes</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-1 pr-2">
                    <Input
                      type="date"
                      aria-label={`Date ${index + 1}`}
                      value={row.date}
                      onChange={(event) => updateRow(index, "date", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="time"
                      aria-label={`Clock in ${index + 1}`}
                      value={row.timeIn}
                      onChange={(event) => updateRow(index, "timeIn", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      type="time"
                      aria-label={`Clock out ${index + 1}`}
                      value={row.timeOut}
                      onChange={(event) => updateRow(index, "timeOut", event.target.value)}
                    />
                  </td>
                  <td className="py-1 pr-2">
                    <Input
                      aria-label={`Notes ${index + 1}`}
                      value={row.notes}
                      onChange={(event) => updateRow(index, "notes", event.target.value)}
                    />
                  </td>
                  <td className="py-1">
                    {rows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setRows((current) => [...current, { ...EMPTY_BULK_ROW }])}
          >
            Add row
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save punches"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
