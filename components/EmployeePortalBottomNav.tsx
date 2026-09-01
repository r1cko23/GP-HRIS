"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  House,
  Clock,
  CalendarBlank,
  Timer,
  FileArrowDown,
  List,
} from "phosphor-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    href: "/employee-portal",
    label: "Home",
    icon: House,
  },
  {
    href: "/employee-portal/bundy",
    label: "Bundy",
    icon: Clock,
  },
  {
    href: "/employee-portal/leave-request",
    label: "Leave",
    icon: CalendarBlank,
  },
  {
    href: "/employee-portal/overtime",
    label: "OT",
    icon: Timer,
  },
  {
    href: "/employee-portal/payslips",
    label: "Pay",
    icon: FileArrowDown,
  },
] as const;

function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/employee-portal") {
    return pathname === "/employee-portal";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

interface EmployeePortalBottomNavProps {
  onOpenMore: () => void;
}

export function EmployeePortalBottomNav({ onOpenMore }: EmployeePortalBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/80 bg-background/95 pb-[env(safe-area-inset-bottom,0px)] shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-background/85 md:hidden"
      aria-label="Employee portal navigation"
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-0.5 pt-1 sm:gap-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isNavActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[52px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight transition-colors sm:px-1 sm:text-xs",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent/80 hover:text-foreground active:bg-accent"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon
                className="h-6 w-6 shrink-0 sm:h-7 sm:w-7"
                weight={active ? "fill" : "regular"}
                aria-hidden
              />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onOpenMore}
          className="flex min-h-[52px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1.5 text-[10px] font-semibold leading-tight text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground active:bg-accent sm:px-1 sm:text-xs"
          aria-label="Open full menu: schedule, profile, devices, and more"
        >
          <List className="h-6 w-6 shrink-0 sm:h-7 sm:w-7" aria-hidden />
          <span className="max-w-full truncate">More</span>
        </button>
      </div>
    </nav>
  );
}
