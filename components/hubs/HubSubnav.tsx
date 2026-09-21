"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { activeHubTab, hubForPath, grantedHubTabs } from "@/lib/hubs";

export function HubSubnav() {
  const pathname = usePathname() || "";
  const hub = hubForPath(pathname);
  const { isAdmin, isHR, isApprover, isViewer, loading: roleLoading } =
    useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();

  if (!hub || hub.tabs.length === 0) return null;
  if (pathname === hub.href) return null;
  if (roleLoading || permissionsLoading) return null;

  const hideEmployees = (isApprover && !isHR) || isViewer;
  const tabs = grantedHubTabs(hub, canRead, { isAdmin, hideEmployees });
  if (tabs.length === 0) return null;

  const active = activeHubTab(pathname, hub);

  return (
    <nav
      aria-label={`${hub.label} sections`}
      className="flex h-10 w-fit max-w-full flex-nowrap items-center gap-0.5 overflow-x-auto rounded-md bg-muted p-1"
    >
      {tabs.map((tab) => {
        const selected = active?.href === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "gp-pressable inline-flex h-full shrink-0 items-center justify-center whitespace-nowrap rounded-[0.375rem] px-3 text-sm font-medium",
              selected
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
