"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  canPeopleClients,
  canPeopleEmployees,
  defaultPeopleSurface,
} from "@/lib/access/people-pages";

function PeopleRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    capabilityKeys: rawCapabilityKeys,
    canRead,
    loading,
  } = usePermissions();

  useEffect(() => {
    if (loading) return;
    const capabilityKeys =
      rawCapabilityKeys.length > 0
        ? rawCapabilityKeys
        : canRead("employees")
          ? ["page:employees"]
          : [];

    const queue = searchParams.get("queue");
    const tab = searchParams.get("tab");
    const org = searchParams.get("org");
    const q = searchParams.get("q");
    const status = searchParams.get("status");
    const offset = searchParams.get("offset");

    let surface = defaultPeopleSurface(capabilityKeys);
    if (tab === "clients" && canPeopleClients(capabilityKeys)) {
      surface = "clients";
    } else if (tab === "employees" && canPeopleEmployees(capabilityKeys)) {
      surface = "employees";
    } else if (
      queue &&
      [
        "for_verification",
        "needs_review",
        "missing_statutory",
        "missing_documents",
        "incomplete_201",
      ].includes(queue) &&
      canPeopleEmployees(capabilityKeys)
    ) {
      surface = "employees";
    } else if (
      queue &&
      ["clients", "pending_positions"].includes(queue) &&
      canPeopleClients(capabilityKeys)
    ) {
      surface = "clients";
    }

    if (!surface) {
      return;
    }

    const params = new URLSearchParams();
    if (org) params.set("org", org);
    if (q) params.set("q", q);
    if (offset) params.set("offset", offset);
    if (surface === "employees") {
      params.set(
        "queue",
        queue &&
          [
            "for_verification",
            "needs_review",
            "missing_statutory",
            "missing_documents",
            "incomplete_201",
          ].includes(queue)
          ? queue
          : "for_verification"
      );
    } else {
      params.set(
        "queue",
        queue && ["clients", "pending_positions"].includes(queue)
          ? queue
          : "clients"
      );
      if (status) params.set("status", status);
    }

    const base =
      surface === "employees" ? "/people/employees" : "/people/clients";
    const qs = params.toString();
    router.replace(qs ? `${base}?${qs}` : base);
  }, [canRead, loading, rawCapabilityKeys, router, searchParams]);

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader title="People" />
        <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function PeopleIndexPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className={dbPageWrapper}>
            <DashboardPageHeader title="People" />
            <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <PeopleRedirectInner />
    </Suspense>
  );
}
