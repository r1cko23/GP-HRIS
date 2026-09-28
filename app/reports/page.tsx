"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function ReportsHubPage() {
  return (
    <HubLanding
      hubId="reports"
      fallback="/reports/loans"
      description="Remittance and payroll reports. Deductions, allowances, and refunds are under Benefits."
    />
  );
}
