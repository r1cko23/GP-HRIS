"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { directoryJson } from "@/lib/directory/browser";
import { nextAssignmentFormRates } from "@/lib/directory/assignment-rates";
import {
  CIVIL_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  EMPLOYMENT_TYPE_OPTIONS,
  defaultContractType,
  employmentNeedsContractEnd,
  employmentNeedsRegularDate,
} from "@/lib/directory/employment-fields";
import {
  EMPLOYEE_STATUSES,
  directoryStatusMeta,
} from "@/lib/directory/employees";
import type { CompletenessEditGroup } from "@/components/directory/DirectoryLifecyclePanel";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { canEmployeeSection } from "@/lib/access/employee-sections";
import { formatDailyRateInput } from "@/lib/ph-payroll/rate-precision";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Rel = {
  id: string;
  name?: string;
  job_title?: string;
} | null;

export type DirectoryEditEmployee = {
  id: string;
  client_id: string | null;
  status: string;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  sex?: string | null;
  birth_date?: string | null;
  hire_date?: string | null;
  regular_date?: string | null;
  employment_type?: string | null;
  contract_type?: string | null;
  contract_end_date?: string | null;
  civil_status?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  position_id?: string | null;
  email: string | null;
  mobile: string | null;
  address: string | null;
  tin: string | null;
  sss_number: string | null;
  philhealth_number: string | null;
  pagibig_number: string | null;
  tax_status: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  gcash: string | null;
  pay_through: string | null;
  daily_rate: number | string | null;
  billing_daily_rate: number | string | null;
  ecola: number | string | null;
  branch: Rel;
  position: Rel;
};

type Option = { id: string; label: string };

type PositionOption = Option & {
  payroll_daily_rate?: number | string | null;
  billing_daily_rate?: number | string | null;
};

