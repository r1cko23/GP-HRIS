"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
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
import { slugifyClientName } from "@/lib/payroll-summary/client-slug";
import type { AuditCompany } from "@/lib/payroll-summary/types";

interface AddPayrollAuditClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (company: AuditCompany) => void;
}

export function AddPayrollAuditClientDialog({
  open,
  onOpenChange,
  onCreated,
}: AddPayrollAuditClientDialogProps) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!slugTouched) {
      setSlug(slugifyClientName(name));
    }
  }, [name, slugTouched]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      toast.error("Enter a client name (at least 2 characters)");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/payroll/summary-audit/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          slug: slug.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Failed to create client");
      }

      toast.success(`Client "${json.company.name}" added`);
      onCreated(json.company as AuditCompany);
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create client"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add client</DialogTitle>
            <DialogDescription>
              Create a new payroll audit client. Upload registers after saving to
              build plantilla and period comparisons.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="client-name">Client name</Label>
              <Input
                id="client-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Chicha Hut"
                autoFocus
                disabled={saving}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="client-slug">Slug</Label>
              <Input
                id="client-slug"
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
                placeholder="chicha-hut"
                disabled={saving}
              />
              <p className="text-xs text-muted-foreground">
                Used as a unique key. Auto-generated from the name; edit if needed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Add client"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
