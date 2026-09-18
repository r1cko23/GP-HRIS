"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { DirectoryBreadcrumb } from "@/components/directory/DirectoryBreadcrumb";
import { DirectoryWizardChrome } from "@/components/directory/DirectoryWizardChrome";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { DirectoryDocumentsPanel } from "@/components/directory/DirectoryDocumentsPanel";
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
  firstIncompleteOnboardStep,
  type EmployeeOnboardStepId,
} from "@/lib/directory/onboard";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { canEmployeeSection } from "@/lib/access/employee-sections";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { formatDailyRateInput } from "@/lib/ph-payroll/rate-precision";
import { toast } from "sonner";

type Rel = { id: string; name?: string; job_title?: string } | null;

type Employee = {
  id: string;
  last_name: string;
  first_name: string;
  middle_name: string | null;
  sex: string | null;
  birth_date: string | null;
  hire_date: string | null;
  mobile: string | null;
  address: string | null;
  tin: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tax_status: string | null;
  branch_id?: string | null;
  position_id?: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  gcash: string | null;
  pay_through: string | null;
  client_id: string | null;
  client: Rel;
  branch: Rel;
  position: Rel;
};

type Option = { id: string; label: string };

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

export default function EmployeeOnboardPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const clientId = typeof params.clientId === "string" ? params.clientId : "";
  const employeeId =
    typeof params.employeeId === "string" ? params.employeeId : "";
  const { employeeSections } = usePermissions();
  const { canAccessSalaryInfo } = useUserRole();
  const allowedSteps = useMemo(() => {
    return EMPLOYEE_ONBOARD_STEPS.filter((step) => {
      if (step.id === "identity" || step.id === "assignment") {
        return canEmployeeSection(employeeSections, "core");
      }
      if (step.id === "government") {
        return canEmployeeSection(employeeSections, "government_ids");
      }
      if (step.id === "documents") {
        return canEmployeeSection(employeeSections, "documents");
      }
      if (step.id === "pay") {
        return canEmployeeSection(employeeSections, "pay_channel");
      }
      return false;
    });
  }, [employeeSections]);
  const [orgId, setOrgId] = useState("");
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [stepId, setStepId] = useState<EmployeeOnboardStepId>("identity");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Option[]>([]);
  const [positions, setPositions] = useState<Option[]>([]);
  const [form, setForm] = useState({
    birth_date: "",
    sex: "",
    mobile: "",
    address: "",
    hire_date: "",
    branch_id: "",
    position_id: "",
    daily_rate: "",
    billing_daily_rate: "",
    tin: "",
    sss_number: "",
    philhealth_number: "",
    pagibig_number: "",
    tax_status: "",
    pay_through: "",
    bank_name: "",
    bank_account_no: "",
    gcash: "",
  });

  const fileHref = `/people/c/${clientId}/${employeeId}`;

  const load = useCallback(async () => {
    const org = await ensureDirectoryOrgId();
    setOrgId(org);
    const json = await directoryJson<{ data: Employee }>(
      `/api/directory/employees/${employeeId}`,
      org
    );
    const emp = json.data;
    setEmployee(emp);
    if (emp.client?.name) {
      writeDirectoryClient({
        id: emp.client_id ?? clientId,
        name: emp.client.name,
      });
    }
    setForm({
      birth_date: emp.birth_date ?? "",
      sex: emp.sex ?? "",
      mobile: emp.mobile ?? "",
      address: emp.address ?? "",
      hire_date: emp.hire_date ?? "",
      branch_id: emp.branch?.id ?? emp.branch_id ?? "",
      position_id: emp.position?.id ?? emp.position_id ?? "",
      daily_rate: formatDailyRateInput(emp.daily_rate),
      billing_daily_rate: formatDailyRateInput(emp.billing_daily_rate),
      tin: emp.tin ?? "",
      sss_number: emp.sss_number ?? "",
      philhealth_number: emp.philhealth_number ?? "",
      pagibig_number: emp.pagibig_number ?? "",
      tax_status: emp.tax_status ?? "",
      pay_through: emp.pay_through ?? "",
      bank_name: emp.bank_name ?? "",
      bank_account_no: emp.bank_account_no ?? "",
      gcash: emp.gcash ?? "",
    });
    const requested = searchParams.get("step") as EmployeeOnboardStepId | null;
    if (requested && EMPLOYEE_ONBOARD_STEPS.some((s) => s.id === requested)) {
      setStepId(requested);
    } else {
      setStepId(firstIncompleteOnboardStep(emp) ?? "identity");
    }
    const [branchJson, positionJson] = await Promise.all([
      directoryJson<{ data: Array<{ id: string; name: string }> }>(
        `/api/directory/clients/${emp.client_id ?? clientId}/branches`,
        org
      ),
      directoryJson<{ data: Array<{ id: string; job_title: string }> }>(
        `/api/directory/positions?client_id=${encodeURIComponent(emp.client_id ?? clientId)}`,
        org
      ),
    ]);
    setBranches(
      (branchJson.data ?? []).map((row) => ({ id: row.id, label: row.name }))
    );
    setPositions(
      (positionJson.data ?? []).map((row) => ({
        id: row.id,
        label: row.job_title,
      }))
    );
  }, [clientId, employeeId, searchParams]);

  useEffect(() => {
    void load().catch((err) => {
      setError(err instanceof Error ? err.message : "Failed to load 201");
    });
  }, [load]);

  useEffect(() => {
    if (allowedSteps.length === 0) return;
    if (!allowedSteps.some((s) => s.id === stepId)) {
      setStepId(allowedSteps[0]!.id);
    }
  }, [allowedSteps, stepId]);

  const stepIndex = allowedSteps.findIndex((s) => s.id === stepId);

  const patchForStep = useMemo(() => {
    if (stepId === "identity") {
      return {
        birth_date: form.birth_date || null,
        sex: form.sex || null,
        mobile: form.mobile || null,
        address: form.address || null,
      };
    }
    if (stepId === "assignment") {
      return {
        hire_date: form.hire_date || null,
        branch_id: form.branch_id || null,
        position_id: form.position_id || null,
        ...(canAccessSalaryInfo
          ? {
              daily_rate:
                form.daily_rate === "" ? null : Number(form.daily_rate),
              billing_daily_rate:
                form.billing_daily_rate === ""
                  ? null
                  : Number(form.billing_daily_rate),
            }
          : {}),
      };
    }
    if (stepId === "government") {
      return {
        tin: form.tin || null,
        sss_number: form.sss_number || null,
        philhealth_number: form.philhealth_number || null,
        pagibig_number: form.pagibig_number || null,
        tax_status: form.tax_status || null,
      };
    }
    if (stepId === "pay") {
      return {
        pay_through: form.pay_through || null,
        bank_name: form.bank_name || null,
        bank_account_no: form.bank_account_no || null,
        gcash: form.gcash || null,
      };
    }
    return null;
  }, [form, stepId, canAccessSalaryInfo]);

  async function saveStep() {
    if (!orgId || !patchForStep) return;
    await directoryJson(`/api/directory/employees/${employeeId}`, orgId, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patchForStep),
    });
  }

  function goFile() {
    router.push(fileHref);
  }

  async function goNext(opts: { skip?: boolean; finish?: boolean } = {}) {
    setSaving(true);
    setError(null);
    try {
      if (!opts.skip && patchForStep) {
        await saveStep();
      }
      if (opts.finish || stepIndex >= allowedSteps.length - 1) {
        toast.success("201 updated");
        goFile();
        return;
      }
      const next = allowedSteps[stepIndex + 1];
      if (next) setStepId(next.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const displayName = employee
    ? `${employee.last_name}, ${employee.first_name}`
    : "Employee";

  return (
    <DashboardLayout>
      <div className={`${dbPageWrapper} w-full min-w-0 pb-24`}>
        <DashboardPageHeader
          above={
            <div className="space-y-1">
              <HubBackLink href={fileHref} label="201 file" />
              <DirectoryBreadcrumb
                items={[
                  { label: "People", href: "/people" },
                  { label: "Roster", href: `/people/c/${clientId}` },
                  { label: displayName, href: fileHref },
                  { label: "Onboard" },
                ]}
              />
            </div>
          }
          title="Onboard 201"
          description="Save each step. Skip anything you will backfill before the next payroll Build."
          actions={
            <Button type="button" variant="outline" asChild>
              <Link href={fileHref}>Open 201</Link>
            </Button>
          }
        />

        {!employee ? (
          <p className="text-sm text-muted-foreground">
            {error ?? "Loading…"}
          </p>
        ) : (
          <DirectoryWizardChrome
            steps={allowedSteps.map((step) => ({
              id: step.id,
              label: step.label,
              description: step.description,
            }))}
            currentId={stepId}
            saving={saving}
            error={error}
            onBack={
              stepIndex > 0
                ? () => setStepId(allowedSteps[stepIndex - 1]!.id)
                : undefined
            }
            onSkip={() => void goNext({ skip: true })}
            onFinishLater={() => void goNext({ finish: true })}
            onContinue={() => void goNext()}
          >
            {stepId === "identity" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Birth date" htmlFor="onb-birth">
                  <Input
                    id="onb-birth"
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
                <Field label="Mobile" htmlFor="onb-mobile">
                  <Input
                    id="onb-mobile"
                    value={form.mobile}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, mobile: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Address" htmlFor="onb-address">
                  <Input
                    id="onb-address"
                    autoCapitalizeWords
                    value={form.address}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, address: e.target.value }))
                    }
                  />
                </Field>
              </div>
            ) : null}

            {stepId === "assignment" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Hire date" htmlFor="onb-hire">
                  <Input
                    id="onb-hire"
                    type="date"
                    value={form.hire_date}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, hire_date: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Branch">
                  <Select
                    value={form.branch_id || "__none__"}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        branch_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Branch" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No branch</SelectItem>
                      {branches.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Position">
                  <Select
                    value={form.position_id || "__none__"}
                    onValueChange={(value) =>
                      setForm((f) => ({
                        ...f,
                        position_id: value === "__none__" ? "" : value,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Position" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No position</SelectItem>
                      {positions.map((row) => (
                        <SelectItem key={row.id} value={row.id}>
                          {row.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {canAccessSalaryInfo ? (
                  <>
                <Field label="Daily rate (payroll)" htmlFor="onb-rate">
                  <Input
                    id="onb-rate"
                    type="number"
                    value={form.daily_rate}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, daily_rate: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Daily rate (billing)" htmlFor="onb-bill">
                  <Input
                    id="onb-bill"
                    type="number"
                    value={form.billing_daily_rate}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        billing_daily_rate: e.target.value,
                      }))
                    }
                  />
                </Field>
                  </>
                ) : null}
              </div>
            ) : null}

            {stepId === "government" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["sss_number", "SSS"],
                    ["tin", "TIN"],
                    ["philhealth_number", "PhilHealth"],
                    ["pagibig_number", "Pag-IBIG"],
                    ["tax_status", "Tax status"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`onb-${key}`}>
                    <Input
                      id={`onb-${key}`}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : null}

            {stepId === "documents" && orgId ? (
              <DirectoryDocumentsPanel
                organizationId={orgId}
                employeeId={employeeId}
                compact
              />
            ) : null}

            {stepId === "pay" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {(
                  [
                    ["pay_through", "Pay through"],
                    ["bank_name", "Bank"],
                    ["bank_account_no", "Account number"],
                    ["gcash", "GCash"],
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} label={label} htmlFor={`onb-${key}`}>
                    <Input
                      id={`onb-${key}`}
                      value={form[key]}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, [key]: e.target.value }))
                      }
                    />
                  </Field>
                ))}
              </div>
            ) : null}
          </DirectoryWizardChrome>
        )}
      </div>
    </DashboardLayout>
  );
}