type Props = {
  organizationId: string;
  employee: DirectoryEditEmployee;
  onSaved: (employee: DirectoryEditEmployee) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  focusGroup?: CompletenessEditGroup | null;
};

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function Section({
  id,
  title,
  focused,
  children,
}: {
  id: string;
  title: string;
  focused?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-4 space-y-3 rounded-md border p-3 sm:col-span-2",
        focused
          ? "border-primary/40 bg-primary/5"
          : "border-transparent bg-transparent p-0 sm:p-0"
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export function DirectoryEmployeeEditPanel({
  organizationId,
  employee,
  onSaved,
  open: controlledOpen,
  onOpenChange,
  focusGroup = null,
}: Props) {
  const { isAdmin, isHR, canAccessSalaryInfo } = useUserRole();
  const { employeeSections } = usePermissions();
  const canEdit = isAdmin || isHR;
  const showCore = canEmployeeSection(employeeSections, "core");
  const showGov = canEmployeeSection(employeeSections, "government_ids");
  const showPayChannel = canEmployeeSection(employeeSections, "pay_channel");
  const showSalary = canAccessSalaryInfo;
  const showPaySection = showPayChannel || showSalary;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Option[]>([]);
  const [departments, setDepartments] = useState<Option[]>([]);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    status: employee.status,
    last_name: employee.last_name ?? "",
    first_name: employee.first_name ?? "",
    middle_name: employee.middle_name ?? "",
    sex: employee.sex ?? "",
    birth_date: employee.birth_date ?? "",
    hire_date: employee.hire_date ?? "",
    regular_date: employee.regular_date ?? "",
    employment_type: employee.employment_type ?? "",
    contract_type: employee.contract_type ?? "",
    contract_end_date: employee.contract_end_date ?? "",
    civil_status: employee.civil_status ?? "",
    branch_id: employee.branch?.id ?? employee.branch_id ?? "",
    department_id: employee.department_id ?? "",
    position_id: employee.position?.id ?? employee.position_id ?? "",
    email: employee.email ?? "",
    mobile: employee.mobile ?? "",
    address: employee.address ?? "",
    tin: employee.tin ?? "",
    sss_number: employee.sss_number ?? "",
    philhealth_number: employee.philhealth_number ?? "",
    pagibig_number: employee.pagibig_number ?? "",
    tax_status: employee.tax_status ?? "",
    bank_name: employee.bank_name ?? "",
    bank_account_no: employee.bank_account_no ?? "",
    gcash: employee.gcash ?? "",
    pay_through: employee.pay_through ?? "",
    daily_rate: formatDailyRateInput(employee.daily_rate),
    billing_daily_rate: formatDailyRateInput(employee.billing_daily_rate),
    ecola: employee.ecola != null ? String(employee.ecola) : "",
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      status: employee.status,
      last_name: employee.last_name ?? "",
      first_name: employee.first_name ?? "",
      middle_name: employee.middle_name ?? "",
      sex: employee.sex ?? "",
      birth_date: employee.birth_date ?? "",
      hire_date: employee.hire_date ?? "",
      regular_date: employee.regular_date ?? "",
      employment_type: employee.employment_type ?? "",
      contract_type: employee.contract_type ?? "",
      contract_end_date: employee.contract_end_date ?? "",
      civil_status: employee.civil_status ?? "",
      branch_id: employee.branch?.id ?? employee.branch_id ?? "",
      department_id: employee.department_id ?? "",
      position_id: employee.position?.id ?? employee.position_id ?? "",
      email: employee.email ?? "",
      mobile: employee.mobile ?? "",
      address: employee.address ?? "",
      tin: employee.tin ?? "",
      sss_number: employee.sss_number ?? "",
      philhealth_number: employee.philhealth_number ?? "",
      pagibig_number: employee.pagibig_number ?? "",
      tax_status: employee.tax_status ?? "",
      bank_name: employee.bank_name ?? "",
      bank_account_no: employee.bank_account_no ?? "",
      gcash: employee.gcash ?? "",
      pay_through: employee.pay_through ?? "",
      daily_rate: formatDailyRateInput(employee.daily_rate),
      billing_daily_rate: formatDailyRateInput(employee.billing_daily_rate),
      ecola: employee.ecola != null ? String(employee.ecola) : "",
    });
  }, [open, employee]);

  useEffect(() => {
    if (!open || !employee.client_id) return;
    const clientId = employee.client_id;
    let cancelled = false;
    void (async () => {
      try {
        const [branchJson, deptJson, posJson] = await Promise.all([
          directoryJson<{
            data: Array<{ id: string; name: string }>;
          }>(`/api/directory/clients/${clientId}/branches`, organizationId),
          directoryJson<{
            data: Array<{ id: string; name: string }>;
          }>(
            `/api/directory/clients/${clientId}/departments?${new URLSearchParams({
              limit: "200",
              offset: "0",
            })}`,
            organizationId
          ),
          directoryJson<{
            data: Array<{
              id: string;
              job_title: string;
              payroll_daily_rate?: number | string | null;
              billing_daily_rate?: number | string | null;
            }>;
          }>(
            `/api/directory/positions?${new URLSearchParams({
              client_id: clientId,
              approved_only: "1",
              limit: "200",
            })}`,
            organizationId
          ),
        ]);
        if (cancelled) return;
        setBranches(
          (branchJson.data ?? []).map((row) => ({
            id: row.id,
            label: row.name,
          }))
        );
        setDepartments(
          (deptJson.data ?? []).map((row) => ({
            id: row.id,
            label: row.name,
          }))
        );
        const approved = (posJson.data ?? []).map((row) => ({
          id: row.id,
          label: row.job_title,
          payroll_daily_rate: row.payroll_daily_rate,
          billing_daily_rate: row.billing_daily_rate,
        }));
        const currentId =
          employee.position?.id ?? employee.position_id ?? "";
        const currentTitle = employee.position?.job_title?.trim();
        if (
          currentId &&
          currentTitle &&
          !approved.some((row) => row.id === currentId)
        ) {
          setPositions([
            { id: currentId, label: `${currentTitle} (current)` },
            ...approved,
          ]);
        } else {
          setPositions(approved);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load options");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, employee.client_id, organizationId]);

  useEffect(() => {
    if (!open || !form.position_id) return;
    const card = positions.find((row) => row.id === form.position_id);
    if (!card) return;
    const next = nextAssignmentFormRates({
      positionChanged: false,
      currentDailyRate: form.daily_rate,
      card,
    });
    if (
      next.daily_rate === form.daily_rate &&
      next.billing_daily_rate === form.billing_daily_rate
    ) {
      return;
    }
    setForm((current) => ({
      ...current,
      daily_rate: next.daily_rate,
      billing_daily_rate: next.billing_daily_rate,
    }));
  }, [
    form.billing_daily_rate,
    form.daily_rate,
    form.position_id,
    open,
    positions,
  ]);

  useEffect(() => {
    if (!open || !focusGroup) return;
    const id = `edit-section-${focusGroup}`;
    const t = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
    return () => window.clearTimeout(t);
  }, [open, focusGroup]);

  if (!canEdit) return null;

  async function save() {
    const payload: Record<string, unknown> = {};
    if (showCore) {
      const lastName = form.last_name.trim();
      const firstName = form.first_name.trim();
      if (!lastName || !firstName) {
        setError("Last name and first name are required");
        toast.error("Last name and first name are required");
        return;
      }
      Object.assign(payload, {
        status: form.status,
        last_name: lastName,
        first_name: firstName,
        middle_name: form.middle_name.trim() || null,
        sex: form.sex || null,
        birth_date: form.birth_date || null,
        hire_date: form.hire_date || null,
        regular_date: form.regular_date || null,
        employment_type: form.employment_type || null,
        contract_type: form.contract_type || null,
        contract_end_date: form.contract_end_date || null,
        civil_status: form.civil_status || null,
        branch_id: form.branch_id || null,
        department_id: form.department_id || null,
        position_id: form.position_id || null,
        email: form.email || null,
        mobile: form.mobile || null,
        address: form.address || null,
      });
    }
    if (showGov) {
      Object.assign(payload, {
        tin: form.tin || null,
        sss_number: form.sss_number || null,
        philhealth_number: form.philhealth_number || null,
        pagibig_number: form.pagibig_number || null,
        tax_status: form.tax_status || null,
      });
    }
    if (showPayChannel) {
      Object.assign(payload, {
        bank_name: form.bank_name || null,
        bank_account_no: form.bank_account_no || null,
        gcash: form.gcash || null,
        pay_through: form.pay_through || null,
      });
    }
    if (showSalary) {
      Object.assign(payload, {
        daily_rate: form.daily_rate === "" ? null : Number(form.daily_rate),
        billing_daily_rate:
          form.billing_daily_rate === ""
            ? null
            : Number(form.billing_daily_rate),
        ecola: form.ecola === "" ? null : Number(form.ecola),
      });
    }
    if (Object.keys(payload).length === 0) {
      setError("No editable sections granted");
      toast.error("No editable sections granted");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const json = await directoryJson<{ data: DirectoryEditEmployee }>(
        `/api/directory/employees/${employee.id}`,
        organizationId,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      toast.success("201 fields saved");
      onSaved(json.data);
      setOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Save failed";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        Edit 201 fields
      </Button>
    );
  }

  return (
    <Card ref={panelRef} className="border-primary/30 sm:col-span-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Edit Directory record</CardTitle>
        <CardDescription>
          Legal name is last, first, and middle — same as GREENHRISMAIN. Jr/Sr
          stays in last name. Does not change bundy clock access.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {showCore ? (
          <>
          <Section
            id="edit-section-assignment"
            title="Assignment"
            focused={focusGroup === "assignment"}
          >
            <Field label="Status">
              <Select
                value={form.status}
                onValueChange={(value) =>
                  setForm((f) => ({ ...f, status: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {directoryStatusMeta(status).label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <Field label="Store">
              <Select
                value={form.department_id || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    department_id: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Store" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No store</SelectItem>
                  {departments.map((row) => (
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
                onValueChange={(value) => {
                  if (value === "__none__") {
                    setForm((f) => ({
                      ...f,
                      position_id: "",
                      ...nextAssignmentFormRates({
                        positionChanged: true,
                        currentDailyRate: f.daily_rate,
                        card: null,
                      }),
                    }));
                    return;
                  }
                  const card = positions.find((p) => p.id === value);
                  setForm((f) => ({
                    ...f,
                    position_id: value,
                    ...nextAssignmentFormRates({
                      positionChanged: true,
                      currentDailyRate: f.daily_rate,
                      card: card ?? null,
                    }),
                  }));
                }}
              >
                <SelectTrigger id="dir-edit-position">
                  <SelectValue placeholder="Approved position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Select position</SelectItem>
                  {positions.map((row) => (
                    <SelectItem key={row.id} value={row.id}>
                      {row.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {employee.client_id && positions.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No approved position cards for this client.{" "}
                  <Link
                    href={`/people/c/${employee.client_id}/positions`}
                    className="underline underline-offset-2"
                  >
                    Create and approve one
                  </Link>{" "}
                  first.
                </p>
              ) : null}
            </Field>
          </Section>

          <Section
            id="edit-section-identity"
            title="Identity & contact"
            focused={focusGroup === "identity"}
          >
            <Field label="Last name *">
              <Input
                id="dir-edit-last"
                required
                autoCapitalizeWords
                autoComplete="family-name"
                value={form.last_name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, last_name: event.target.value }))
                }
              />
            </Field>
            <Field label="First name *">
              <Input
                id="dir-edit-first"
                required
                autoCapitalizeWords
                autoComplete="given-name"
                value={form.first_name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, first_name: event.target.value }))
                }
              />
            </Field>
            <Field label="Middle name">
              <Input
                id="dir-edit-middle"
                autoCapitalizeWords
                autoComplete="additional-name"
                value={form.middle_name}
                onChange={(event) =>
                  setForm((f) => ({ ...f, middle_name: event.target.value }))
                }
              />
            </Field>
            <Field label="Birth date">
              <Input
                type="date"
                value={form.birth_date}
                onChange={(event) =>
                  setForm((f) => ({ ...f, birth_date: event.target.value }))
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
            <Field label="Hire date">
              <Input
                type="date"
                value={form.hire_date}
                onChange={(event) =>
                  setForm((f) => ({ ...f, hire_date: event.target.value }))
                }
              />
            </Field>
            <Field label="Employment type">
              <Select
                value={form.employment_type || "__none__"}
                onValueChange={(value) => {
                  const next = value === "__none__" ? "" : value;
                  setForm((f) => {
                    const autoPaired =
                      !f.contract_type ||
                      f.contract_type ===
                        defaultContractType(f.employment_type);
                    return {
                      ...f,
                      employment_type: next,
                      contract_type: autoPaired
                        ? defaultContractType(next) ?? ""
                        : f.contract_type,
                    };
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Employment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {EMPLOYMENT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  {form.employment_type &&
                  !(EMPLOYMENT_TYPE_OPTIONS as readonly string[]).includes(
                    form.employment_type
                  ) ? (
                    <SelectItem value={form.employment_type}>
                      {form.employment_type}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Contract type">
              <Select
                value={form.contract_type || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    contract_type: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Contract type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {CONTRACT_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  {form.contract_type &&
                  !(CONTRACT_TYPE_OPTIONS as readonly string[]).includes(
                    form.contract_type
                  ) ? (
                    <SelectItem value={form.contract_type}>
                      {form.contract_type}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
            {employmentNeedsContractEnd(form.employment_type) ||
            form.contract_end_date ? (
              <Field label="Contract end">
                <Input
                  type="date"
                  value={form.contract_end_date}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      contract_end_date: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}
            {employmentNeedsRegularDate(form.employment_type) ||
            form.regular_date ? (
              <Field label="Regular date">
                <Input
                  type="date"
                  value={form.regular_date}
                  onChange={(event) =>
                    setForm((f) => ({
                      ...f,
                      regular_date: event.target.value,
                    }))
                  }
                />
              </Field>
            ) : null}
            <Field label="Civil status">
              <Select
                value={form.civil_status || "__none__"}
                onValueChange={(value) =>
                  setForm((f) => ({
                    ...f,
                    civil_status: value === "__none__" ? "" : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Civil status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not set</SelectItem>
                  {CIVIL_STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                  {form.civil_status &&
                  !(CIVIL_STATUS_OPTIONS as readonly string[]).includes(
                    form.civil_status
                  ) ? (
                    <SelectItem value={form.civil_status}>
                      {form.civil_status}
                    </SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </Field>
            {(
              [
                ["email", "Email", false],
                ["mobile", "Mobile", false],
                ["address", "Address", true],
              ] as const
            ).map(([key, label, capitalize]) => (
              <Field key={key} label={label}>
                <Input
                  autoCapitalizeWords={capitalize}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, [key]: event.target.value }))
                  }
                />
              </Field>
            ))}
          </Section>
          </>
          ) : null}

          {showGov ? (
          <Section
            id="edit-section-government"
            title="Government IDs"
            focused={focusGroup === "government"}
          >
            {(
              [
                ["tin", "TIN", false],
                ["sss_number", "SSS", false],
                ["philhealth_number", "PhilHealth", false],
                ["pagibig_number", "Pag-IBIG", false],
                ["tax_status", "Tax status", true],
              ] as const
            ).map(([key, label, capitalize]) => (
              <Field key={key} label={label}>
                <Input
                  autoCapitalizeWords={capitalize}
                  value={form[key]}
                  onChange={(event) =>
                    setForm((f) => ({ ...f, [key]: event.target.value }))
                  }
                />
              </Field>
            ))}
          </Section>
          ) : null}

          {showPaySection ? (
          <Section
            id="edit-section-pay"
            title="Pay channel & rates"
            focused={focusGroup === "pay"}
          >
            {showPayChannel
              ? (
                  [
                    ["pay_through", "Pay through", true],
                    ["bank_name", "Bank", true],
                    ["bank_account_no", "Account", false],
                    ["gcash", "GCash", false],
                  ] as const
                ).map(([key, label, capitalize]) => (
                  <Field key={key} label={label}>
                    <Input
                      autoCapitalizeWords={capitalize}
                      value={form[key]}
                      onChange={(event) =>
                        setForm((f) => ({ ...f, [key]: event.target.value }))
                      }
                    />
                  </Field>
                ))
              : null}
            {showSalary ? (
              <>
                <Field label="Daily rate (payroll)">
                  <Input
                    id="dir-edit-rate"
                    type="number"
                    value={form.daily_rate}
                    onChange={(event) =>
                      setForm((f) => ({
                        ...f,
                        daily_rate: event.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Daily rate (billing)">
                  <Input
                    id="dir-edit-bill"
                    value={form.billing_daily_rate}
                    readOnly
                    aria-readonly="true"
                    tabIndex={-1}
                    className="bg-muted/60"
                  />
                  <p className="text-xs text-muted-foreground">
                    From the approved position.
                  </p>
                </Field>
                <Field label="ECOLA">
                  <Input
                    id="dir-edit-ecola"
                    type="number"
                    value={form.ecola}
                    onChange={(event) =>
                      setForm((f) => ({ ...f, ecola: event.target.value }))
                    }
                  />
                </Field>
              </>
            ) : null}
          </Section>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={saving}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
