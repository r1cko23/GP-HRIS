"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  HUBS,
  firstGrantedHubTab,
  type HubId,
} from "@/lib/hubs";

export function HubLanding({
  hubId,
  fallback,
}: {
  hubId: HubId;
  fallback: string;
}) {
  const router = useRouter();
  const { isAdmin, isHR, isApprover, isViewer, loading: roleLoading } =
    useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();

  useEffect(() => {
    if (roleLoading || permissionsLoading) return;
    const hub = HUBS.find((item) => item.id === hubId);
    if (!hub) {
      router.replace(fallback);
      return;
    }
    const hideEmployees = (isApprover && !isHR) || isViewer;
    const tab = firstGrantedHubTab(hub, canRead, { isAdmin, hideEmployees });
    router.replace(tab?.href ?? fallback);
  }, [
    hubId,
    fallback,
    roleLoading,
    permissionsLoading,
    isAdmin,
    isHR,
    isApprover,
    isViewer,
    canRead,
    router,
  ]);

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
