"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  activeHubTab,
  hubForPath,
  grantedHubTabs,
  type HubTab,
} from "@/lib/hubs";

type SubnavItem =
  | { kind: "section"; label: string }
  | { kind: "tab"; tab: HubTab };

function itemsWithSections(tabs: HubTab[]): SubnavItem[] {
  const items: SubnavItem[] = [];
  let lastSection: string | null | undefined = undefined;
  for (const tab of tabs) {
    const section = tab.section ?? null;
    if (section && section !== lastSection) {
      items.push({ kind: "section", label: section });
      lastSection = section;
    } else if (!section) {
      lastSection = null;
    }
    items.push({ kind: "tab", tab });
  }
  return items;
}

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
  const items = itemsWithSections(tabs);
  const showSections = tabs.some((t) => t.section);

  return (
    <nav
      aria-label={`${hub.label} sections`}
      className="w-full max-w-full overflow-x-auto border-b border-border [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div className="flex min-w-0 items-stretch gap-0">
        {items.map((item) => {
          if (item.kind === "section") {
            if (!showSections) return null;
            return (
              <span
                key={`section-${item.label}`}
                className="inline-flex h-10 shrink-0 items-center whitespace-nowrap px-1 pr-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground first:pl-0 sm:pr-4"
                aria-hidden
              >
                {item.label}
              </span>
            );
          }
          const { tab } = item;
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
