"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
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
  emptyDirectoryClientForm,
  formToClientPayload,
  type DirectoryClientFormData,
} from "@/lib/directory/client-form";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewDirectoryClientPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [form, setForm] = useState<DirectoryClientFormData>(
    emptyDirectoryClientForm
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const orgs = await loadDirectoryOrganizations();
        if (cancelled) return;
        const org = pickDirectoryOrg(orgs, readDirectoryOrgId());
        if (!org) {
          setError("No organization yet.");
          return;
        }
        writeDirectoryOrgId(org.id);
        setOrgId(org.id);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load org");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId) return;
    if (!form.name.trim()) {
      toast.error("Enter a company name");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = formToClientPayload(form);
      const json = await directoryJson<{ data: { id: string; name: string } }>(
        "/api/directory/clients",
        orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const created = json.data;
      writeDirectoryClient({ id: created.id, name: created.name });
      toast.success("Client created", { description: created.name });
      router.push(`/people/c/${created.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
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
                { label: "New client" },
              ]}
            />
          }
          title="Add client"
        />

        <DirectoryWorkflowStrip
          className="mb-4"
          steps={[
            { label: "Clients", href: "/people", done: true },
            { label: "New client", current: true },
          ]}
        />

        {error && !orgId ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_18.5rem]">
              <div className="min-w-0 rounded-md border border-border bg-card p-4 shadow-card sm:p-6">
                <DirectoryClientFormFields
                  form={form}
                  onChange={setForm}
                  disabled={saving || !orgId}
                />
                {error ? (
                  <p className="mt-4 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <DirectoryClientPreview form={form} />
            </div>

            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/90 sm:px-6">
              <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-end gap-2">
                <Button type="button" variant="outline" asChild>
                  <Link href="/people">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving || !orgId}>
                  {saving ? "Creating…" : "Create client"}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}
