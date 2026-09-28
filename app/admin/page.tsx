"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function AdminHubPage() {
  return (
    <HubLanding
      hubId="admin"
      fallback="/admin/overview"
      description="Dashboards, register, BIR, and audit tools."
    />
  );
}
