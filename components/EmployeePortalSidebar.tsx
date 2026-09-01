"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { memo, useCallback, useState, useEffect, useMemo } from "react";
import {
  Clock,
  User,
  WarningCircle,
  CalendarBlank,
  Timer,
  FileArrowDown,
  DeviceMobile,
  X,
  House,
} from "phosphor-react";
import { cn } from "@/lib/utils";
import { isEmployeePortalNavActive } from "@/lib/employee-portal-nav";
import { useEmployeeSession } from "@/contexts/EmployeeSessionContext";
import { createClient } from "@/lib/supabase/client";

type NavItem = {
  name: string;
  href: string;
  icon: React.ElementType;
};

type NavGroup = {
  label: string;
  icon: React.ElementType;
  items: NavItem[];
  defaultOpen?: boolean;
};

const getNavGroups = (isAccountSupervisor: boolean): NavGroup[] => [
  {
    label: "Clock",
    icon: Clock,
    defaultOpen: true,
    items: [
      { name: "Home", href: "/employee-portal", icon: House },
      { name: "Bundy clock", href: "/employee-portal/bundy", icon: Clock },
      ...(isAccountSupervisor
        ? [
            {
              name: "Schedule",
              href: "/employee-portal/schedule",
              icon: CalendarBlank,
            },
          ]
        : []),
    ],
  },
  {
    label: "Requests",
    icon: WarningCircle,
    defaultOpen: true,
    items: [
      {
        name: "Leave request",
        href: "/employee-portal/leave-request",
        icon: CalendarBlank,
      },
      { name: "OT filing", href: "/employee-portal/overtime", icon: Timer },
      {
        name: "Failure to log",
        href: "/employee-portal/failure-to-log",
        icon: WarningCircle,
      },
    ],
  },
  {
    label: "Pay & info",
    icon: User,
    defaultOpen: true,
    items: [
      { name: "My information", href: "/employee-portal/info", icon: User },
      {
        name: "Payslips",
        href: "/employee-portal/payslips",
        icon: FileArrowDown,
      },
      {
        name: "My devices",
        href: "/employee-portal/devices",
        icon: DeviceMobile,
      },
    ],
  },
];

interface EmployeePortalSidebarProps {
  className?: string;
  onClose?: () => void;
}

const NavItem = memo(function NavItem({
  item,
  isActive,
  FallbackIcon,
}: {
  item: NavItem;
  isActive: boolean;
  FallbackIcon: React.ElementType;
}) {
  const Icon = item.icon || FallbackIcon;
  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-r-md border-l-2 py-2 pl-2 pr-3 text-sm transition-colors",
        isActive
          ? "app-sidebar-nav-active border-sidebar-accent font-medium"
          : "app-sidebar-nav-idle border-transparent"
      )}
    >
      <Icon
        className="h-5 w-5 shrink-0"
        weight={isActive ? "fill" : "regular"}
      />
      <span>{item.name}</span>
    </Link>
  );
});

export function EmployeePortalSidebar({
  className,
  onClose,
}: EmployeePortalSidebarProps) {
  const pathname = usePathname();
  const { employee } = useEmployeeSession();
  const supabase = createClient();
  const [isAccountSupervisor, setIsAccountSupervisor] = useState<boolean>(false);
  const [loadingEmployeeType, setLoadingEmployeeType] = useState(true);
  const FallbackIcon = WarningCircle;

  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      if (!employee?.id) {
        setLoadingEmployeeType(false);
        return;
      }

      try {
        const { data, error } = await supabase.rpc("get_employee_type_and_position", {
          p_employee_uuid: employee.id,
        } as any);

        if (error) {
          setLoadingEmployeeType(false);
          return;
        }

        const employeeData = Array.isArray(data) && data.length > 0 ? data[0] : null;
        if (!employeeData) {
          setLoadingEmployeeType(false);
          return;
        }

        const normalizedPosition = (employeeData.position || "").trim().toUpperCase();
        const hasAccountSupervisor = normalizedPosition.includes("ACCOUNT SUPERVISOR");
        const isClientBasedAccountSupervisor =
          employeeData.employee_type === "client-based" && hasAccountSupervisor;

        setIsAccountSupervisor(isClientBasedAccountSupervisor);
      } catch (err) {
        console.error("EmployeePortalSidebar - Exception fetching employee info:", err);
      } finally {
        setLoadingEmployeeType(false);
      }
    };

    fetchEmployeeInfo();
  }, [employee?.id, supabase]);

  const navGroups = useMemo(
    () => getNavGroups(isAccountSupervisor),
    [isAccountSupervisor]
  );

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    return new Set(["Time & Attendance", "Requests", "Information"]);
  });

  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) {
        next.delete(label);
      } else {
        next.add(label);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (loadingEmployeeType) return;

    let matchedGroup: string | null = null;
    let longest = 0;
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        const isMatch = isEmployeePortalNavActive(pathname, item.href);
        if (isMatch && item.href.length > longest) {
          matchedGroup = group.label;
          longest = item.href.length;
        }
      });
    });
    if (matchedGroup) {
      setOpenGroups((prev) => new Set([...prev, matchedGroup!]));
    }
  }, [pathname, navGroups, loadingEmployeeType]);

  return (
    <div
      className={cn(
        "app-sidebar flex h-full w-64 shrink-0 flex-col",
        className
      )}
    >
      <div className="app-shell-header sidebar-brand-header relative flex items-center justify-center border-b px-3">
        <div className="sidebar-logo-plate flex flex-col items-center gap-1 py-2">
          <img
            src="/gp-logo.webp"
            alt="Green Pasture People Management Inc."
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <span className="text-xs font-semibold text-muted-foreground">
            Employee Portal
          </span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute right-2 top-2 rounded-md p-2 text-muted-foreground hover:bg-muted md:hidden"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="app-sidebar-body flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => {
          const GroupIcon = group.icon || FallbackIcon;
          const isOpen = openGroups.has(group.label);
          const hasActiveItem = group.items.some((item) =>
            isEmployeePortalNavActive(pathname, item.href)
          );

          return (
            <div key={group.label} className="mb-4">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "mb-2 flex w-full items-center justify-between rounded-sm px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-sidebar-active hover:text-sidebar-foreground",
                  hasActiveItem
                    ? "text-sidebar-foreground"
                    : "text-sidebar-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 shrink-0 text-sidebar-muted" weight="bold" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-sidebar-muted">
                    {group.label}
                  </span>
                </div>
                <span className="text-xs text-sidebar-muted">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="app-sidebar-divider-l space-y-0.5 border-l pl-2">
                  {group.items.map((item) => (
                    <NavItem
                      key={item.href}
                      item={item}
                      isActive={isEmployeePortalNavActive(pathname, item.href)}
                      FallbackIcon={FallbackIcon}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar-divider-t border-t p-4">
        <p className="mb-2 text-center text-xs text-sidebar-muted">
          © {new Date().getFullYear()} Green Pasture People Management Inc.
          <br />
          All rights reserved
        </p>
        <div className="text-center">
          <Link
            href="/privacy"
            className="text-xs text-sidebar-accent hover:underline transition-colors"
          >
            Privacy Notice
          </Link>
        </div>
      </div>
    </div>
  );
}
