"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Caption } from "@/components/ui/typography";
import { directoryJson } from "@/lib/directory/browser";
import {
  compute201Completeness,
  type CompletenessItem,
  type CompletenessReport,
} from "@/lib/directory/completeness";
import { directoryStatusMeta } from "@/lib/directory/employees";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { cn } from "@/lib/utils";

type Movement = {
  id?: string;
  date_from?: string | null;
  date_to?: string | null;
  status?: string | null;
  position?: string | null;
  remarks?: string | null;
  created_at?: string | null;
};

export type CompletenessEditGroup =
  | "identity"
  | "government"
  | "assignment"
  | "pay";

type EmployeeLike = {
  id: string;
  status: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  first_hire_date?: string | null;
  resign_date?: string | null;
  sex?: string | null;
  tin?: string | null;
  sss_number?: string | null;
  philhealth_number?: string | null;
  pagibig_number?: string | null;
  client_id?: string | null;
  position_id?: string | null;
  daily_rate?: number | string | null;
  bank_account_no?: string | null;
  gcash?: string | null;
  pay_through?: string | null;
  mobile?: string | null;
  last_payroll_end?: string | null;
  client_latest_payroll_end?: string | null;
  needs_review?: boolean;
  lifecycle_flag?: string;
  lifecycle_hint?: string;
  is_current_engagement?: boolean;
};

type LifecycleAction =
  | "start_final_pay"
  | "complete_final_pay"
  | "mark_inactive"
  | "set_float"
  | "set_barred"
  | "set_for_verification"
  | "activate";

type Props = {
  organizationId: string;
  employee: EmployeeLike;
  movements: Movement[];
  onChanged: () => void;
  onEditCompleteness?: (group: CompletenessEditGroup) => void;
};

const MOVEMENT_LABELS: Record<string, string> = {
  FOR_RELEASE: "For release",
  FINAL_PAY_COMPLETED: "Final pay completed",
  MARK_INACTIVE: "Marked inactive",
  INACTIVE: "Inactive",
  FLOAT: "Float",
  BARRED: "Barred",
  FOR_VERIFICATION: "For verification",
  ACTIVATE: "Activated",
  ACTIVATED: "Activated",
  TRANSFERRED: "Transferred",
  REHIRE: "Rehired",
  REHIRED: "Rehired",
  HIRE: "Hired",
  HIRED: "Hired",
  PRIOR_ENGAGEMENT: "Prior engagement",
};

const ACTION_META: Record<
  LifecycleAction,
  { label: string; description: string; destructive?: boolean; remarksRequired?: boolean }
> = {
  start_final_pay: {
    label: "Start final pay",
    description:
      "Sets status to For release. Person may still appear on one final payroll. Employee ID stays the same.",
  },
  complete_final_pay: {
    label: "Complete final pay",
    description:
      "Sets status to Inactive after final pay. Exclude from future payroll. Use Rehire to return later.",
    destructive: true,
  },
  mark_inactive: {
    label: "Mark inactive",
    description:
      "Separates this person immediately (no final-pay queue). Excluded from payroll. Prefer Start final pay when a last pay is still due.",
    destructive: true,
    remarksRequired: true,
  },
  set_float: {
    label: "Move to float",
    description:
      "Between assignments / on leave path. Not on a client deployment roster until Activated again.",
  },
  set_barred: {
    label: "Bar from deployment",
    description:
      "Blocks deployment and payroll. Requires a clear reason for audit.",
    destructive: true,
    remarksRequired: true,
  },
  set_for_verification: {
    label: "Send to verification",
    description:
      "Holds the person pending HR verification before full activation.",
  },
  activate: {
    label: "Return to active",
    description:
      "Clears float, barred, verification, or cancels an in-progress release. Person is Active again.",
  },
};

function formatDay(value: string | null | undefined) {
  if (!value) return "—";
  try {
    return format(parseISO(value.slice(0, 10)), "MMM d, yyyy");
  } catch {
    return value;
  }
}

