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
import { directoryJson } from "@/lib/directory/browser";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Option = { id: string; label: string };

type Props = {
  organizationId: string;
  employeeId: string;
  employeeCode: string | null;
  currentClientId: string | null;
  currentClientName: string | null;
  status: string;
  onTransferred: (nextClientId: string) => void;
  triggerClassName?: string;
};

export function DirectoryTransferDialog({
  organizationId,
  employeeId,
  employeeCode,
  currentClientId,
  currentClientName,
  status,
  onTransferred,
  triggerClassName,
}: Props) {
  const { isAdmin, isHR } = useUserRole();
  const canTransfer =
    (isAdmin || isHR) &&
    status !== "inactive" &&
    status !== "barred";
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [form, setForm] = useState({
    client_id: "",
    branch_id: "",
    position_id: "",
    effective_date: new Date().toISOString().slice(0, 10),
    remarks: "",
  });

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm({
      client_id: "",
      branch_id: "",
      position_id: "",
      effective_date: new Date().toISOString().slice(0, 10),
      remarks: "",
    });
    void (async () => {
      try {
        const json = await directoryJson<{
          data: Array<{ id: string; name: string; status: string }>;
        }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: "200",
            status: "active",
          })}`,
          organizationId
        );
        setClients(
          (json.data ?? [])
            .filter((c) => c.id !== currentClientId)
            .map((c) => ({ id: c.id, label: c.name }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load clients");
      }
    })();
  }, [open, organizationId, currentClientId]);

  useEffect(() => {
    if (!open || !form.client_id) {
      setBranches([]);
      setPositions([]);
      return;
    }
    void (async () => {
      try {
        const [br, pos] = await Promise.all([
          directoryJson<{ data: Array<{ id: string; name: string }> }>(
            `/api/directory/clients/${form.client_id}/branches`,
            organizationId
          ),
          directoryJson<{
            data: Array<{ id: string; job_title: string }>;
          }>(
            `/api/directory/positions?${new URLSearchParams({
              client_id: form.client_id,
              limit: "200",
            })}`,
            organizationId
          ),
        ]);
        setBranches(
          (br.data ?? []).map((b) => ({ id: b.id, label: b.name }))
        );
        setPositions(
          (pos.data ?? []).map((p) => ({
            id: p.id,
            label: p.job_title,
          }))
        );
      } catch {
        setBranches([]);
        setPositions([]);
      }
    })();
  }, [open, form.client_id, organizationId]);

  if (!canTransfer) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_id) {
      setError("Select the destination client");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/transfer`,
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: form.client_id,
            branch_id: form.branch_id || null,
            position_id: form.position_id || null,
            effective_date: form.effective_date,
            remarks: form.remarks || null,
          }),
        }
      );
      setOpen(false);
      toast.success("Transferred — same Employee ID");
      onTransferred(form.client_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Transfer failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        className={cn(triggerClassName)}
        onClick={() => setOpen(true)}
      >
        Transfer client
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Transfer to another client</DialogTitle>
            <DialogDescription>
              Same person and Employee ID
              {employeeCode ? ` (${employeeCode})` : ""}. Moves the current
              engagement from {currentClientName ?? "this client"} — does not
              create a second 201.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="xfer-client">Destination client</Label>
              <Select
                value={form.client_id || undefined}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    client_id: v,
                    branch_id: "",
                    position_id: "",
                  }))
                }
              >
                <SelectTrigger id="xfer-client">
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xfer-date">Effective date</Label>
              <Input
                id="xfer-date"
                type="date"
                required
                value={form.effective_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, effective_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Branch (optional)</Label>
              <Select
                value={form.branch_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    branch_id: v === "none" ? "" : v,
                  }))
                }
                disabled={!form.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {branches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Position (optional)</Label>
              <Select
                value={form.position_id || "none"}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    position_id: v === "none" ? "" : v,
                  }))
                }
                disabled={!form.client_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {positions.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="xfer-remarks">Remarks</Label>
              <Input
                id="xfer-remarks"
                value={form.remarks}
                onChange={(e) =>
                  setForm((f) => ({ ...f, remarks: e.target.value }))
                }
                placeholder="Optional note"
              />
            </div>
            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Transferring…" : "Confirm transfer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
