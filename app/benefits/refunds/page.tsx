"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { BodySmall, Label, Caption } from "@/components/ui/typography";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HStack, VStack } from "@/components/ui/stack";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { toast } from "sonner";
import { formatCurrency } from "@/utils/format";
import { format } from "date-fns";
import {
  getBiMonthlyPeriodStart,
  getBiMonthlyPeriodEnd,
  getNextBiMonthlyPeriod,
  getPreviousBiMonthlyPeriod,
  formatBiMonthlyPeriod,
} from "@/utils/bimonthly";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { buildCutoffRefundUpsert } from "@/lib/benefits/cutoff-refund";
import {
  directoryJson,
  ensureDirectoryOrgId,
  loadDirectoryOrganizations,
  pickDirectoryOrg,
  readDirectoryOrgId,
  writeDirectoryOrgId,
} from "@/lib/directory/browser";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

type ClientOption = { id: string; name: string };

type Employee = {
  id: string;
  employee_id: string;
  full_name: string;
  last_name?: string | null;
  first_name?: string | null;
  directory_client_id?: string | null;
};

type CutoffAllowanceRow = {
  id?: string;
  employee_id: string;
  period_start: string;
  period_end: string;
  transpo_allowance: number;
  load_allowance: number;
  allowance: number;
  refund: number;
};

