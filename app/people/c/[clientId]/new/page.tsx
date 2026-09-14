"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryWizardChrome } from "@/components/directory/DirectoryWizardChrome";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  directoryJson,
  ensureDirectoryOrgId,
  writeDirectoryClient,
} from "@/lib/directory/browser";
import {
  EMPLOYEE_ONBOARD_STEPS,
  pathAfterEmployeeHireIdentity,
} from "@/lib/directory/onboard";
import { directoryStatusMeta } from "@/lib/directory/employees";
import { peopleClientPath } from "@/lib/hubs";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { toast } from "sonner";

type MatchRow = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  status: string;
  is_current_engagement?: boolean;
};

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
    </div>
  );
}

function namesMatch(row: MatchRow, last: string, first: string) {
  return (
    row.last_name.trim().toLowerCase() === last &&
    row.first_name.trim().toLowerCase() === first
  );
}

export default function NewDirectoryEmployeePage() {
  const params = useParams();
  const router = useRouter();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const rosterHref = peopleClientPath(clientId);

  const [orgId, setOrgId] = useState("");
  const [clientName, setClientName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [forceCreate, setForceCreate] = useState(false);
  const [form, setForm] = useState({
    last_name: "",
    first_name: "",
    middle_name: "",
    sss_number: "",
    birth_date: "",
    sex: "",
    mobile: "",
    address: "",
  });

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;
    void (async () => {
      try {
        const org = await ensureDirectoryOrgId();
        if (cancelled) return;
        setOrgId(org);
        const json = await directoryJson<{
          data: { id: string; name: string };
        }>(`/api/directory/clients/${clientId}`, org);
        if (cancelled) return;
        setClientName(json.data.name);
        writeDirectoryClient({ id: json.data.id, name: json.data.name });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load client");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function findNameMatches(last: string, first: string) {
    const json = await directoryJson<{ data: MatchRow[] }>(
      `/api/directory/employees?${new URLSearchParams({
        client_id: clientId,
        q: last,
        limit: "25",
        include_history: "true",
      })}`,
      orgId
    );
    return (json.data ?? []).filter((row) => namesMatch(row, last, first));
  }

  async function goNext() {
    const last = form.last_name.trim();
    const first = form.first_name.trim();
    if (!last || !first) {
      setError("Last name and first name are required");
      return;
    }
    if (!orgId) return;
    setSaving(true);
    setError(null);
    try {
      if (!forceCreate) {
        const found = await findNameMatches(
          last.toLowerCase(),
          first.toLowerCase()
        );
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
        orgId,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            last_name: last,
            first_name: first,
            middle_name: form.middle_name.trim() || null,
            sss_number: form.sss_number.trim() || null,
            birth_date: form.birth_date || null,
            sex: form.sex || null,
            mobile: form.mobile.trim() || null,
            address: form.address.trim() || null,
            force_create: forceCreate || undefined,
          }),
        }
      );
      toast.success("201 started", {
        description: `${last}, ${first}`,
      });
      router.replace(pathAfterEmployeeHireIdentity(clientId, json.data.id));
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
      <div className={`${dbPageWrapper} w-full min-w-0 pb-24`}>
        <DashboardPageHeader
          above={
            <div className="space-y-1">
              <HubBackLink href={rosterHref} label="Roster" />
              <DirectoryBreadcrumb
                items={[
                  { label: "People", href: "/people" },
                  {
                    label: clientName || "Client",
                    href: rosterHref,
                  },
                  { label: "Add employee" },
                ]}
              />
            </div>
          }
          title="Add employee"
          description="Name first. Continue creates the 201, then assignment, IDs, documents, and pay — same stepped wizard as Add client."
          actions={
            <Button type="button" variant="outline" asChild>
              <Link href={rosterHref}>Cancel</Link>
            </Button>
          }
        />

        <DirectoryWizardChrome
          steps={EMPLOYEE_ONBOARD_STEPS.map((step) => ({
            id: step.id,
            label: step.label,
            description:
              step.id === "identity"
                ? "Last name and first name create the 201. Skip the rest of this step if you will backfill later."
                : step.description,
          }))}
          currentId="identity"
          saving={saving}
          error={error}
          disableContinue={
            !form.last_name.trim() ||
            !form.first_name.trim() ||
            (matches.length > 0 && !forceCreate)
          }
          onContinue={() => void goNext()}
        >
          {matches.length > 0 ? (
            <div className="mb-4 space-y-2 rounded-md border border-border bg-muted/50 p-3 text-sm">
              <p className="font-medium">Matches on this client</p>
              <ul className="space-y-1.5">
                {matches.slice(0, 5).map((row) => (
                  <li
                    key={row.id}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <Link
                      href={`/people/c/${clientId}/${row.id}`}
                      className="font-medium underline underline-offset-2"
                    >
                      {row.last_name}, {row.first_name}
                      {row.employee_code ? ` · ${row.employee_code}` : ""}
                    </Link>
                    <span className="text-xs">
                      {directoryStatusMeta(row.status).label}
                      {row.is_current_engagement === false
                        ? " · superseded"
                        : ""}
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Last name *" htmlFor="hire-last">
              <Input
                id="hire-last"
                autoCapitalizeWords
                value={form.last_name}
                onChange={(e) => {
                  setMatches([]);
                  setForceCreate(false);
                  setForm((f) => ({ ...f, last_name: e.target.value }));
                }}
                autoComplete="family-name"
              />
            </Field>
            <Field label="First name *" htmlFor="hire-first">
              <Input
                id="hire-first"
                autoCapitalizeWords
                value={form.first_name}
                onChange={(e) => {
                  setMatches([]);
                  setForceCreate(false);
                  setForm((f) => ({ ...f, first_name: e.target.value }));
                }}
                autoComplete="given-name"
              />
            </Field>
            <Field label="Middle name" htmlFor="hire-middle">
              <Input
                id="hire-middle"
                autoCapitalizeWords
                value={form.middle_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, middle_name: e.target.value }))
                }
              />
            </Field>
            <Field label="SSS (optional)" htmlFor="hire-sss">
              <Input
                id="hire-sss"
                value={form.sss_number}
                onChange={(e) =>
                  setForm((f) => ({ ...f, sss_number: e.target.value }))
                }
                placeholder="Blocks hire if this person is already on file"
                inputMode="numeric"
                autoComplete="off"
              />
            </Field>
            <Field label="Birth date" htmlFor="hire-birth">
              <Input
                id="hire-birth"
                type="date"
                value={form.birth_date}
                onChange={(e) =>
                  setForm((f) => ({ ...f, birth_date: e.target.value }))
                }
              />
            </Field>
            <Field label="Sex">
              <Select
                value={form.sex || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    sex: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sex" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  <SelectItem value="F">Female</SelectItem>
                  <SelectItem value="M">Male</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Mobile" htmlFor="hire-mobile">
              <Input
                id="hire-mobile"
                value={form.mobile}
                onChange={(e) =>
                  setForm((f) => ({ ...f, mobile: e.target.value }))
                }
              />
            </Field>
            <Field label="Address" htmlFor="hire-address">
              <Input
                id="hire-address"
                autoCapitalizeWords
                value={form.address}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address: e.target.value }))
                }
              />
            </Field>
          </div>
        </DirectoryWizardChrome>
      </div>
    </DashboardLayout>
  );
}
