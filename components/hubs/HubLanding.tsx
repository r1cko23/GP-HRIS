"use client";

import Link from "next/link";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { HubEmptyState } from "@/components/hubs/HubEmptyState";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { HUBS, grantedHubTabs, type HubId } from "@/lib/hubs";
import { dbPageWrapper } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export function HubLanding({
  hubId,
  fallback,
  description,
}: {
  hubId: HubId;
  fallback: string;
  description?: string;
}) {
  const { isAdmin, isHR, isApprover, isViewer, loading: roleLoading } =
    useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const hub = HUBS.find((item) => item.id === hubId);
  const loading = roleLoading || permissionsLoading;
  const hideEmployees = (isApprover && !isHR) || isViewer;
  const tabs = hub
    ? grantedHubTabs(hub, canRead, { isAdmin, hideEmployees })
    : [];

  return (
    <DashboardLayout>
      <div className={cn("w-full min-w-0 pb-16", dbPageWrapper)}>
        <DashboardPageHeader
          title={hub?.label ?? "Hub"}
          description={description}
        />

        {loading ? (
          <ul
            className="overflow-hidden rounded-md border border-border bg-card shadow-card"
            aria-busy="true"
            aria-label="Loading sections"
          >
            {[0, 1, 2].map((row) => (
              <li
                key={row}
                className="h-[4.25rem] border-b border-border last:border-b-0"
              >
                <div className="h-full animate-pulse bg-muted/40" />
              </li>
            ))}
          </ul>
        ) : tabs.length === 0 ? (
          <HubEmptyState
            title="Nothing you can open here"
            detail="Ask an administrator for access to this hub."
            action={
              <Link
                href={fallback}
                className="gp-pressable text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                Try a related page
              </Link>
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-md border border-border bg-card shadow-card">
            {tabs.map((tab) => (
              <li
                key={tab.href}
                className="border-b border-border last:border-b-0"
              >
                <Link
                  href={tab.href}
                  className="gp-pressable flex items-center justify-between gap-3 px-4 py-3.5 hover:bg-muted/40"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">
                      {tab.name}
                    </span>
                    {tab.description ? (
                      <span className="mt-0.5 block text-sm text-muted-foreground">
                        {tab.description}
                      </span>
                    ) : null}
                  </span>
                  <Icon
                    name="CaretRight"
                    size={IconSizes.sm}
                    className="shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardLayout>
  );
}
