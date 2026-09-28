"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function BenefitsHubPage() {
  return (
    <HubLanding
      hubId="benefits"
      fallback="/benefits/loans"
      description="Loans, deductions, refunds, and extras on the register."
    />
  );
}
