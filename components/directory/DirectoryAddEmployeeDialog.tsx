"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import {
  EMPLOYEE_STATUSES,
  directoryStatusMeta,
} from "@/lib/directory/employees";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";

type Option = { id: string; label: string };

type MatchRow = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  is_current_engagement?: boolean;
};

type Props = {
  organizationId: string;
  clientId: string;
  clientName: string;
  onCreated?: () => void;
  triggerClassName?: string;
};

function namesMatch(a: MatchRow, last: string, first: string) {
  return (
    a.last_name.trim().toLowerCase() === last &&
    a.first_name.trim().toLowerCase() === first
  );
}

export function DirectoryAddEmployeeDialog({
  organizationId,
  clientId,
  clientName,
  onCreated,
  triggerClassName,
}: Props) {
  const router = useRouter();
  const { isAdmin, isHR } = useUserRole();
  const canCreate = isAdmin || isHR;
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [forceCreate, setForceCreate] = useState(false);
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    middle_name: "",
    employee_code: "",
    mobile: "",
    email: "",
    hire_date: "",
    status: "active",
    branch_id: "",
    position_id: "",
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      try {
        const [branchJson, positionJson] = await Promise.all([
          directoryJson<{ data: Array<{ id: string; name: string }> }>(
            `/api/directory/clients/${clientId}/branches`,
            organizationId
          ),
          directoryJson<{
            data: Array<{ id: string; job_title: string }>;
          }>(
            `/api/directory/positions?client_id=${encodeURIComponent(clientId)}`,
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
  }, [open, clientId, organizationId]);

  if (!canCreate) return null;

  function reset() {
    setForm({
      last_name: "",
      first_name: "",
      middle_name: "",
      employee_code: "",
      mobile: "",
      email: "",
      hire_date: "",
      status: "active",
      branch_id: "",
      position_id: "",
    });
    setError(null);
    setMatches([]);
    setForceCreate(false);
  }

  async function findNameMatches(last: string, first: string) {
    const json = await directoryJson<{ data: MatchRow[] }>(
      `/api/directory/employees?${new URLSearchParams({
        client_id: clientId,
        q: last,
        limit: "25",
        include_history: "true",
      })}`,
      organizationId
    );
    return (json.data ?? []).filter((row) => namesMatch(row, last, first));
  }

  async function submit() {
    const last = form.last_name.trim();
    const first = form.first_name.trim();
    if (!last || !first) {
      setError("Last name and first name are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (!forceCreate) {
        const found = await findNameMatches(last.toLowerCase(), first.toLowerCase());
        if (found.length > 0) {
          setMatches(found);
          setError(
            "Possible existing person found. Open their 201 and use Rehire if they are returning — do not create a duplicate."
          );
          setSaving(false);
          return;
        }
      }

      const json = await directoryJson<{ data: { id: string } }>(
        "/api/directory/employees",
        organizationId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            last_name: last,
            first_name: first,
            middle_name: form.middle_name.trim() || null,
            employee_code: form.employee_code.trim() || null,
            mobile: form.mobile.trim() || null,
            email: form.email.trim() || null,
            hire_date: form.hire_date || null,
            status: form.status,
            branch_id: form.branch_id || null,
            position_id: form.position_id || null,
          }),
        }
      );
      setOpen(false);
      reset();
      onCreated?.();
      router.push(`/directory/c/${clientId}/${json.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        size="sm"
        className={cn(triggerClassName)}
        onClick={() => setOpen(true)}
      >
        <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
        Add employee
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add employee</DialogTitle>
            <DialogDescription>
              New hire on {clientName}. Returning staff: use Rehire. Blank ID →
              YYYYMM-#####.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {matches.length > 0 ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">Matches on this client</p>
              <ul className="space-y-1.5">
                {matches.slice(0, 5).map((row) => (
                  <li key={row.id} className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/directory/c/${clientId}/${row.id}`}
                      className="font-medium underline underline-offset-2"
                      onClick={() => setOpen(false)}
                    >
                      {row.last_name}, {row.first_name}
                      {row.employee_code ? ` · ${row.employee_code}` : ""}
                    </Link>
                    <span className="text-xs">
                      {directoryStatusMeta(row.status).label}
                      {row.is_current_engagement === false ? " · superseded" : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <label className="flex items-start gap-2 pt-1 text-xs">
                <input
                  type="checkbox"
                  className="mt-0.5 size-4 rounded border-border"
                  checked={forceCreate}
                  onChange={(e) => setForceCreate(e.target.checked)}
                />
                I confirm this is a different person
              </label>
            </div>
          ) : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="dir-add-last">Last name *</Label>
              <Input
                id="dir-add-last"
                value={form.last_name}
                onChange={(e) => {
                  setMatches([]);
                  setForceCreate(false);
                  setForm((f) => ({ ...f, last_name: e.target.value }));
                }}
                autoComplete="family-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-first">First name *</Label>
              <Input
                id="dir-add-first"
                value={form.first_name}
                onChange={(e) => {
                  setMatches([]);
                  setForceCreate(false);
                  setForm((f) => ({ ...f, first_name: e.target.value }));
                }}
                autoComplete="given-name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-middle">Middle name</Label>
              <Input
                id="dir-add-middle"
                value={form.middle_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, middle_name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-code">Employee ID (optional)</Label>
              <Input
                id="dir-add-code"
                value={form.employee_code}
                onChange={(e) =>
                  setForm((f) => ({ ...f, employee_code: e.target.value }))
                }
                placeholder="Auto: 202601-00001"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-mobile">Mobile</Label>
              <Input
                id="dir-add-mobile"
                value={form.mobile}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mobile: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-email">Email</Label>
              <Input
                id="dir-add-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dir-add-hire">Hire date</Label>
              <Input
                id="dir-add-hire"
                type="date"
                value={form.hire_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, hire_date: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {directoryStatusMeta(status).label}
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
              disabled={saving || (matches.length > 0 && !forceCreate)}
              onClick={() => void submit()}
            >
              {saving ? "Creating…" : "Create & open 201"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
