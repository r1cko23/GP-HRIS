"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSection } from "@/components/ui/card-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BodySmall, Label, Caption, H4 } from "@/components/ui/typography";
import { PageHeader } from "@/components/ui/page-header";
import { HStack, VStack } from "@/components/ui/stack";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  directoryJson,
  directoryOrgLabel,
  ensureDirectoryOrgId,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryClient,
  readDirectoryOrgId,
  writeDirectoryClient,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import {
  formatBenefitsCutoffLabel,
  listEditableBenefitsCutoffs,
  pickDefaultBenefitsCutoff,
  type BenefitsCutoffOption,
} from "@/lib/benefits/cutoff-picker";
import { HubSegmentedControl } from "@/components/hubs/HubSegmentedControl";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

type Org = { id: string; name: string };
type ClientOption = { id: string; name: string };
type DirEmployee = {
  id: string;
  employee_code: string | null;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  client_id: string | null;
};

const PAGE = 200;

function employeeLabel(emp: DirEmployee): string {
  const mid = emp.middle_name?.trim();
  return `${emp.last_name.toUpperCase()}, ${emp.first_name.toUpperCase()}${
    mid ? ` ${mid.toUpperCase()}` : ""
  }`;
}

function RefundsFallback() {
  return (
    <DashboardLayout>
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading...
      </div>
    </DashboardLayout>
  );
}

export default function RefundsPage() {
  return (
    <Suspense fallback={<RefundsFallback />}>
      <RefundsContent />
    </Suspense>
  );
}

function RefundsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canRead, loading: permLoading } = usePermissions();
  const canUse = canRead("payslips");

  const clientFromUrl = searchParams.get("client_id") ?? "";
  const employeeFromUrl = searchParams.get("employee_id") ?? "";
  const cutoffFromUrl = searchParams.get("cutoff_id") ?? "";

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [employees, setEmployees] = useState<DirEmployee[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [cutoffs, setCutoffs] = useState<BenefitsCutoffOption[]>([]);
  const [cutoffsLoading, setCutoffsLoading] = useState(false);
  const [refund, setRefund] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const writeParams = useCallback(
    (patch: {
      client_id?: string;
      employee_id?: string;
      cutoff_id?: string;
    }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (patch.client_id !== undefined) {
        if (patch.client_id) next.set("client_id", patch.client_id);
        else next.delete("client_id");
      }
      if (patch.employee_id !== undefined) {
        if (patch.employee_id) next.set("employee_id", patch.employee_id);
        else next.delete("employee_id");
      }
      if (patch.cutoff_id !== undefined) {
        if (patch.cutoff_id) next.set("cutoff_id", patch.cutoff_id);
        else next.delete("cutoff_id");
      }
      const qs = next.toString();
      router.replace(qs ? `/benefits/refunds?${qs}` : "/benefits/refunds", {
        scroll: false,
      });
    },
    [router, searchParams]
  );

  useEffect(() => {
    if (!permLoading && !canUse) {
      toast.error("You do not have permission to access this page.");
      router.push("/benefits");
    }
  }, [canUse, permLoading, router]);

  useEffect(() => {
    if (permLoading || !canUse) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await loadDirectoryOrganizations();
        if (cancelled) return;
        setOrgs(list);
        const picked = pickDirectoryOrg(list, readDirectoryOrgId());
        if (!picked) {
          setLoading(false);
          return;
        }
        writeDirectoryOrgId(picked.id);
        setOrgId(picked.id);
        const clientsJson = await directoryJson<{ data: ClientOption[] }>(
          `/api/directory/clients?${new URLSearchParams({
            status: "active",
            limit: "200",
            offset: "0",
          })}`,
          picked.id
        );
        if (cancelled) return;
        const clientList = clientsJson.data ?? [];
        setClients(clientList);

        const remembered = readDirectoryClient();
        const preferred =
          clientList.find((c) => c.id === clientFromUrl) ??
          clientList.find((c) => c.id === remembered?.id);
        if (preferred && !clientFromUrl) {
          writeParams({ client_id: preferred.id, employee_id: "" });
          writeDirectoryClient({ id: preferred.id, name: preferred.name });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load clients");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permLoading, canUse]);

  useEffect(() => {
    if (!orgId || !clientFromUrl) {
      setEmployees([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setEmployeesLoading(true);
      try {
        await ensureDirectoryOrgId();
        const params = new URLSearchParams({
          client_id: clientFromUrl,
          limit: String(PAGE),
          offset: "0",
        });
        const json = await directoryJson<{ data: DirEmployee[]; count: number }>(
          `/api/directory/employees?${params}`,
          orgId
        );
        if (cancelled) return;
        const rows = json.data ?? [];
        setEmployees(rows);
        if (employeeFromUrl && !rows.some((e) => e.id === employeeFromUrl)) {
          writeParams({ employee_id: "" });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load employees");
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setEmployeesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, clientFromUrl, employeeFromUrl, writeParams]);

  useEffect(() => {
    if (!orgId || !clientFromUrl) {
      setCutoffs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setCutoffsLoading(true);
      try {
        const params = new URLSearchParams({
          client_id: clientFromUrl,
          limit: "50",
          offset: "0",
        });
        const json = await directoryJson<{ data: BenefitsCutoffOption[] }>(
          `/api/timekeeping/cutoff-periods?${params}`,
          orgId
        );
        if (cancelled) return;
        const rows = listEditableBenefitsCutoffs(json.data ?? []);
        setCutoffs(rows);
        if (!cutoffFromUrl) {
          const def = pickDefaultBenefitsCutoff(rows);
          if (def) writeParams({ cutoff_id: def.id });
        } else if (!rows.some((r) => r.id === cutoffFromUrl)) {
          const def = pickDefaultBenefitsCutoff(rows);
          writeParams({ cutoff_id: def?.id ?? "" });
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load cutoffs");
        if (!cancelled) setCutoffs([]);
      } finally {
        if (!cancelled) setCutoffsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId, clientFromUrl, cutoffFromUrl, writeParams]);

  useEffect(() => {
    if (!employeeFromUrl || !orgId || !cutoffFromUrl) {
      setRefund("0");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({
          directory_employee_id: employeeFromUrl,
          cutoff_period_id: cutoffFromUrl,
        });
        const json = await directoryJson<{
          data?: { amount?: number };
        }>(`/api/benefits/refunds?${params}`, orgId);
        if (cancelled) return;
        setRefund(String(json.data?.amount ?? 0));
      } catch (err) {
        console.error(err);
        toast.error("Failed to load refund");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [employeeFromUrl, orgId, cutoffFromUrl]);

  async function handleSave() {
    if (!clientFromUrl) {
      toast.error("Select a client first");
      return;
    }
    if (!cutoffFromUrl) {
      toast.error("Select a cutoff first");
      return;
    }
    if (!employeeFromUrl) {
      toast.error("Select an employee");
      return;
    }
    setSaving(true);
    try {
      await directoryJson(`/api/benefits/refunds`, orgId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          directory_employee_id: employeeFromUrl,
          cutoff_period_id: cutoffFromUrl,
          amount: parseFloat(refund || "0") || 0,
        }),
      });
      toast.success("Refund saved for this cutoff");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const refundValue = Math.round((parseFloat(refund) || 0) * 100) / 100;
  const selectedClient = clients.find((c) => c.id === clientFromUrl);
  const selectedCutoff = cutoffs.find((c) => c.id === cutoffFromUrl);

  if (loading || permLoading) {
    return <RefundsFallback />;
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <PageHeader
          title="Refunds"
        />
        {orgs.length > 1 ? (
          <div className="mb-4">
            <HubSegmentedControl
              ariaLabel="Organization"
              value={orgId}
              onChange={(id) => {
                const org = orgs.find((o) => o.id === id);
                if (!org || org.id === orgId) return;
                writeDirectoryOrgId(org.id);
                setOrgId(org.id);
                writeParams({ client_id: "", employee_id: "", cutoff_id: "" });
                setClients([]);
                setCutoffs([]);
                void (async () => {
                  const clientsJson = await directoryJson<{
                    data: ClientOption[];
                  }>(
                    `/api/directory/clients?${new URLSearchParams({
                      status: "active",
                      limit: "200",
                      offset: "0",
                    })}`,
                    org.id
                  );
                  setClients(clientsJson.data ?? []);
                })();
              }}
              options={orgs.map((o) => ({
                id: o.id,
                label: directoryOrgLabel(o.name),
              }))}
            />
          </div>
        ) : null}

        <CardSection>
          <VStack gap="4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <VStack gap="2" align="start">
                <Label>Client</Label>
                <Select
                  value={clientFromUrl || undefined}
                  onValueChange={(value) => {
                    const c = clients.find((row) => row.id === value);
                    if (c) writeDirectoryClient({ id: c.id, name: c.name });
                    writeParams({
                      client_id: value,
                      employee_id: "",
                      cutoff_id: "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Caption>Required. Applies on that client’s cutoff register.</Caption>
              </VStack>

              <VStack gap="2" align="start">
                <Label>Cutoff</Label>
                <Select
                  value={cutoffFromUrl || undefined}
                  onValueChange={(value) =>
                    writeParams({
                      cutoff_id: value,
                      employee_id: employeeFromUrl,
                    })
                  }
                  disabled={!clientFromUrl || cutoffsLoading}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !clientFromUrl
                          ? "Select a client first"
                          : cutoffsLoading
                            ? "Loading cutoffs…"
                            : "Select cutoff"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {cutoffs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {formatBenefitsCutoffLabel(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Caption>
                  Draft / pending / approved only — posted cutoffs are hidden.
                </Caption>
              </VStack>

              <VStack gap="2" align="start">
                <Label>Employee</Label>
                <Select
                  value={employeeFromUrl || undefined}
                  onValueChange={(value) =>
                    writeParams({ employee_id: value })
                  }
                  disabled={
                    !clientFromUrl || !cutoffFromUrl || employeesLoading
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !clientFromUrl
                          ? "Select a client first"
                          : !cutoffFromUrl
                            ? "Select a cutoff first"
                            : employeesLoading
                              ? "Loading employees…"
                              : "Select employee"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {employeeLabel(emp)}
                        {emp.employee_code ? ` (${emp.employee_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clientFromUrl && !employeesLoading && employees.length === 0 ? (
                  <Caption className="text-amber-700">
                    No employees for this client.
                  </Caption>
                ) : null}
              </VStack>
            </div>
          </VStack>
        </CardSection>

        {clientFromUrl && cutoffFromUrl && employeeFromUrl ? (
          <CardSection
            title="Refund amount"
            description={
              selectedClient
                ? `${selectedClient.name} · ${
                    selectedCutoff
                      ? formatBenefitsCutoffLabel(selectedCutoff)
                      : "cutoff"
                  } · this run only`
                : "Applied on this cutoff’s payroll register build"
            }
          >
            <VStack gap="2" align="start" className="max-w-sm">
              <Label>Refund</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={refund}
                onChange={(e) => setRefund(e.target.value)}
              />
              <Caption>
                Added to gross as an adjustment (audit Refund column) when you
                build this cutoff’s register.
              </Caption>
            </VStack>

            <div className="mt-4 rounded-lg bg-blue-50 p-4">
              <HStack justify="between" align="center">
                <H4 className="text-blue-700">Refund</H4>
                <span className="text-xl font-bold text-blue-900">
                  {formatCurrency(refundValue)}
                </span>
              </HStack>
            </div>

            <HStack justify="end" gap="3" className="mt-4">
              <Button variant="secondary" onClick={() => setRefund("0")}>
                Reset
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save refund"}
              </Button>
            </HStack>
          </CardSection>
        ) : (
          <CardSection>
            <BodySmall className="text-muted-foreground">
              {!clientFromUrl
                ? "Select a client to load cutoffs and employees."
                : !cutoffFromUrl
                  ? "Select a cutoff so the refund applies to that payroll run."
                  : "Select an employee to enter a refund."}
            </BodySmall>
          </CardSection>
        )}
      </div>
    </DashboardLayout>
  );
}
