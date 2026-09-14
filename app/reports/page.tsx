"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function ReportsHubPage() {
  return (
    <HubLanding
      hubId="reports"
      fallback="/reports/overview"
      description="Dashboards, register, BIR, and audit tools."
    />
  );
}
