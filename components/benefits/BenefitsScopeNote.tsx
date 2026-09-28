"use client";

import { cn } from "@/lib/utils";

type Scope = "loans" | "allowances" | "deductions" | "refunds" | "statutory";

const COPY: Record<
  Scope,
  { title: string; body: string; tone: "organic" | "office" | "master" }
> = {
  loans: {
    title: "Used by cutoff payroll",
    body: "Open loan balances deduct when you build a cutoff register for that Client — Organic house or a Deployed site. Posting payroll marks the installment paid and reduces what remains.",
    tone: "organic",
  },
  allowances: {
    title: "Standing register allowances",
    body: "Pick Client, then employee. Deployed gets TL allowance (Epicurean, PLK). Organic gets Load and Supervisory. Amounts apply when you build the payroll register.",
    tone: "organic",
  },
  deductions: {
    title: "Standing other deductions on the register",
    body: "Pick Client, then employee. Deployed gets Personal Accident, BDO Insurance, HMO, Uniform, Nameplate, and ID. Organic gets Personal Accident, BDO Insurance, and HMO only. Amounts apply when you build the payroll register.",
    tone: "organic",
  },
  refunds: {
    title: "Cutoff refund on the register",
    body: "Pick Client, cutoff, then employee. The amount applies only when you build that cutoff’s payroll register (earnings adjustment / Refund column).",
    tone: "organic",
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
