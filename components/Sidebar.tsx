"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, Suspense } from "react";
import {
  UsersThree,
  Handshake,
  Receipt,
  ClockClockwise,
  ChartLineUp,
  Gear,
  WarningCircle,
  X,
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

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

const NavItem = memo(function NavItem({
  hub,
  isActive,
  testId,
}: {
  hub: HubDef;
  isActive: boolean;
  testId?: string;
}) {
  const Icon = HUB_ICONS[hub.id] || WarningCircle;
  return (
    <Link
      href={hub.href}
      className={cn(
        "flex items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm transition-colors",
        isActive
          ? "app-sidebar-nav-active border-sidebar-accent font-medium"
          : "app-sidebar-nav-idle border-transparent"
      )}
      data-testid={testId}
    >
      <Icon className="h-4 w-4" />
      {hub.label}
    </Link>
  );
});

function SidebarInner({ className, onClose }: SidebarProps) {
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
  const navItemTestId = (name: string) =>
    `nav-item-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const hideEmployees = (isApprover && !isHR) || isViewer;

  const visibleHubs = React.useMemo(() => {
    if (roleLoading || permissionsLoading) return HUBS;
    return HUBS.filter((hub) =>
      hubVisible(hub, canRead, { isAdmin, hideEmployees })
    );
  }, [roleLoading, permissionsLoading, canRead, isAdmin, hideEmployees]);

  const settingsVisible =
    roleLoading || permissionsLoading ? true : canRead("settings");

  if (!visibleHubs || visibleHubs.length === 0) {
    console.warn("Sidebar: visibleHubs is empty!", {
      roleLoading,
      role,
      visibleHubs,
    });
  }

  return (
    <div
      className={cn(
        "app-sidebar flex h-full w-64 shrink-0 flex-col",
        className
      )}
      style={{
        minWidth: "256px",
        width: "256px",
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
      }}
      data-testid="sidebar-container"
    >
      <div className="app-shell-header sidebar-brand-header flex items-center justify-between border-b px-3">
        <div className="sidebar-logo-plate flex-1">
          <img
            src="/gp-logo.webp"
            alt="Green Pasture People Management Inc."
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-md p-2 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <nav
        className="app-sidebar-body flex-1 space-y-1 overflow-y-auto px-3 py-4"
        aria-label="Sidebar navigation"
      >
        {roleLoading || permissionsLoading ? (
          <div className="flex h-32 items-center justify-center">
            <ArrowsClockwise className="h-4 w-4 animate-spin text-sidebar-muted" />
          </div>
        ) : visibleHubs.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center text-sm text-sidebar-muted">
            <WarningCircle className="mb-2 h-8 w-8" />
            <p className="font-medium text-sidebar-foreground">
              No navigation items available
            </p>
            <p className="mt-2 text-xs leading-relaxed">
              Your account may have no module access, or permissions failed to
              load. Check Settings → Access control.
            </p>
            <Badge variant="outline" className="mt-3 text-xs font-normal">
              {role ? formatRoleLabel(role) : "Role: not loaded"}
            </Badge>
          </div>
        ) : (
          <div className="space-y-0.5">
            {visibleHubs.map((hub) => (
              <NavItem
                key={hub.id}
                hub={hub}
                isActive={isHubNavActive(pathname, hub)}
                testId={navItemTestId(hub.label)}
              />
            ))}
          </div>
        )}
      </nav>

      <div className="app-sidebar-divider-t border-t p-4">
        {settingsVisible ? (
          <Link
            href="/settings"
            className={cn(
              "mb-3 flex items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm transition-colors",
              pathname.startsWith("/settings") ||
                pathname.startsWith("/overtime-groups")
                ? "app-sidebar-nav-active border-sidebar-accent font-medium"
                : "app-sidebar-nav-idle border-transparent"
            )}
            data-testid="nav-item-settings"
          >
            <Gear className="h-4 w-4" />
            Settings
          </Link>
        ) : null}
        <p className="mb-2 text-center text-xs text-sidebar-muted">
          © 2026 Green Pasture People Management Inc.
          <br />
          All rights reserved
        </p>
        <div className="text-center">
          <a
            href="/privacy"
            className="text-xs text-sidebar-accent transition-colors hover:underline"
          >
            Privacy Notice
          </a>
        </div>
      </div>
    </div>
  );
}

function SidebarFallback({ className }: SidebarProps) {
  return (
    <div
      className={cn(
        "app-sidebar flex h-full w-64 shrink-0 flex-col",
        className
      )}
      style={{
        minWidth: "256px",
        width: "256px",
      }}
      aria-hidden
    >
      <div className="app-shell-header sidebar-brand-header shrink-0 border-b" />
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarFallback {...props} />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