function employeeLabel(emp: Employee): string {
  const nameParts = emp.full_name?.trim().split(/\s+/) || [];
  const lastName =
    emp.last_name ||
    (nameParts.length > 0 ? nameParts[nameParts.length - 1] : "");
  const firstName =
    emp.first_name || (nameParts.length > 0 ? nameParts[0] : "");
  const middleParts = nameParts.length > 2 ? nameParts.slice(1, -1) : [];
  if (lastName && firstName) {
    return `${lastName.toUpperCase()}, ${firstName.toUpperCase()}${
      middleParts.length > 0 ? " " + middleParts.join(" ").toUpperCase() : ""
    }`;
  }
  return emp.full_name || emp.employee_id || emp.id;
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

  const [orgId, setOrgId] = useState("");
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [periodStart, setPeriodStart] = useState<Date>(() =>
    getBiMonthlyPeriodStart(new Date())
  );
  const [existing, setExisting] = useState<CutoffAllowanceRow | null>(null);
  const [refund, setRefund] = useState("0");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const writeParams = useCallback(
    (patch: { client_id?: string; employee_id?: string }) => {
      const next = new URLSearchParams(searchParams.toString());
      if (patch.client_id !== undefined) {
        if (patch.client_id) next.set("client_id", patch.client_id);
        else next.delete("client_id");
      }
      if (patch.employee_id !== undefined) {
        if (patch.employee_id) next.set("employee_id", patch.employee_id);
        else next.delete("employee_id");
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
        const picked = pickDirectoryOrg(list, readDirectoryOrgId());
        if (picked) writeDirectoryOrgId(picked.id);
        const oid = await ensureDirectoryOrgId();
        if (!oid) return;
        writeDirectoryOrgId(oid);
        setOrgId(oid);
        const clientsJson = await directoryJson<{ data: ClientOption[] }>(
          `/api/directory/clients?${new URLSearchParams({
            limit: "200",
            offset: "0",
          })}`,
          oid
        );
        if (!cancelled) setClients(clientsJson.data ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load clients");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [permLoading, canUse]);

  useEffect(() => {
    if (permLoading || !canUse) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        let query = supabase
          .from("employees")
          .select(
            "id, employee_id, full_name, last_name, first_name, directory_client_id"
          )
          .eq("is_active", true)
          .order("last_name", { ascending: true, nullsFirst: false })
          .order("first_name", { ascending: true, nullsFirst: false });

        if (clientFromUrl) {
          query = query.eq("directory_client_id", clientFromUrl);
        }

        const { data, error } = await query;
        if (error) throw error;
        if (!cancelled) {
          setEmployees(data || []);
          if (
            employeeFromUrl &&
            !(data || []).some((e) => e.id === employeeFromUrl)
          ) {
            writeParams({ employee_id: "" });
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load employees");
        if (!cancelled) setEmployees([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase client is stable
  }, [permLoading, canUse, clientFromUrl, employeeFromUrl, writeParams]);

  useEffect(() => {
    if (!employeeFromUrl || permLoading || !canUse) {
      setExisting(null);
      setRefund("0");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const periodStartStr = format(periodStart, "yyyy-MM-dd");
        const { data, error } = await supabase
          .from("cutoff_allowances")
          .select("*")
          .eq("employee_id", employeeFromUrl)
          .eq("period_start", periodStartStr)
          .maybeSingle();
        if (error) throw error;
        if (cancelled) return;
        if (data) {
          setExisting(data);
          setRefund(String(data.refund || 0));
        } else {
          setExisting(null);
          setRefund("0");
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load refund");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeFromUrl, periodStart, permLoading, canUse]);

  async function handleSave() {
    if (!employeeFromUrl) {
      toast.error("Please select an employee");
      return;
    }
    setSaving(true);
    try {
      const periodStartStr = format(periodStart, "yyyy-MM-dd");
      const periodEndStr = format(getBiMonthlyPeriodEnd(periodStart), "yyyy-MM-dd");
      const row = buildCutoffRefundUpsert({
        employeeId: employeeFromUrl,
        periodStart: periodStartStr,
        periodEnd: periodEndStr,
        refund: parseFloat(refund) || 0,
        existing,
      });

      if (existing?.id) {
        const { error } = await supabase
          .from("cutoff_allowances")
          .update(row)
          .eq("id", existing.id);
        if (error) throw error;
        toast.success("Refund updated");
      } else {
        const { error } = await supabase.from("cutoff_allowances").insert(row);
        if (error) throw error;
        toast.success("Refund saved");
      }

      const { data } = await supabase
        .from("cutoff_allowances")
        .select("*")
        .eq("employee_id", employeeFromUrl)
        .eq("period_start", periodStartStr)
        .maybeSingle();
      setExisting(data);
      setRefund(String(data?.refund || 0));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Save failed";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (loading || permLoading) {
    return <RefundsFallback />;
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full", dbPageWrapper)}>
        <DashboardPageHeader
          title="Refunds"
          description="Client → employee → refund amount for the cutoff."
        />
        <CardSection>
          <VStack gap="4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <VStack gap="2" align="start">
                <Label>Client</Label>
                <Select
                  value={clientFromUrl || "all"}
                  onValueChange={(value) =>
                    writeParams({
                      client_id: value === "all" ? "" : value,
                      employee_id: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All clients" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Caption>Filter employees by Directory client</Caption>
              </VStack>

              <VStack gap="2" align="start">
                <Label>Employee</Label>
                <Select
                  value={employeeFromUrl || undefined}
                  onValueChange={(value) => writeParams({ employee_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {employeeLabel(emp)} ({emp.employee_id})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </VStack>
            </div>

            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodStart(getPreviousBiMonthlyPeriod(periodStart))}
              >
                <Icon name="CaretLeft" size={IconSizes.sm} />
              </Button>
              <BodySmall className="font-medium">
                {formatBiMonthlyPeriod(periodStart, getBiMonthlyPeriodEnd(periodStart))}
              </BodySmall>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPeriodStart(getNextBiMonthlyPeriod(periodStart))}
              >
                <Icon name="CaretRight" size={IconSizes.sm} />
              </Button>
            </div>

            {employeeFromUrl ? (
              <>
                <VStack gap="2" align="start">
                  <Label>Refund amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={refund}
                    onChange={(e) => setRefund(e.target.value)}
                  />
                  <Caption>
                    Saved on the cutoff allowance row
                    {existing?.id ? " (existing)" : " (new)"}
                  </Caption>
                </VStack>

                <div className="rounded-lg bg-blue-50 p-4">
                  <HStack justify="between" align="center">
                    <span className="font-semibold text-blue-700">Refund</span>
                    <span className="text-xl font-bold text-blue-900">
                      {formatCurrency(Math.round((parseFloat(refund) || 0) * 100) / 100)}
                    </span>
                  </HStack>
                </div>

                <HStack justify="end" gap="3">
                  <Button variant="secondary" onClick={() => setRefund("0")}>
                    Reset
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Saving..." : "Save refund"}
                  </Button>
                </HStack>
              </>
            ) : (
              <BodySmall className="text-muted-foreground">
                Select a client and employee to enter a refund.
              </BodySmall>
            )}

            {!orgId ? (
              <Caption className="text-amber-700">
                Pick an organization in Directory to load clients.
              </Caption>
            ) : null}
          </VStack>
        </CardSection>
      </div>
    </DashboardLayout>
  );
}
