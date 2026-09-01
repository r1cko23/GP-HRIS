"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function BenefitsHubPage() {
  return <HubLanding hubId="benefits" fallback="/benefits/loans" />;
}
