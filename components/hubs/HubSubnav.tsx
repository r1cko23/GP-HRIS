"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  activeHubTab,
  hubForPath,
  tabVisible,
} from "@/lib/hubs";

export function HubSubnav() {
  const pathname = usePathname() || "";
  const hub = hubForPath(pathname);
  const { isAdmin, isHR, isApprover, isViewer, loading: roleLoading } =
    useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();

  if (!hub || hub.tabs.length === 0) return null;
  if (roleLoading || permissionsLoading) return null;

  const hideEmployees = (isApprover && !isHR) || isViewer;
  const tabs = hub.tabs.filter((tab) =>
    tabVisible(tab, canRead, { isAdmin, hideEmployees })
  );
  if (tabs.length === 0) return null;

  const active = activeHubTab(pathname, hub);

  return (
    <nav
      aria-label={`${hub.label} sections`}
      className="mb-4 flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1"
    >
      {tabs.map((tab) => {
        const selected = active?.href === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors sm:min-h-10",
              selected
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
            )}
          >
            {tab.name}
          </Link>
        );
      })}
    </nav>
  );
}
