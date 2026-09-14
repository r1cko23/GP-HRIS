"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useUserRole } from "@/lib/hooks/useUserRole";
import HRDashboard from "@/app/dashboard/HRDashboard";
import AdminDashboard from "@/app/dashboard/AdminDashboard";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { HubSegmentedControl } from "@/components/hubs/HubSegmentedControl";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

function ReportsOverviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin, isRestrictedAccess, loading } = useUserRole();
  const typeParam = searchParams.get("type");
  const dashboardType: "executive" | "workforce" =
    typeParam === "workforce"
      ? "workforce"
      : typeParam === "executive"
        ? "executive"
        : isAdmin
          ? "executive"
          : "workforce";

  useEffect(() => {
    if (!loading && isRestrictedAccess) {
      router.push("/time");
    }
  }, [loading, isRestrictedAccess, router]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <Icon
            name="ArrowsClockwise"
            size={IconSizes.lg}
            className="animate-spin text-muted-foreground"
          />
        </div>
      </DashboardLayout>
    );
  }

  if (isRestrictedAccess) {
    return null;
  }

  if (isAdmin) {
    return (
      <DashboardLayout>
        <div className={cn("w-full min-w-0", dbPageWrapper)}>
          <DashboardPageHeader
            above={<HubBackLink href="/reports" label="Reports" />}
            title="Overview"
            description="Executive and workforce dashboards."
          />
          <HubSegmentedControl
            ariaLabel="Dashboard type"
            value={dashboardType}
            onChange={(id) =>
              router.replace(
                id === "workforce"
                  ? "/reports/overview?type=workforce"
                  : "/reports/overview?type=executive"
              )
            }
            options={[
              { id: "executive", label: "Executive" },
              { id: "workforce", label: "Workforce" },
            ]}
          />
          {dashboardType === "executive" ? <AdminDashboard /> : <HRDashboard />}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0", dbPageWrapper)}>
        <DashboardPageHeader
          above={<HubBackLink href="/reports" label="Reports" />}
          title="Overview"
        />
        <HRDashboard />
      </div>
    </DashboardLayout>
  );
}

const LoadingFallback = () => (
  <DashboardLayout>
    <div className="flex h-64 items-center justify-center">
      <Icon
        name="ArrowsClockwise"
        size={IconSizes.lg}
        className="animate-spin text-muted-foreground"
      />
    </div>
  </DashboardLayout>
);

export default function ReportsOverviewPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <ReportsOverviewContent />
    </Suspense>
  );
}
