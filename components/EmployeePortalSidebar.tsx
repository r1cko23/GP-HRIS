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

// Note: Schedule link will be conditionally shown based on employee type
const getNavGroups = (isAccountSupervisor: boolean): NavGroup[] => [
  {
    label: "Time & Attendance",
    icon: Clock,
    defaultOpen: true,
    items: [
      { name: "Home", href: "/employee-portal", icon: House },
      { name: "Bundy Clock", href: "/employee-portal/bundy", icon: Clock },
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
        name: "Leave Request",
        href: "/employee-portal/leave-request",
        icon: CalendarBlank,
      },
      { name: "OT Filing", href: "/employee-portal/overtime", icon: Timer },
      {
        name: "Failure to Log",
        href: "/employee-portal/failure-to-log",
        icon: WarningCircle,
      },
    ],
  },
  {
    label: "Information",
    icon: User,
    defaultOpen: true,
    items: [
      { name: "My Information", href: "/employee-portal/info", icon: User },
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

// Memoized NavItem component to prevent unnecessary re-renders
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
          ? "border-primary bg-primary/10 font-medium text-primary"
          : "border-transparent text-muted-foreground hover:bg-accent/80 hover:text-accent-foreground"
      )}
    >
      <Icon
        className="h-5 w-5 flex-shrink-0"
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

  // Fetch employee type and position to determine if they're an Account Supervisor
  useEffect(() => {
    const fetchEmployeeInfo = async () => {
      if (!employee?.id) {
        setLoadingEmployeeType(false);
        return;
      }

      try {
        // Use RPC function to bypass RLS (same approach as get_employee_profile)
        const { data, error } = await supabase.rpc("get_employee_type_and_position", {
          p_employee_uuid: employee.id,
        } as any);

        if (error) {
          console.error("EmployeePortalSidebar - Error fetching employee via RPC:", {
            error,
            uuid: employee.id,
            employeeId: employee.employee_id,
            errorCode: error.code,
            errorMessage: error.message,
          });
          setLoadingEmployeeType(false);
          return;
        }

        // RPC returns array, get first result
        const employeeData = Array.isArray(data) && data.length > 0 ? data[0] : null;

        if (!employeeData) {
          console.warn("EmployeePortalSidebar - No employee data returned from RPC");
          setLoadingEmployeeType(false);
          return;
        }

        // Normalize position for comparison (trim and uppercase)
        const normalizedPosition = (employeeData.position || "").trim().toUpperCase();
        const hasAccountSupervisor = normalizedPosition.includes("ACCOUNT SUPERVISOR");

        // Check if employee is client-based AND Account Supervisor
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
  }, [employee?.id, employee?.employee_id, supabase]);

  const navGroups = useMemo(
    () => getNavGroups(isAccountSupervisor),
    [isAccountSupervisor]
  );

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    // Initialize with default open groups - use a stable set of groups
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

  // Auto-open the group that matches the current route
  useEffect(() => {
    if (loadingEmployeeType) return; // Wait for employee type to load

    let matchedGroup: string | null = null;
    let longest = 0;
    navGroups.forEach((group) => {
      group.items.forEach((item) => {
        const isMatch =
          pathname === item.href || pathname?.startsWith(item.href + "/");
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
        "flex h-full w-64 flex-col border-r border-border/80 bg-card/40 backdrop-blur-sm",
        className
      )}
    >
      <div className="relative border-b">
        <div className="flex items-center justify-center h-20 px-4 py-3">
          <div className="flex flex-col items-center justify-center gap-1.5 w-full">
            <img
              src="/gp-logo.webp"
              alt="Green Pasture People Management Inc."
              className="h-12 w-auto max-w-[180px] object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
            <span className="text-xs font-semibold text-muted-foreground text-center whitespace-nowrap">
              Employee Portal
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 rounded-md p-2 text-muted-foreground hover:text-foreground hover:bg-muted lg:hidden transition-colors z-10"
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navGroups.map((group) => {
          const GroupIcon = group.icon || FallbackIcon;
          const isOpen = openGroups.has(group.label);
          const hasActiveItem = group.items.some(
            (item) =>
              pathname === item.href || pathname?.startsWith(item.href + "/")
          );

          return (
            <div key={group.label} className="mb-4">
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className={cn(
                  "mb-2 flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/70",
                  hasActiveItem
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <GroupIcon
                    className="h-4 w-4 shrink-0 text-muted-foreground"
                    weight="bold"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {isOpen && (
                <div className="space-y-0.5 border-l border-border/60 pl-2">
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname?.startsWith(item.href + "/");
                    return (
                      <NavItem
                        key={item.href}
                        item={item}
                        isActive={isActive}
                        FallbackIcon={FallbackIcon}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        <p className="text-xs text-muted-foreground text-center mb-2">
          © 2026 Green Pasture People Management Inc.
          <br />
          All rights reserved
        </p>
        <div className="text-center">
          <Link
            href="/privacy"
            className="text-xs text-primary hover:underline transition-colors"
          >
            Privacy Notice
          </Link>
        </div>
      </div>
    </div>
  );
}