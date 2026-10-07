"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryWizardChrome } from "@/components/directory/DirectoryWizardChrome";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { ListFilterSuggest, type ListSuggestOption } from "@/components/ListFilterSuggest";
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
import { directoryStatusMeta } from "@/lib/directory/employees";
import { splitHireAlertPersonName } from "@/lib/directory/hire-alert";
import {
  employeeOnboardStepsVisible,
  pathAfterEmployeeHireIdentity,
} from "@/lib/directory/onboard";
import { directoryDirectLabel } from "@/lib/directory/site-label";
import {
  peopleClientBreadcrumbHref,
  peopleHubListPath,
} from "@/lib/access/people-pages";
import { usePermissions } from "@/lib/hooks/usePermissions";
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

type ClientRow = { id: string; name: string };
type BranchRow = { id: string; name: string };
type PositionRow = {
  id: string;
  job_title: string;
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

export type DirectoryHireEmployeeWizardProps = {
  initialClientId?: string | null;
  initialBranchId?: string | null;
  initialPersonName?: string | null;
  cancelHref?: string;
  backHref?: string;
  backLabel?: string;
};

export function DirectoryHireEmployeeWizard({
  initialClientId = null,
  initialBranchId = null,
  initialPersonName = null,
  cancelHref = "/people/employees",
  backHref = "/people/employees",
  backLabel = "Employees",
}: DirectoryHireEmployeeWizardProps) {
  const router = useRouter();
  const { capabilityKeys: rawCapabilityKeys } = usePermissions();
  const capabilityKeys = rawCapabilityKeys ?? [];
  const hubListPath = peopleHubListPath(capabilityKeys);
  const resolvedCancelHref = cancelHref || hubListPath;
  const resolvedBackHref = backHref || hubListPath;
  const nameParts = splitHireAlertPersonName(initialPersonName ?? "");

  const [orgId, setOrgId] = useState("");
  const [clientId, setClientId] = useState(initialClientId?.trim() ?? "");
  const [clientName, setClientName] = useState("");
  const [clientQuery, setClientQuery] = useState("");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [branchId, setBranchId] = useState(initialBranchId?.trim() ?? "");
  const [positionId, setPositionId] = useState("");
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [forceCreate, setForceCreate] = useState(false);
  const [form, setForm] = useState({
    last_name: nameParts.last_name,
    first_name: nameParts.first_name,
    middle_name: "",
    sss_number: "",
    birth_date: "",
    sex: "",
    email: "",
    mobile: "",
    address: "",
  });

  const clientSuggestItems = useMemo((): ListSuggestOption[] => {
    return clients.map((row) => {
      const direct = directoryDirectLabel(row.name);
      return {
        id: row.id,
        primary: direct,
        secondary: direct !== row.name ? row.name : undefined,
        value: direct,
        matchText: row.name,
      };
    });
  }, [clients]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const org = await ensureDirectoryOrgId();
        if (cancelled) return;
        setOrgId(org);
        const json = await directoryJson<{ data: ClientRow[] }>(
          `/api/directory/clients?${new URLSearchParams({
            status: "active",
            limit: "200",
            offset: "0",
          })}`,
          org
        );
        if (cancelled) return;
        setClients(json.data ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load clients");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!orgId || !clientId) {
      if (!clientId) {
        setClientName("");
        setBranches([]);
        setPositions([]);
      }
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const known = clients.find((row) => row.id === clientId);
        const [clientJson, branchJson, posJson] = await Promise.all([
          known
            ? Promise.resolve({ data: known })
            : directoryJson<{ data: { id: string; name: string } }>(
                `/api/directory/clients/${clientId}`,
                orgId
              ),
          directoryJson<{ data: BranchRow[] }>(
            `/api/directory/clients/${clientId}/branches`,
            orgId
          ),
          directoryJson<{ data: PositionRow[] }>(
            `/api/directory/positions?${new URLSearchParams({
              client_id: clientId,
              approved_only: "1",
              limit: "200",
            })}`,
            orgId
          ),
        ]);
        if (cancelled) return;
        const name = clientJson.data.name;
        const label = directoryDirectLabel(name);
        setClientName(name);
        setClientQuery(label);
        writeDirectoryClient({
          id: clientJson.data.id,
          name,
        });
        setBranches(branchJson.data ?? []);
        setPositions(posJson.data ?? []);
        if (
          initialBranchId &&
          !(branchJson.data ?? []).some((b) => b.id === initialBranchId)
        ) {
          setBranchId("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load client");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, clientId, clients, initialBranchId]);

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
    if (!clientId) {
      setError("Select a client");
      return;
    }
    if (!branchId) {
      setError("Select a site");
      return;
    }
    if (!positionId) {
      setError("Select a position");
      return;
    }
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
            email: form.email.trim() || null,
            mobile: form.mobile.trim() || null,
            address: form.address.trim() || null,
            force_create: forceCreate || undefined,
          }),
        }
      );

      const employeeId = json.data.id;
      // Position PATCH stamps rates from the approved card server-side.
      await directoryJson(`/api/directory/employees/${employeeId}`, orgId, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hire_date: new Date().toISOString().slice(0, 10),
          branch_id: branchId,
          position_id: positionId,
        }),
      });

      toast.success("201 started — for verification", {
        description: `${last}, ${first}. Complete government IDs and documents — HR adds paythrough on Activate.`,
      });
      router.replace(
        pathAfterEmployeeHireIdentity(clientId, employeeId, {
          placementSaved: true,
          identity: {
            last_name: last,
            first_name: first,
            birth_date: form.birth_date || null,
            sex: form.sex || null,
            mobile: form.mobile.trim() || null,
          },
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Create failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const breadcrumbClient = clientName || "Client";
  const clientCrumbHref = clientId
    ? peopleClientBreadcrumbHref(capabilityKeys, clientId)
    : null;
  const disableContinue =
    !clientId ||
    !branchId ||
    !positionId ||
    !form.last_name.trim() ||
    !form.first_name.trim() ||
    (matches.length > 0 && !forceCreate);

  return (
    <DashboardLayout>
      <div className={`${dbPageWrapper} w-full min-w-0 pb-24`}>
        <DashboardPageHeader
          above={
            <div className="space-y-1">
              <HubBackLink href={resolvedBackHref} label={backLabel} />
              <DirectoryBreadcrumb
                items={[
                  {
                    label:
                      hubListPath === "/people/clients"
                        ? "Clients"
                        : "Employees",
                    href: hubListPath,
                  },
                  ...(clientId
                    ? [
                        {
                          label: breadcrumbClient,
                          href: clientCrumbHref ?? undefined,
                        },
                      ]
                    : []),
                  { label: "Add employee" },
                ]}
              />
            </div>
          }
          title="Add employee"
          description="Pick client, site, and position, then enter the name. Continue creates a 201 for verification — complete government IDs and documents next. HR adds paythrough when they Activate."
          actions={
            <Button type="button" variant="outline" asChild>
              <Link href={resolvedCancelHref}>Cancel</Link>
            </Button>
          }
        />

        <DirectoryWizardChrome
          steps={employeeOnboardStepsVisible({
            placementComplete: true,
          }).map((step) => ({
            id: step.id,
            label: step.label,
            description:
              step.id === "identity"
                ? "Client, site, position, and name create the 201 for verification."
                : step.id === "government"
                  ? "SSS, TIN, PhilHealth, Pag-IBIG — HR verifies these before Activate."
                  : step.description,
          }))}
          currentId="identity"
          saving={saving}
          error={error}
          disableContinue={disableContinue}
          onContinue={() => void goNext()}
        >
          <div className="mb-6 space-y-4 rounded-md border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium text-foreground">Placement</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client *" htmlFor="hire-client">
                <ListFilterSuggest
                  id="hire-client"
                  value={clientQuery}
                  onValueChange={(value) => {
                    setClientQuery(value);
                    const selectedLabel = clientName
                      ? directoryDirectLabel(clientName)
                      : "";
                    if (selectedLabel && value !== selectedLabel) {
                      setClientId("");
                      setClientName("");
                      setBranchId("");
                      setPositionId("");
                      setBranches([]);
                      setPositions([]);
                      setMatches([]);
                    }
                  }}
                  onSelect={(option) => {
                    const row = clients.find((c) => c.id === option.id);
                    setClientId(option.id);
                    setClientQuery(option.primary);
                    setClientName(row?.name ?? option.matchText ?? option.primary);
                    setBranchId("");
                    setPositionId("");
                    setMatches([]);
                    setForceCreate(false);
                  }}
                  items={clientSuggestItems}
                  placeholder="Click or type to pick a client…"
                  aria-label="Client"
                  minChars={0}
                  limit={200}
                  emptyMessage="No active clients"
                />
              </Field>
              <Field label="Site *">
                <Select
                  value={branchId || "__none__"}
                  onValueChange={(value) => {
                    setBranchId(value === "__none__" ? "" : value);
                    setMatches([]);
                  }}
                  disabled={!clientId || branches.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select site" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select site</SelectItem>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Position *">
                <Select
                  value={positionId || "__none__"}
                  onValueChange={(value) => {
                    setPositionId(value === "__none__" ? "" : value);
                    setMatches([]);
                  }}
                  disabled={!clientId || positions.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Select position</SelectItem>
                    {positions.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            {clientId && positions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No approved positions for this client yet. Ask HR to approve a
                position card first.
              </p>
            ) : null}
          </div>

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
            <Field label="Email" htmlFor="hire-email">
              <Input
                id="hire-email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((f) => ({ ...f, email: e.target.value }))
                }
                autoComplete="email"
              />
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
