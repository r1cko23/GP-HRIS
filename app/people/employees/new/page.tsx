"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { DirectoryHireEmployeeWizard } from "@/components/directory/DirectoryHireEmployeeWizard";

function HubHireInner() {
  const searchParams = useSearchParams();
  const clientId = searchParams.get("client_id");
  const branchId = searchParams.get("branch_id");
  const name = searchParams.get("name");

  return (
    <DirectoryHireEmployeeWizard
      initialClientId={clientId}
      initialBranchId={branchId}
      initialPersonName={name}
      cancelHref="/people/employees"
      backHref="/people/employees"
      backLabel="Employees"
    />
  );
}

export default function HubHireEmployeePage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-muted-foreground">Loading…</p>
      }
    >
      <HubHireInner />
    </Suspense>
  );
}
