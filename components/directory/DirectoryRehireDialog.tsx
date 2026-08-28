"use client";

import { useEffect, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { directoryJson } from "@/lib/directory/browser";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Rel = { id: string; name?: string; job_title?: string } | null;

export type DirectoryRehireEmployee = {
  id: string;
  employee_code: string | null;
  status: string;
  hire_date: string | null;
  first_hire_date?: string | null;
  client_id: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  is_current_engagement?: boolean;
  client: Rel;
  branch: Rel;
  position: Rel;
};

type Option = { id: string; label: string };

type Props = {
  organizationId: string;
  employee: DirectoryRehireEmployee;
  triggerClassName?: string;
  /** When true, show Rehire even if Directory status is already active (office return). */
  forceEligible?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
  onRehired: () => void;
};

export function DirectoryRehireDialog({
  organizationId,
  employee,
  triggerClassName,
  forceEligible = false,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
  onRehired,
}: Props) {
  const { isAdmin, isHR } = useUserRole();
  const canRehire = isAdmin || isHR;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [form, setForm] = useState({
    hire_date: new Date().toISOString().slice(0, 10),
    client_id: employee.client_id ?? "",
    branch_id: employee.branch?.id ?? employee.branch_id ?? "",
    position_id: employee.position?.id ?? employee.position_id ?? "",
    daily_rate: employee.daily_rate != null ? String(employee.daily_rate) : "",
    billing_daily_rate:
      employee.billing_daily_rate != null
        ? String(employee.billing_daily_rate)
        : "",
    remarks: "",
  });

  const eligible =
    canRehire &&
    employee.is_current_engagement !== false &&
    (forceEligible || employee.status === "inactive");

  useEffect(() => {
    if (!open) return;
    setForm({
      hire_date: new Date().toISOString().slice(0, 10),
      client_id: employee.client_id ?? "",
      branch_id: employee.branch?.id ?? employee.branch_id ?? "",
      position_id: employee.position?.id ?? employee.position_id ?? "",
      daily_rate: employee.daily_rate != null ? String(employee.daily_rate) : "",
      billing_daily_rate:
        employee.billing_daily_rate != null
          ? String(employee.billing_daily_rate)
          : "",
      remarks: "",
    });
    setError(null);
  }, [open, employee]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const clientJson = await directoryJson<{
          data: Array<{ id: string; name: string }>;
          count: number;
        }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: "200",
            offset: "0",
            status: "active",
          })}`,
          organizationId
        );
        if (cancelled) return;
        setClients(
          (clientJson.data ?? []).map((row) => ({
            id: row.id,
            label: row.name,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load clients");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId]);

  useEffect(() => {
    if (!open || !form.client_id) {
      setBranches([]);
      setPositions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [branchJson, positionJson] = await Promise.all([
          directoryJson<{ data: Array<{ id: string; name: string }> }>(
            `/api/directory/clients/${form.client_id}/branches`,
            organizationId
          ),
          directoryJson<{
            data: Array<{ id: string; job_title: string }>;
          }>(
            `/api/directory/positions?client_id=${encodeURIComponent(form.client_id)}`,
            organizationId
          ),
        ]);
        if (cancelled) return;
        setBranches(
          (branchJson.data ?? []).map((row) => ({
            id: row.id,
            label: row.name,
          }))
        );
        setPositions(
          (positionJson.data ?? []).map((row) => ({
            id: row.id,
            label: row.job_title,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load options");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, organizationId, form.client_id]);

  // Controlled office flow may mount while role hook is still resolving — keep dialog mounted.
  if (!eligible && !(hideTrigger && open)) return null;

  async function submit() {
    if (!form.hire_date) {
      setError("Hire date is required");
      return;
    }
    if (!form.client_id) {
      setError("Client is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employee.id}/rehire`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hire_date: form.hire_date,
            client_id: form.client_id,
            branch_id: form.branch_id || null,
            position_id: form.position_id || null,
            daily_rate: form.daily_rate.trim() || null,
            billing_daily_rate: form.billing_daily_rate.trim() || null,
            remarks: form.remarks.trim() || null,
            ...(forceEligible ? { force: true } : {}),
          }),
        }
      );
      toast.success("Rehired — same Employee ID");
      setOpen(false);
      onRehired();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rehire failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {hideTrigger ? null : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className={cn(triggerClassName)}
          onClick={() => setOpen(true)}
        >
          <Icon name="ArrowCounterClockwise" size={IconSizes.sm} className="mr-1" />
          Rehire
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Rehire this person</DialogTitle>
            <DialogDescription>
              Updates the existing 201 — status becomes active, hire date and
              assignment refresh. Employee ID{" "}
              <span className="font-mono">
                {employee.employee_code ?? "(none)"}
              </span>{" "}
              stays the same. Do not create a new employee.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rehire-date">New hire date *</Label>
              <Input
                id="rehire-date"
                type="date"
                value={form.hire_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hire_date: e.target.value }))
                }
              />
              {employee.first_hire_date || employee.hire_date ? (
                <p className="text-xs text-muted-foreground">
                  First hire on file:{" "}
                  {employee.first_hire_date ?? employee.hire_date}. That date is
                  kept; only the latest engagement start changes.
                </p>
              ) : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Client *</Label>
              <Select
                value={form.client_id || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    client_id: value === "__none__" ? "" : value,
                    branch_id: "",
                    position_id: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select client</SelectItem>
                  {clients.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Branch</Label>
              <Select
                value={form.branch_id || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    branch_id: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No branch</SelectItem>
                  {branches.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Position</Label>
              <Select
                value={form.position_id || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    position_id: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No position</SelectItem>
                  {positions.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rehire-rate">Daily rate (payroll)</Label>
              <Input
                id="rehire-rate"
                inputMode="decimal"
                value={form.daily_rate}
                onChange={(e) =>
                  setForm((f) => ({ ...f, daily_rate: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rehire-billing">Daily rate (billing)</Label>
              <Input
                id="rehire-billing"
                inputMode="decimal"
                value={form.billing_daily_rate}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    billing_daily_rate: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="rehire-remarks">Remarks</Label>
              <Input
                id="rehire-remarks"
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Optional note for movements"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={saving || !canRehire}
              onClick={() => void submit()}
            >
              {saving ? "Saving…" : "Confirm rehire"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
