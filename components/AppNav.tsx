"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo } from "react";
import {
  UsersThree,
  Handshake,
  Receipt,
  ClockClockwise,
  ChartLineUp,
  Gear,
  WarningCircle,
  ArrowsClockwise,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { formatRoleLabel } from "@/lib/format-role-label";
import { Badge } from "@/components/ui/badge";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { HUBS, hubForPath, hubVisible, type HubDef } from "@/lib/hubs";

const HUB_ICONS: Record<HubDef["id"], React.ElementType> = {
  people: UsersThree,
  benefits: Handshake,
  payroll: Receipt,
  time: ClockClockwise,
  reports: ChartLineUp,
};

function isHubNavActive(pathname: string, hub: HubDef): boolean {
  return hubForPath(pathname)?.id === hub.id;
}

function navItemTestId(name: string) {
  return `nav-item-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

const NavItem = memo(function NavItem({
  href,
  label,
  icon: Icon,
  isActive,
  orientation,
  testId,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  isActive: boolean;
  orientation: "bar" | "drawer";
  testId?: string;
  onNavigate?: () => void;
}) {
  const bar = orientation === "bar";
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "gp-pressable flex items-center text-sm transition-colors",
        bar
          ? "h-8 shrink-0 gap-1.5 rounded-md px-2.5"
          : "gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3",
        isActive
          ? bar
            ? "app-topbar-nav-active font-medium"
            : "app-sidebar-nav-active border-sidebar-accent font-medium"
          : bar
            ? "app-topbar-nav-idle"
            : "app-sidebar-nav-idle border-transparent"
      )}
      data-testid={testId}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
});

export function AppNav({
  orientation,
  onNavigate,
}: {
  orientation: "bar" | "drawer";
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const {
    role,
    isHR,
    isAdmin,
    isApprover,
    isViewer,
    loading: roleLoading,
  } = useUserRole();
  const { canRead, loading: permissionsLoading } = usePermissions();
  const hideEmployees = (isApprover && !isHR) || isViewer;
  const bar = orientation === "bar";

  const visibleHubs = React.useMemo(() => {
    if (roleLoading || permissionsLoading) return HUBS;
    return HUBS.filter((hub) =>
      hubVisible(hub, canRead, { isAdmin, hideEmployees })
    );
  }, [roleLoading, permissionsLoading, canRead, isAdmin, hideEmployees]);

  const settingsVisible =
    roleLoading || permissionsLoading ? true : canRead("settings");
  const settingsActive =
    pathname.startsWith("/settings") || pathname.startsWith("/overtime-groups");

  if (roleLoading || permissionsLoading) {
    return (
      <div
        className={cn(
          "flex items-center justify-center",
          bar ? "h-8 px-2" : "h-32"
        )}
      >
        <ArrowsClockwise className="h-4 w-4 animate-spin text-sidebar-muted" />
      </div>
    );
  }

  if (visibleHubs.length === 0) {
    if (bar) return null;
    return (
      <div className="flex flex-col items-center justify-center p-4 text-center text-sm text-sidebar-muted">
        <WarningCircle className="mb-2 h-8 w-8" />
        <p className="font-medium text-sidebar-foreground">
          No navigation items available
        </p>
        <p className="mt-2 text-xs leading-relaxed">
          Your account may have no module access, or permissions failed to load.
          Check Settings → Access control.
        </p>
        <Badge variant="outline" className="mt-3 text-xs font-normal">
          {role ? formatRoleLabel(role) : "Role: not loaded"}
        </Badge>
      </div>
    );
  }

  return (
    <nav
      className={cn(
        bar
          ? "flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "space-y-0.5"
      )}
      aria-label="Primary navigation"
      data-testid={bar ? "topbar-nav" : "drawer-nav"}
    >
      {visibleHubs.map((hub) => (
        <NavItem
          key={hub.id}
          href={hub.href}
          label={hub.label}
          icon={HUB_ICONS[hub.id] || WarningCircle}
          isActive={isHubNavActive(pathname, hub)}
          orientation={orientation}
          testId={navItemTestId(hub.label)}
          onNavigate={onNavigate}
        />
      ))}
      {settingsVisible ? (
        <>
          {bar ? (
            <span
              className="mx-1 hidden h-5 w-px shrink-0 bg-sidebar-divider sm:block"
              aria-hidden
            />
          ) : null}
          <NavItem
            href="/settings"
            label="Settings"
            icon={Gear}
            isActive={settingsActive}
            orientation={orientation}
            testId="nav-item-settings"
            onNavigate={onNavigate}
          />
        </>
      ) : null}
    </nav>
  );
}
