"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { HUBS, firstGrantedHubTab, type HubId } from "@/lib/hubs";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

/**
 * Hub index routes redirect to the first granted section.
 * Nav dropdowns own discovery — no subpage card lists here.
 */
export function HubLanding({
  hubId,
  fallback,
}: {
  hubId: HubId;
  fallback: string;
  /** @deprecated Ignored — hub indexes no longer show marketing copy. */
  description?: string;
}) {
  const router = useRouter();
  const { isAdmin, isHR, isApprover, isViewer, loading: roleLoading } =
    useUserRole();
  const {
    canRead,
    capabilityKeys,
    loading: permissionsLoading,
  } = usePermissions();
  const hub = HUBS.find((item) => item.id === hubId);
  const loading = roleLoading || permissionsLoading;
  const hideEmployees = (isApprover && !isHR) || isViewer;
  const firstTab =
    hub && !loading
      ? firstGrantedHubTab(hub, canRead, {
          isAdmin,
          hideEmployees,
          capabilityKeys,
        })
      : null;
  const structurallyEmpty = (hub?.tabs.length ?? 0) === 0;

  useEffect(() => {
    if (loading || !firstTab) return;
    router.replace(firstTab.href);
  }, [firstTab, loading, router]);

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-16", dbPageWrapper)}>
        <DashboardPageHeader title={hub?.label ?? "Hub"} />

        {loading || firstTab ? (
          <div className="rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">
            Loading…
          </div>
        ) : (
          <HubEmptyState
            title={
              structurallyEmpty ? "No sections yet" : "Nothing you can open here"
            }
            detail={
              structurallyEmpty
                ? "Sections for this hub will appear here as they ship."
                : "Ask an administrator for access to this hub."
            }
            action={
              structurallyEmpty ? undefined : (
                <Link
                  href={fallback}
                  className="gp-pressable text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Try a related page
                </Link>
              )
            }
          />
        )}
      </div>
    </DashboardLayout>
  );
}
