"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Caption } from "@/components/ui/typography";
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { directoryJson } from "@/lib/directory/browser";
import {
  DIRECTORY_CHILD_SHEETS,
  type ChildSheetKey,
} from "@/lib/directory/child-sheets";
import { useUserRole } from "@/lib/hooks/useUserRole";

type Props = {
  organizationId: string;
  employeeId: string;
  sheetKey: ChildSheetKey;
  rows: Array<Record<string, unknown>>;
  onChanged: () => void;
};

function dash(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function emptyForm(sheetKey: ChildSheetKey): Record<string, string> {
  const config = DIRECTORY_CHILD_SHEETS[sheetKey];
  return Object.fromEntries(config.fields.map((f) => [f.key, ""]));
}

function rowToForm(
  sheetKey: ChildSheetKey,
  row: Record<string, unknown>
): Record<string, string> {
  const config = DIRECTORY_CHILD_SHEETS[sheetKey];
  const out: Record<string, string> = {};
  for (const field of config.fields) {
    const val = row[field.key];
    out[field.key] =
      val === null || val === undefined ? "" : String(val);
  }
  return out;
}

export function DirectoryChildSheetPanel({
  organizationId,
  employeeId,
  sheetKey,
  rows,
  onChanged,
}: Props) {
  const config = DIRECTORY_CHILD_SHEETS[sheetKey];
  const { isAdmin, isHR } = useUserRole();
  const canEdit = isAdmin || isHR;
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() =>
    emptyForm(sheetKey)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const basePath = `/api/directory/employees/${employeeId}/sheets/${sheetKey}`;

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm(sheetKey));
    setError(null);
    setOpen(true);
  }

  function openEdit(row: Record<string, unknown>) {
    setEditingId(String(row.id));
    setForm(rowToForm(sheetKey, row));
    setError(null);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    for (const field of config.fields) {
      payload[field.key] = form[field.key] ?? "";
    }

    try {
      if (editingId) {
        await directoryJson(`${basePath}/${editingId}`, organizationId, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await directoryJson(basePath, organizationId, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(rowId: string) {
    if (!window.confirm(`Remove this ${config.title.slice(0, -1).toLowerCase()} row?`)) {
      return;
    }
    setDeletingId(rowId);
    setError(null);
    try {
      await directoryJson(`${basePath}/${rowId}`, organizationId, {
        method: "DELETE",
      });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <HStack justify="between" align="center" className="flex-wrap gap-2">
        <Caption className="text-muted-foreground">{config.description}</Caption>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
            Add row
          </Button>
        ) : null}
      </HStack>

      {error && !open ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!rows.length ? (
        <p className="text-sm text-muted-foreground">
          No {config.title.toLowerCase()} on file yet.
          {canEdit ? " Use Add row to create one." : null}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row, i) => (
            <div
              key={String(row.id ?? i)}
              className="grid gap-4 border-b border-border/70 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-2"
            >
              {config.columns.map((col) => (
                <div key={col.key}>
                  <Caption className="text-muted-foreground">{col.label}</Caption>
                  <p className="mt-0.5 text-sm text-foreground">
                    {dash(row[col.key])}
                  </p>
                </div>
              ))}
              {canEdit ? (
                <HStack gap="2" className="sm:col-span-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEdit(row)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={deletingId === String(row.id)}
                    onClick={() => void remove(String(row.id))}
                  >
                    {deletingId === String(row.id) ? "Removing…" : "Remove"}
                  </Button>
                </HStack>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? `Edit ${config.title.slice(0, -1)}` : `Add ${config.title.slice(0, -1)}`}
            </DialogTitle>
            <DialogDescription>
              Saved to this employee&apos;s Directory 201 file only.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3 max-h-[50vh] overflow-y-auto pr-1">
            {config.fields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`sheet-${sheetKey}-${field.key}`}>
                  {field.label}
                  {"required" in field && field.required ? " *" : ""}
                </Label>
                {"type" in field && field.type === "textarea" ? (
                  <Textarea
                    id={`sheet-${sheetKey}-${field.key}`}
                    value={form[field.key] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                  />
                ) : (
                  <Input
                    id={`sheet-${sheetKey}-${field.key}`}
                    type={"type" in field && field.type === "date" ? "date" : "text"}
                    value={form[field.key] ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, [field.key]: e.target.value }))
                    }
                  />
                )}
              </div>
            ))}
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
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
