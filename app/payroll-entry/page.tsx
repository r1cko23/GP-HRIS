"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** Legacy URL — payroll runs live at /payroll (Addbell-style batch flow). */
export default function PayrollEntryRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    const runId = searchParams.get("run_id");
    const period = searchParams.get("period");
    if (runId) params.set("run_id", runId);
    if (period) params.set("period", period);
    const qs = params.toString();
    router.replace(qs ? `/payroll?${qs}` : "/payroll");
  }, [router, searchParams]);

  return null;
}
