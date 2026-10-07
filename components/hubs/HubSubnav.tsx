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
  const { canRead, capabilityKeys, loading: permissionsLoading } =
    usePermissions();

  if (!hub || hub.tabs.length === 0) return null;
  if (pathname === hub.href) return null;
  if (roleLoading || permissionsLoading) return null;

  const hideEmployees = (isApprover && !isHR) || isViewer;
  const tabs = grantedHubTabs(hub, canRead, {
    isAdmin,
    hideEmployees,
    capabilityKeys,
  });
  if (tabs.length === 0) return null;

  const active = activeHubTab(pathname, hub);

  return (
    <nav
      aria-label={`${hub.label} sections`}
      className="w-full max-w-full overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-0 items-stretch gap-0">
        {tabs.map((tab) => {
          const selected = active?.href === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={selected ? "page" : undefined}
              className={cn(
                "gp-pressable relative inline-flex h-10 shrink-0 items-center whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors",
                "mr-5 last:mr-0 sm:mr-6",
                selected
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
