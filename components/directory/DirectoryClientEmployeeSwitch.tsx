"use client";

import Link from "next/link";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

type Area = "client" | "departments" | "positions" | "employees";

type Props = {
  clientId: string;
  clientName?: string;
  active: Area;
  className?: string;
};

const AREAS: Array<{
  id: Area;
  href: (clientId: string) => string;
  icon: "Buildings" | "MapPin" | "CurrencyDollarSimple" | "UsersThree";
  label: string;
  description: string;
}> = [
  {
    id: "client",
    href: (id) => `/people/clients/${id}`,
    icon: "Buildings",
    label: "Client",
    description: "Details, pay calendar, statutory, billing",
  },
  {
    id: "departments",
    href: (id) => `/people/c/${id}/departments`,
    icon: "MapPin",
    label: "Departments",
    description: "Stores and locations for CSM",
  },
  {
    id: "positions",
    href: (id) => `/people/c/${id}/positions`,
    icon: "CurrencyDollarSimple",
    label: "Positions",
    description: "Job titles with payroll and billing daily rates",
  },
  {
    id: "employees",
    href: (id) => `/people/c/${id}?status=active`,
    icon: "UsersThree",
    label: "Employees",
    description: "Roster, 201 file, lifecycle",
  },
];

/** Switches between client management and employee management for one client. */
export function DirectoryClientEmployeeSwitch({
  clientId,
  clientName,
  active,
  className,
}: Props) {
  if (!clientId) return null;

  return (
    <nav
      aria-label={
        clientName
          ? `${clientName} — client, departments, positions, or employees`
          : "Client, departments, positions, or employees"
      }
      className={cn(
        "flex w-full max-w-full items-stretch gap-0 overflow-x-auto border-b border-border",
        "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {AREAS.map((area) => {
        const selected = active === area.id;
        return (
          <Link
            key={area.id}
            href={area.href(clientId)}
            title={area.description}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "gp-pressable relative inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-1 text-sm font-medium transition-colors",
              "mr-5 last:mr-0 sm:mr-6",
              selected
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon name={area.icon} size={IconSizes.sm} />
            {area.label}
          </Link>
        );
      })}
    </nav>
  );
}
