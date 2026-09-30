"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useMemo, useState } from "react";
import {
  UsersThree,
  ClockClockwise,
  Receipt,
  Gear,
  WarningCircle,
  ArrowsClockwise,
  ShieldCheck,
  CaretDown,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { formatRoleLabel } from "@/lib/format-role-label";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUserRole } from "@/lib/hooks/useUserRole";
import { usePermissions } from "@/lib/hooks/usePermissions";
import {
  HUBS,
  NAV_GROUPS,
  hubVisible,
  isNavGroupActive,
  isNavLinkActive,
  navGroupHasLinks,
  navGroupMenuSections,
  type NavGroupDef,
  type NavGroupId,
  type NavMenuSection,
} from "@/lib/hubs";

const GROUP_ICONS: Record<NavGroupId, React.ElementType> = {
  hr: UsersThree,
  operations: ClockClockwise,
  payroll: Receipt,
  admin: ShieldCheck,
};

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
          ? "h-9 shrink-0 gap-1.5 rounded-full px-3.5"
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

function GroupNav({
  group,
  sections,
  pathname,
  orientation,
  onNavigate,
}: {
  group: NavGroupDef;
  sections: NavMenuSection[];
  pathname: string;
  orientation: "bar" | "drawer";
  onNavigate?: () => void;
}) {
  const Icon = GROUP_ICONS[group.id] || WarningCircle;
  const isActive = isNavGroupActive(pathname, group);
  const bar = orientation === "bar";
  const [open, setOpen] = useState(false);
  const flatLinks = sections.flatMap((s) => s.links);

  if (!flatLinks.length) return null;

  if (flatLinks.length === 1) {
    return (
      <NavItem
        href={flatLinks[0].href}
        label={group.label}
        icon={Icon}
        isActive={isActive}
        orientation={orientation}
        testId={navItemTestId(group.label)}
        onNavigate={onNavigate}
      />
    );
  }

  if (!bar) {
    return (
      <div className="space-y-0.5">
        <div
          className={cn(
            "flex items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm font-medium",
            isActive
              ? "app-sidebar-nav-active border-sidebar-accent"
              : "app-sidebar-nav-idle border-transparent text-sidebar-muted"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {group.label}
        </div>
        <div className="ml-4 space-y-2 border-l border-sidebar-divider pl-2">
          {sections.map((section, idx) => (
            <div key={`${group.id}-${idx}`} className="space-y-0.5">
              {section.label ? (
                <p className="px-2 pt-1 text-[10px] font-semibold uppercase tracking-wide text-sidebar-muted">
                  {section.label}
                </p>
              ) : null}
              {section.links.map((link) => {
                const selected = isNavLinkActive(pathname, link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={onNavigate}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "gp-pressable block rounded-md px-2 py-1.5 text-sm",
                      selected
                        ? "font-medium text-sidebar-foreground"
                        : "text-sidebar-muted hover:text-sidebar-foreground"
                    )}
                    data-testid={navItemTestId(`${group.id}-${link.label}`)}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "gp-pressable flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors",
            isActive
              ? "app-topbar-nav-active font-medium"
              : "app-topbar-nav-idle"
          )}
          aria-haspopup="menu"
          data-testid={navItemTestId(group.label)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {group.label}
          <CaretDown className="h-3 w-3 shrink-0 opacity-70" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[11rem]">
        {sections.map((section, idx) => (
          <React.Fragment key={`${group.id}-dd-${idx}`}>
            {idx > 0 ? <DropdownMenuSeparator /> : null}
            {section.label ? (
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                {section.label}
              </DropdownMenuLabel>
            ) : null}
            {section.links.map((link) => {
              const selected = isNavLinkActive(pathname, link);
              return (
                <DropdownMenuItem key={link.href} asChild>
                  <Link
                    href={link.href}
                    onClick={() => {
                      setOpen(false);
                      onNavigate?.();
                    }}
                    aria-current={selected ? "page" : undefined}
                    className={cn(selected && "font-medium")}
                    data-testid={navItemTestId(`${group.id}-${link.label}`)}
                  >
                    {link.label}
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </React.Fragment>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

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
  const {
    canRead,
    capabilityKeys,
    loading: permissionsLoading,
  } = usePermissions();
  const hideEmployees = (isApprover && !isHR) || isViewer;
  const bar = orientation === "bar";

  const grantOpts = useMemo(
    () => ({ isAdmin, hideEmployees, capabilityKeys }),
    [capabilityKeys, hideEmployees, isAdmin]
  );

  const visibleHubs = useMemo(() => {
    if (roleLoading || permissionsLoading) return HUBS;
    return HUBS.filter((hub) => hubVisible(hub, canRead, grantOpts));
  }, [roleLoading, permissionsLoading, canRead, grantOpts]);

  const visibleGroups = useMemo(() => {
    return NAV_GROUPS.map((group) => ({
      group,
      sections: navGroupMenuSections(group, canRead, grantOpts),
    })).filter((row) => navGroupHasLinks(row.sections));
  }, [canRead, grantOpts]);

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
          ? "flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          : "space-y-0.5"
      )}
      aria-label="Primary navigation"
      data-testid={bar ? "topbar-nav" : "drawer-nav"}
    >
      {visibleGroups.map(({ group, sections }) => (
        <GroupNav
          key={group.id}
          group={group}
          sections={sections}
          pathname={pathname}
          orientation={orientation}
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