function humanizeMovement(status: string | null | undefined) {
  if (!status) return "Movement";
  const key = status.trim().toUpperCase().replace(/\s+/g, "_");
  if (MOVEMENT_LABELS[key]) return MOVEMENT_LABELS[key];
  return status
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function DirectoryLifecyclePanel({
  organizationId,
  employee,
  movements,
  onChanged,
  onEditCompleteness,
}: Props) {
  const { isAdmin, isHR } = useUserRole();
  const canAct = (isAdmin || isHR) && employee.is_current_engagement !== false;
  const completeness = useMemo(
    () => compute201Completeness(employee),
    [employee]
  );
  const meta = directoryStatusMeta(employee.status);
  const needsReview =
    employee.needs_review === true ||
    employee.lifecycle_flag === "needs_review";

  const [dialog, setDialog] = useState<LifecycleAction | null>(null);
  const [resignDate, setResignDate] = useState(
    () => new Date().toISOString().slice(0, 10)
  );
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeline = [...movements].sort((a, b) => {
    const ad = String(a.date_from ?? a.created_at ?? "");
    const bd = String(b.date_from ?? b.created_at ?? "");
    return bd.localeCompare(ad);
  });

  function openAction(action: LifecycleAction) {
    setDialog(action);
    setError(null);
    setRemarks("");
    setResignDate(new Date().toISOString().slice(0, 10));
  }

  async function runAction() {
    if (!dialog) return;
    const metaAction = ACTION_META[dialog];
    if (metaAction.remarksRequired && !remarks.trim()) {
      setError("Remarks are required for this action");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employee.id}/lifecycle`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: dialog,
            resign_date:
              dialog === "start_final_pay" ||
              dialog === "complete_final_pay" ||
              dialog === "mark_inactive"
                ? resignDate
                : null,
            remarks: remarks.trim() || null,
          }),
        }
      );
      toast.success(metaAction.label);
      setDialog(null);
      onChanged();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  function confirmStillWorking() {
    toast.success("Kept active — confirm on the next released payroll");
  }

  const dialogMeta = dialog ? ACTION_META[dialog] : null;

  return (
    <div className="space-y-4">
      <section className="rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-foreground">
              Lifecycle
            </h2>
            <p className="mt-1 max-w-prose text-sm text-muted-foreground">
              {meta.short} {meta.payroll}
            </p>
          </div>
          <div className="text-right">
            <Caption className="text-muted-foreground">Last payroll</Caption>
            <p className="text-sm font-medium tabular-nums text-foreground">
              {formatDay(employee.last_payroll_end)}
            </p>
            {employee.client_latest_payroll_end ? (
              <Caption className="mt-1 block text-muted-foreground">
                Client latest {formatDay(employee.client_latest_payroll_end)}
              </Caption>
            ) : null}
          </div>
        </div>

        {needsReview && canAct ? (
          <div
            className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 sm:p-4"
            role="region"
            aria-label="Needs review decisions"
          >
            <p className="text-sm font-semibold text-amber-950">Needs review</p>
            <p className="mt-1 text-sm text-amber-950/80">
              {employee.lifecycle_hint ??
                "Marked active but missing from this client’s latest released cutoff. Confirm still working, leave, or resign."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="min-h-10"
                onClick={confirmStillWorking}
              >
                Still working
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 border-amber-300 bg-background"
                onClick={() => openAction("set_float")}
              >
                Leave / float
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 border-amber-300 bg-background"
                onClick={() => openAction("start_final_pay")}
              >
                Start final pay
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="min-h-10"
                onClick={() => openAction("mark_inactive")}
              >
                Mark inactive
              </Button>
            </div>
          </div>
        ) : null}

        {canAct ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {employee.status === "active" || employee.status === "float" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("start_final_pay")}
              >
                Start final pay
              </Button>
            ) : null}
            {employee.status === "for_release" ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="min-h-10 sm:min-h-9"
                  onClick={() => openAction("complete_final_pay")}
                >
                  Complete final pay
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 sm:min-h-9"
                  onClick={() => openAction("activate")}
                >
                  Cancel release (stay active)
                </Button>
              </>
            ) : null}
            {employee.status === "active" && !needsReview ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("set_float")}
              >
                Move to float
              </Button>
            ) : null}
            {employee.status !== "barred" && employee.status !== "inactive" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("set_barred")}
              >
                Bar from deployment
              </Button>
            ) : null}
            {employee.status !== "for_verification" &&
            employee.status !== "inactive" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("set_for_verification")}
              >
                For verification
              </Button>
            ) : null}
            {(employee.status === "float" ||
              employee.status === "for_verification" ||
              employee.status === "barred") && (
              <Button
                type="button"
                size="sm"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("activate")}
              >
                Activate
              </Button>
            )}
            {employee.status !== "inactive" &&
            employee.status !== "for_release" &&
            !needsReview ? (
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="min-h-10 sm:min-h-9"
                onClick={() => openAction("mark_inactive")}
              >
                Mark inactive
              </Button>
            ) : null}
          </div>
        ) : null}

        {employee.status === "inactive" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Returnees use{" "}
            <span className="font-medium text-foreground">Rehire</span> — same
            Employee ID, new engagement on a client.
          </p>
        ) : employee.status === "float" ||
          employee.status === "barred" ||
          employee.status === "for_verification" ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Use <span className="font-medium text-foreground">Activate</span> to
            return to Active. Rehire is only for Inactive people.
          </p>
        ) : null}
      </section>

      <CompletenessCard
        report={completeness}
        onEditGroup={onEditCompleteness}
      />

      <section className="rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          Engagement timeline
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Hire, transfer, rehire, and status changes for this person.
        </p>
        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No movements yet. Transfers, rehires, and lifecycle actions appear
            here.
          </p>
        ) : (
          <ol className="relative mt-4 space-y-0 border-l border-border pl-4">
            {timeline.slice(0, 12).map((row, index) => (
              <li
                key={row.id ?? `${row.date_from}-${index}`}
                className="pb-4 last:pb-0"
              >
                <span
                  className="absolute -left-1.5 mt-1.5 size-3 rounded-full border border-border bg-background"
                  aria-hidden
                />
                <p className="text-sm font-medium text-foreground">
                  {humanizeMovement(row.status)}
                </p>
                <Caption className="text-muted-foreground">
                  {formatDay(row.date_from ?? row.created_at)}
                  {row.position ? ` · ${row.position}` : ""}
                </Caption>
                {row.remarks ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {row.remarks}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        {timeline.length > 12 ? (
          <Caption className="mt-2 block text-muted-foreground">
            Showing latest 12 of {timeline.length}. Full list is under the
            Movements tab.
          </Caption>
        ) : null}
      </section>

      <Dialog
        open={dialog != null}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMeta?.label ?? "Lifecycle"}</DialogTitle>
            <DialogDescription>
              {dialogMeta?.description ??
                "Writes a movement on this person. Employee ID stays the same."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {dialog === "start_final_pay" ||
            dialog === "complete_final_pay" ||
            dialog === "mark_inactive" ? (
              <div className="space-y-1.5">
                <Label htmlFor="life-resign">Resign / effective date</Label>
                <Input
                  id="life-resign"
                  type="date"
                  value={resignDate}
                  onChange={(e) => setResignDate(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-1.5">
              <Label htmlFor="life-remarks">
                Remarks
                {dialogMeta?.remarksRequired ? (
                  <span className="text-destructive"> *</span>
                ) : null}
              </Label>
              <Input
                id="life-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder={
                  dialogMeta?.remarksRequired
                    ? "Required note for the timeline"
                    : "Optional note for the timeline"
                }
                required={dialogMeta?.remarksRequired}
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={dialogMeta?.destructive ? "destructive" : "default"}
              onClick={() => void runAction()}
              disabled={saving}
            >
              {saving ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CompletenessCard({
  report,
  onEditGroup,
}: {
  report: CompletenessReport;
  onEditGroup?: (group: CompletenessEditGroup) => void;
}) {
  const pct = Math.round((report.score / report.total) * 100);
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            201 completeness
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.ready_for_payroll
              ? "Ready for remittance fields and payroll setup."
              : "Fill government IDs, assignment, and pay channel before remittance."}
          </p>
        </div>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {report.score}/{report.total} · {pct}%
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="201 completeness"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            report.ready_for_payroll ? "bg-primary" : "bg-amber-600"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      {report.missing.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {report.missing.map((item: CompletenessItem) => (
            <li key={item.key}>
              {onEditGroup ? (
                <button
                  type="button"
                  onClick={() => onEditGroup(item.group)}
                  className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950 underline-offset-2 hover:underline"
                >
                  Missing {item.label}
                </button>
              ) : (
                <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-950">
                  Missing {item.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          All checklist fields present.
        </p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        {onEditGroup
          ? "Click a missing chip to open Edit on that section."
          : "Use Edit on this 201 to fill gaps."}
      </p>
    </section>
  );
}
