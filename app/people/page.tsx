"use client";

import { Suspense, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { resolvePeopleIndexSurface } from "@/lib/access/people-pages";

function PeopleRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    capabilityKeys: rawCapabilityKeys,
    canRead,
    loading,
  } = usePermissions();

  const capabilityKeys = useMemo(
    () =>
      rawCapabilityKeys.length > 0
        ? rawCapabilityKeys
        : canRead("employees")
          ? ["page:employees"]
          : [],
    [rawCapabilityKeys, canRead]
  );

  const surface = useMemo(() => {
    if (loading) return undefined;
    return resolvePeopleIndexSurface(capabilityKeys, {
      tab: searchParams.get("tab"),
      queue: searchParams.get("queue"),
    });
  }, [capabilityKeys, loading, searchParams]);

  useEffect(() => {
    if (loading || !surface) return;

    const queue = searchParams.get("queue");
    const org = searchParams.get("org");
    const q = searchParams.get("q");
    const status = searchParams.get("status");
    const offset = searchParams.get("offset");

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
    } else if (surface === "clients") {
      params.set(
        "queue",
        queue && ["clients", "pending_positions"].includes(queue)
          ? queue
          : "clients"
      );
      if (status) params.set("status", status);
    }

    const base =
      surface === "employees"
        ? "/people/employees"
        : surface === "talent"
          ? "/people/candidates"
          : "/people/clients";
    const qs = params.toString();
    router.replace(qs ? `${base}?${qs}` : base);
  }, [loading, router, searchParams, surface]);

  const body =
    !loading && surface === null ? (
      <div
        className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground"
        role="status"
      >
        <p className="font-medium text-foreground">No People access</p>
        <p className="mt-2">
          Your account is not granted Clients, Employees, or Candidates. Ask an
          admin for a People page grant.
        </p>
      </div>
    ) : (
      <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Opening People…
      </div>
    );

  return (
    <DashboardLayout>
      <div className={dbPageWrapper}>
        <DashboardPageHeader title="People" />
        {body}
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
              Opening People…
            </div>
          </div>
        </DashboardLayout>
      }
    >
      <PeopleRedirectInner />
    </Suspense>
  );
}
