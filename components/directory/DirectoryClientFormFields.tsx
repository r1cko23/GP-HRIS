"use client";

import { useId } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { DirectoryClientFormData } from "@/lib/directory/client-form";

type Props = {
  form: DirectoryClientFormData;
  onChange: (next: DirectoryClientFormData) => void;
  disabled?: boolean;
};

const SECTIONS = [
  { id: "identity", label: "Identity" },
  { id: "contact", label: "Contact" },
  { id: "pay", label: "Pay calendar" },
  { id: "statutory", label: "Statutory" },
  { id: "billing", label: "Billing" },
] as const;

function Field({
  label,
  htmlFor,
  children,
  className,
  hint,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {children}
      {hint ? (
        <p className="text-xs leading-snug text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="scroll-mt-28 space-y-4 border-b border-border/70 pb-8 last:border-b-0 last:pb-0"
    >
      <div className="space-y-1">
        <h2
          id={`${id}-heading`}
          className="text-base font-semibold tracking-tight text-foreground"
        >
          {title}
        </h2>
        {description ? (
          <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DayInput({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  disabled?: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={1}
        max={31}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="tabular-nums"
        placeholder="1–31"
      />
    </Field>
  );
}

export function DirectoryClientFormFields({
  form,
  onChange,
  disabled,
}: Props) {
  const navId = useId();
  const set = <K extends keyof DirectoryClientFormData>(
    key: K,
    value: DirectoryClientFormData[K]
  ) => onChange({ ...form, [key]: value });

  return (
    <div className="space-y-6">
      <nav
        aria-label="Client form sections"
        className="sticky top-0 z-10 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            id={`${navId}-${section.id}`}
            className="shrink-0 rounded-md border border-transparent px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {section.label}
          </a>
        ))}
      </nav>

      <Section
        id="identity"
        title="Identity"
        description="How this client appears on rosters, cutoffs, and payroll."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Company name" htmlFor="client-name" className="sm:col-span-2">
            <Input
              id="client-name"
              required
              disabled={disabled}
              autoCapitalizeWords
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Legal or trade name"
              autoComplete="organization"
              className="text-base font-medium"
            />
          </Field>

          <div className="space-y-1.5">
            <span className="text-sm font-medium text-foreground">Status</span>
            <div
              className="grid grid-cols-2 gap-1 rounded-md border border-border bg-muted/40 p-1"
              role="group"
              aria-label="Client status"
            >
              {(
                [
                  ["active", "Active"],
                  ["inactive", "Inactive"],
                ] as const
              ).map(([value, label]) => {
                const selected = form.status === value;
                return (
                  <button
                    key={value}
                    type="button"
                    disabled={disabled}
                    aria-pressed={selected}
                    onClick={() => set("status", value)}
                    className={cn(
                      "min-h-10 rounded-md px-3 text-sm font-medium transition-colors",
                      selected
                        ? value === "active"
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:bg-background hover:text-foreground"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label="TIN" htmlFor="client-tin">
            <Input
              id="client-tin"
              disabled={disabled}
              value={form.tin}
              onChange={(e) => set("tin", e.target.value)}
              placeholder="000-000-000-000"
              className="tabular-nums"
            />
          </Field>

          <label className="flex items-start gap-3 rounded-md border border-border px-3 py-3 sm:col-span-2">
            <input
              type="checkbox"
              className="mt-1"
              disabled={disabled}
              checked={form.bundy_enabled}
              onChange={(e) => set("bundy_enabled", e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium text-foreground">
                Bundy enabled
              </span>
              <span className="block text-xs text-muted-foreground">
                Auto-enroll Clock / portal rows after Directory hire or rehire on
                this client.
              </span>
            </span>
          </label>

          <Field label="Pay frequency" htmlFor="client-freq">
            <Select
              value={form.pay_frequency || "semi-monthly"}
              onValueChange={(v) =>
                set(
                  "pay_frequency",
                  v === "weekly" || v === "monthly" || v === "semi-monthly"
                    ? v
                    : "semi-monthly"
                )
              }
              disabled={disabled}
            >
              <SelectTrigger id="client-freq">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="semi-monthly">Semi-monthly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <Section
        id="contact"
        title="Contact"
        description="People and channels your ops team uses day to day."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person" htmlFor="client-contact">
            <Input
              id="client-contact"
              disabled={disabled}
              autoCapitalizeWords
              value={form.contact_person}
              onChange={(e) => set("contact_person", e.target.value)}
              autoComplete="name"
            />
          </Field>
          <Field label="Email" htmlFor="client-email">
            <Input
              id="client-email"
              type="email"
              disabled={disabled}
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              autoComplete="email"
            />
          </Field>
          <Field label="Phone" htmlFor="client-phone">
            <Input
              id="client-phone"
              type="tel"
              disabled={disabled}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              autoComplete="tel"
            />
          </Field>
          <Field label="Address" htmlFor="client-address" className="sm:col-span-2">
            <Textarea
              id="client-address"
              disabled={disabled}
              autoCapitalizeWords
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={3}
              className="resize-y"
            />
          </Field>
        </div>
      </Section>

      <Section
        id="pay"
        title="Pay calendar"
        description="Cutoff day-of-month for each period in the pay cycle."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              First cutoff
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <DayInput
                id="client-cut1-start"
                label="Starts"
                value={form.cut1_start}
                disabled={disabled}
                onChange={(v) => set("cut1_start", v)}
              />
              <span
                className="mb-2.5 text-muted-foreground"
                aria-hidden
              >
                →
              </span>
              <DayInput
                id="client-cut1-end"
                label="Ends"
                value={form.cut1_end}
                disabled={disabled}
                onChange={(v) => set("cut1_end", v)}
              />
            </div>
          </div>
          <div className="rounded-md border border-border bg-muted/20 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">
              Second cutoff
            </p>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
              <DayInput
                id="client-cut2-start"
                label="Starts"
                value={form.cut2_start}
                disabled={disabled}
                onChange={(v) => set("cut2_start", v)}
              />
              <span
                className="mb-2.5 text-muted-foreground"
                aria-hidden
              >
                →
              </span>
              <DayInput
                id="client-cut2-end"
                label="Ends"
                value={form.cut2_end}
                disabled={disabled}
                onChange={(v) => set("cut2_end", v)}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        id="statutory"
        title="Statutory & tax"
        description="Deduction schedules and contribution bases for payroll runs."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Statutory schedule" htmlFor="client-stat">
            <Input
              id="client-stat"
              disabled={disabled}
              value={form.statutory_schedule}
              onChange={(e) => set("statutory_schedule", e.target.value)}
              placeholder="Which cutoff carries SSS / PhilHealth / Pag-IBIG"
            />
          </Field>
          <Field label="Withholding tax schedule" htmlFor="client-wtax-sched">
            <Input
              id="client-wtax-sched"
              disabled={disabled}
              value={form.wtax_schedule}
              onChange={(e) => set("wtax_schedule", e.target.value)}
            />
          </Field>
          <Field label="SSS basis" htmlFor="client-sss">
            <Input
              id="client-sss"
              disabled={disabled}
              value={form.sss_basis}
              onChange={(e) => set("sss_basis", e.target.value)}
            />
          </Field>
          <Field label="PhilHealth basis" htmlFor="client-ph">
            <Input
              id="client-ph"
              disabled={disabled}
              value={form.philhealth_basis}
              onChange={(e) => set("philhealth_basis", e.target.value)}
            />
          </Field>
          <Field label="WTAX basis" htmlFor="client-wtax">
            <Input
              id="client-wtax"
              disabled={disabled}
              value={form.wtax_basis}
              onChange={(e) => set("wtax_basis", e.target.value)}
            />
          </Field>
          <Field label="13th month year" htmlFor="client-13">
            <Input
              id="client-13"
              type="number"
              inputMode="numeric"
              disabled={disabled}
              value={form.thirteenth_month_year}
              onChange={(e) => set("thirteenth_month_year", e.target.value)}
              placeholder="e.g. 2026"
              className="tabular-nums"
            />
          </Field>
        </div>

        <div className="space-y-2 pt-1">
          <p className="text-sm font-medium text-foreground">
            Include in payroll base
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["include_cola", "COLA"],
                ["include_sea", "SEA"],
                ["include_ctpa", "CTPA"],
              ] as const
            ).map(([key, label]) => {
              const on = form[key];
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={on}
                  onClick={() => set(key, !on)}
                  className={cn(
                    "min-h-10 rounded-md border px-3 text-sm font-medium transition-colors",
                    on
                      ? "border-primary/40 bg-primary/10 text-foreground"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section
        id="billing"
        title="Billing rates"
        description="Fees applied when billing this client."
      >
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Admin fee" htmlFor="client-admin">
            <Input
              id="client-admin"
              type="number"
              step="0.0001"
              inputMode="decimal"
              disabled={disabled}
              value={form.admin_fee}
              onChange={(e) => set("admin_fee", e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="VAT" htmlFor="client-vat">
            <Input
              id="client-vat"
              type="number"
              step="0.0001"
              inputMode="decimal"
              disabled={disabled}
              value={form.vat}
              onChange={(e) => set("vat", e.target.value)}
              className="tabular-nums"
            />
          </Field>
          <Field label="EWT" htmlFor="client-ewt">
            <Input
              id="client-ewt"
              type="number"
              step="0.0001"
              inputMode="decimal"
              disabled={disabled}
              value={form.ewt}
              onChange={(e) => set("ewt", e.target.value)}
              className="tabular-nums"
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}

/** Live preview rail for create/edit pages */
export function DirectoryClientPreview({
  form,
  legacyId,
}: {
  form: DirectoryClientFormData;
  legacyId?: number | null;
}) {
  const freq =
    form.pay_frequency === "weekly"
      ? "Weekly"
      : form.pay_frequency === "monthly"
        ? "Monthly"
        : "Semi-monthly";

  const cut1 =
    form.cut1_start || form.cut1_end
      ? `${form.cut1_start || "—"} → ${form.cut1_end || "—"}`
      : null;
  const cut2 =
    form.cut2_start || form.cut2_end
      ? `${form.cut2_start || "—"} → ${form.cut2_end || "—"}`
      : null;

  return (
    <aside
      aria-label="Client summary"
      className="rounded-md border border-border bg-card p-5 shadow-card lg:sticky lg:top-20"
    >
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Preview
      </p>
      <p className="mt-2 text-xl font-semibold tracking-tight text-foreground text-balance">
        {form.name.trim() || "Untitled client"}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
            form.status === "active"
              ? "bg-primary/15 text-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {form.status === "active" ? "Active" : "Inactive"}
        </span>
        <span className="text-xs text-muted-foreground">{freq}</span>
      </div>

      <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
        <div>
          <dt className="text-muted-foreground">TIN</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-foreground">
            {form.tin.trim() || "—"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Contact</dt>
          <dd className="mt-0.5 font-medium text-foreground">
            {form.contact_person.trim() || "—"}
          </dd>
        </div>
        {(cut1 || cut2) && (
          <div>
            <dt className="text-muted-foreground">Cutoffs</dt>
            <dd className="mt-0.5 space-y-0.5 font-medium tabular-nums text-foreground">
              {cut1 ? <p>1st · {cut1}</p> : null}
              {cut2 ? <p>2nd · {cut2}</p> : null}
            </dd>
          </div>
        )}
        {legacyId != null ? (
          <div>
            <dt className="text-muted-foreground">Legacy id</dt>
            <dd className="mt-0.5 font-medium tabular-nums text-foreground">
              {legacyId}
            </dd>
          </div>
        ) : null}
      </dl>
    </aside>
  );
}
