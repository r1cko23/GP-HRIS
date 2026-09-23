"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryWizardChrome } from "@/components/directory/DirectoryWizardChrome";
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
  pickClientPatch,
  type DirectoryClientFormData,
} from "@/lib/directory/client-form";
import {
  clientWizardSteps,
  isOrganicOrganizationName,
  type ClientWizardStepId,
} from "@/lib/directory/client-wizard";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function NewDirectoryClientPage() {
  const router = useRouter();
  const [orgId, setOrgId] = useState("");
  const [orgName, setOrgName] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [form, setForm] = useState<DirectoryClientFormData>(
    emptyDirectoryClientForm
  );
  const [stepId, setStepId] = useState<ClientWizardStepId>("identity");
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
        setOrgName(org.name);
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

  const steps = useMemo(
    () => clientWizardSteps(!isOrganicOrganizationName(orgName)),
    [orgName]
  );
  const stepIndex = Math.max(
    0,
    steps.findIndex((step) => step.id === stepId)
  );
  const current = steps[stepIndex] ?? steps[0];

  async function persist() {
    if (!orgId) return null;
    const payload = formToClientPayload(form);
    if (!clientId) {
      if (!form.name.trim()) {
        toast.error("Enter a company name");
        return null;
      }
      const json = await directoryJson<{ data: { id: string; name: string } }>(
        "/api/directory/clients",
        orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      setClientId(json.data.id);
      writeDirectoryClient({ id: json.data.id, name: json.data.name });
      return json.data;
    }
    const patch = pickClientPatch(payload as unknown as Record<string, unknown>);
    const json = await directoryJson<{ data: { id: string; name: string } }>(
      `/api/directory/clients/${clientId}`,
      orgId,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }
    );
    writeDirectoryClient({ id: json.data.id, name: json.data.name });
    return json.data;
  }

  async function goNext(opts: { finish?: boolean } = {}) {
    setSaving(true);
    setError(null);
    try {
      const saved = await persist();
      if (!saved) return;
      if (opts.finish || stepIndex >= steps.length - 1) {
        toast.success("Client saved", { description: saved.name });
        router.push(`/people/c/${saved.id}?status=active`);
        return;
      }
      const next = steps[stepIndex + 1];
      if (next) setStepId(next.id);
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
      <div className={cn("w-full min-w-0 pb-24", dbPageWrapper)}>
        <DashboardPageHeader
          above={
            <div className="space-y-1">
              <DirectoryBreadcrumb
                items={[
                  { label: "People", href: "/people" },
                  { label: "New client" },
                ]}
              />
            </div>
          }
          title="Add client"
          description="One section at a time. Billing is skipped for Organic house."
          actions={
            <Button type="button" variant="outline" asChild>
              <Link href="/people">Cancel</Link>
            </Button>
          }
        />

        {error && !orgId ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_18.5rem]">
            <DirectoryWizardChrome
              steps={steps}
              currentId={current?.id ?? "identity"}
              saving={saving}
              error={error}
              onBack={
                stepIndex > 0
                  ? () => setStepId(steps[stepIndex - 1]!.id)
                  : undefined
              }
              onSkip={
                stepIndex > 0
                  ? () => void goNext()
                  : undefined
              }
              onFinishLater={
                clientId
                  ? () => void goNext({ finish: true })
                  : undefined
              }
              onContinue={() => void goNext()}
            >
              <DirectoryClientFormFields
                form={form}
                onChange={setForm}
                disabled={saving || !orgId}
                visibleSectionIds={
                  current ? [current.sectionId] : ["identity"]
                }
              />
            </DirectoryWizardChrome>
            <DirectoryClientPreview form={form} />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
