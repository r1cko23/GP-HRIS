"use client";

import { useState } from "react";
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
import { HStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { directoryJson } from "@/lib/directory/browser";
import { dash, formatProseDisplay } from "@/lib/directory/display-value";
import { useUserRole } from "@/lib/hooks/useUserRole";

export type DirectoryContact = {
  id: string;
  name: string | null;
  relationship: string | null;
  phone: string | null;
  mobile: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
};

type FormState = {
  name: string;
  relationship: string;
  phone: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
};

const EMPTY: FormState = {
  name: "",
  relationship: "",
  phone: "",
  mobile: "",
  email: "",
  address: "",
  city: "",
};

type Props = {
  organizationId: string;
  employeeId: string;
  contacts: DirectoryContact[];
  onChanged: () => void;
};

export function DirectoryContactsPanel({
  organizationId,
  employeeId,
  contacts,
  onChanged,
}: Props) {
  const { isAdmin, isHR } = useUserRole();
  const canEdit = isAdmin || isHR;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY);
    setError(null);
    setOpen(true);
  }

  function openEdit(row: DirectoryContact) {
    setEditing(row);
    setForm({
      name: row.name ?? "",
      relationship: row.relationship ?? "",
      phone: row.phone ?? "",
      mobile: row.mobile ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      city: row.city ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      relationship: form.relationship.trim() || null,
      phone: form.phone.trim() || null,
      mobile: form.mobile.trim() || null,
      email: form.email.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
    };
    try {
      if (editing) {
        await directoryJson(
          `/api/directory/employees/${employeeId}/contacts/${editing.id}`,
          organizationId,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      } else {
        await directoryJson(
          `/api/directory/employees/${employeeId}/contacts`,
          organizationId,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
      }
      setOpen(false);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: DirectoryContact) {
    if (
      !window.confirm(
        `Remove contact “${row.name ?? "unnamed"}” from this 201 file?`
      )
    ) {
      return;
    }
    setDeletingId(row.id);
    setError(null);
    try {
      await directoryJson(
        `/api/directory/employees/${employeeId}/contacts/${row.id}`,
        organizationId,
        { method: "DELETE" }
      );
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
        <Caption className="text-muted-foreground">
          Emergency / next-of-kin contacts on this person’s 201.
        </Caption>
        {canEdit ? (
          <Button type="button" size="sm" variant="outline" onClick={openCreate}>
            <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
            Add contact
          </Button>
        ) : null}
      </HStack>

      {error && !open ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      {!contacts.length ? (
        <p className="text-sm text-muted-foreground">
          No contacts on file yet.
          {canEdit ? " Use Add contact to create one." : null}
        </p>
      ) : (
        <div className="space-y-4">
          {contacts.map((row) => (
            <div
              key={row.id}
              className="grid gap-4 border-b border-border/70 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-2"
            >
              <div>
                <Caption className="text-muted-foreground">Name</Caption>
                <p className="mt-0.5 text-sm text-foreground">{formatProseDisplay(row.name)}</p>
              </div>
              <div>
                <Caption className="text-muted-foreground">Relationship</Caption>
                <p className="mt-0.5 text-sm text-foreground">
                  {formatProseDisplay(row.relationship)}
                </p>
              </div>
              <div>
                <Caption className="text-muted-foreground">Mobile</Caption>
                <p className="mt-0.5 text-sm text-foreground">
                  {dash(row.mobile ?? row.phone)}
                </p>
              </div>
              <div>
                <Caption className="text-muted-foreground">Email</Caption>
                <p className="mt-0.5 text-sm text-foreground">{dash(row.email)}</p>
              </div>
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
                    disabled={deletingId === row.id}
                    onClick={() => void remove(row)}
                  >
                    {deletingId === row.id ? "Removing…" : "Remove"}
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
              {editing ? "Edit contact" : "Add contact"}
            </DialogTitle>
            <DialogDescription>
              Saved to this employee’s Directory 201 file only.
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid gap-3">
            {(
              [
                ["name", "Name *"],
                ["relationship", "Relationship"],
                ["mobile", "Mobile"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["address", "Address"],
                ["city", "City"],
              ] as const
            ).map(([key, label]) => {
              const capitalize = ["name", "relationship", "address", "city"].includes(
                key
              );
              return (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`contact-${key}`}>{label}</Label>
                <Input
                  id={`contact-${key}`}
                  autoCapitalizeWords={capitalize}
                  value={form[key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [key]: e.target.value }))
                  }
                />
              </div>
            );
            })}
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
