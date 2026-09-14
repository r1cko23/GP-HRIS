"use client";

import { HubLanding } from "@/components/hubs/HubLanding";

export default function TimeHubPage() {
  return (
    <HubLanding
      hubId="time"
      fallback="/time/overtime"
      description="Attendance, leave, overtime, and clock enrollment."
    />
  );
}
