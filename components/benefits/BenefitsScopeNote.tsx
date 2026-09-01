"use client";

import { cn } from "@/lib/utils";

type Scope = "loans" | "allowances" | "deductions" | "statutory";

const COPY: Record<
  Scope,
  { title: string; body: string; tone: "organic" | "office" | "master" }
> = {
  loans: {
    title: "Used by Organic payroll",
    body: "Open loan balances deduct when you build a cutoff register. Posting payroll marks the installment paid and reduces what remains.",
    tone: "organic",
  },
  allowances: {
    title: "Weekly Office payslips",
    body: "Manual transpo, load, and other allowances for the Office weekly payslip. Organic payroll does not use this screen—those earnings come from cutoff hours × rates.",
    tone: "office",
  },
  deductions: {
    title: "Weekly Office payslips",
    body: "Vale, agency loans, and manual overrides for Office weekly payslips. Organic SSS, PhilHealth, Pag-IBIG, and tax are calculated when you build the register—do not enter those amounts here.",
    tone: "office",
  },
  statutory: {
    title: "Membership numbers and TIN",
    body: "IDs for remittance and compliance, not contribution amounts. Amounts are calculated in Payroll when the register is built.",
    tone: "master",
  },
};

const toneClass: Record<(typeof COPY)[Scope]["tone"], string> = {
  organic: "border-primary/25 bg-primary/5",
  office: "border-amber-300/50 bg-amber-50",
  master: "border-border bg-muted/40",
};

export function BenefitsScopeNote({
  scope,
  className,
}: {
  scope: Scope;
  className?: string;
}) {
  const copy = COPY[scope];
  return (
    <div
      className={cn(
        "mb-4 rounded-md border px-3 py-2.5 sm:px-4",
        toneClass[copy.tone],
        className
      )}
      role="note"
    >
      <p className="text-pretty text-sm font-semibold leading-snug text-foreground">
        {copy.title}
      </p>
      <p className="mt-0.5 max-w-[65ch] text-pretty text-sm leading-normal text-muted-foreground">
        {copy.body}
      </p>
    </div>
  );
}
