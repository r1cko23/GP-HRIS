"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryClientEmployeeSwitch } from "@/components/directory/DirectoryClientEmployeeSwitch";
import { DirectoryClientSummaryStrip } from "@/components/directory/DirectoryClientSummaryStrip";
import { DirectoryWorkflowStrip } from "@/components/directory/DirectoryWorkflowStrip";
import {
  DirectoryClientFormFields,
  DirectoryClientPreview,
} from "@/components/directory/DirectoryClientFormFields";
import { Button } from "@/components/ui/button";
import {
  directoryJson,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryClient,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import {
  clientRowToForm,
  emptyDirectoryClientForm,
  formToClientPayload,
  type DirectoryClientFormData,
  type DirectoryClientRow,
} from "@/lib/directory/client-form";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function EditDirectoryClientPage() {
  const params = useParams();
  const clientId = String(params.id ?? "");
  const [orgId, setOrgId] = useState("");
  const [form, setForm] = useState<DirectoryClientFormData>(
    emptyDirectoryClientForm
  );
  const [legacyId, setLegacyId] = useState<number | null>(null);
  const [clientRow, setClientRow] = useState<DirectoryClientRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    setError(null);
    try {
      const orgs = await loadDirectoryOrganizations();
      const org = pickDirectoryOrg(orgs, readDirectoryOrgId());
      if (!org) throw new Error("No organization");
      writeDirectoryOrgId(org.id);
      setOrgId(org.id);

      const json = await directoryJson<{ data: DirectoryClientRow }>(
        `/api/directory/clients/${clientId}`,
        org.id
      );
      const row = json.data;
      setClientRow(row);
      setForm(clientRowToForm(row));
      setLegacyId(row.legacy_id ?? null);
      setDirty(false);
      writeDirectoryClient({ id: row.id, name: row.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load client");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateForm(next: DirectoryClientFormData) {
    setForm(next);
    setDirty(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !clientId) return;
    if (!form.name.trim()) {
      toast.error("Enter a company name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = formToClientPayload(form);
      const json = await directoryJson<{ data: DirectoryClientRow }>(
        `/api/directory/clients/${clientId}`,
        orgId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      writeDirectoryClient({ id: json.data.id, name: json.data.name });
      setForm(clientRowToForm(json.data));
      setDirty(false);
      toast.success("Client saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-28", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <DirectoryBreadcrumb
              items={[
                { label: "People", href: "/people" },
                { label: form.name || "Client" },
                { label: "Client" },
              ]}
            />
          }
          title={form.name || "Client management"}
        />

        <DirectoryClientEmployeeSwitch
          className="mb-4"
          clientId={clientId}
          clientName={form.name || undefined}
          active="client"
        />

        <DirectoryWorkflowStrip
          className="mb-4"
          steps={[
            { label: "Clients", href: "/people", done: true },
            { label: "Details & settings", current: true },
          ]}
        />

        {clientRow ? (
          <DirectoryClientSummaryStrip
            className="mb-4"
            client={clientRow}
            clientId={clientId}
          />
        ) : null}

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading client">
            <div className="h-40 animate-pulse rounded-md bg-muted/60" />
            <div className="h-64 animate-pulse rounded-md bg-muted/40" />
          </div>
        ) : error && !form.name ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_18.5rem]">
              <div className="min-w-0 rounded-md border border-border bg-card p-4 shadow-card sm:p-6">
                <DirectoryClientFormFields
                  form={form}
                  onChange={updateForm}
                  disabled={saving}
                />
                {error ? (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DirectoryClientPreview form={form} legacyId={legacyId} />
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:px-6">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {dirty ? "Unsaved changes" : "All changes saved"}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/people/c/${clientId}`}>Employees</Link>
                  </Button>
                  <Button type="submit" disabled={saving || !dirty}>
                    {saving ? "Saving…" : "Save client"}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
