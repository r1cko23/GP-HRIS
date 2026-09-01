"use client";

import Link from "next/link";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

type Area = "client" | "employees";

type Props = {
  clientId: string;
  clientName?: string;
  active: Area;
  className?: string;
};

const AREAS: Array<{
  id: Area;
  href: (clientId: string) => string;
  icon: "Buildings" | "UsersThree";
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
    id: "employees",
    href: (id) => `/people/c/${id}`,
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
          ? `${clientName} — client or employees`
          : "Client or employees"
      }
      className={cn(
        "flex flex-wrap gap-1 rounded-md border border-border bg-muted/30 p-1",
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
              "inline-flex min-h-9 flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors sm:flex-none sm:min-w-[9.5rem]",
              selected
                ? "bg-card text-foreground shadow-card"
                : "text-muted-foreground hover:bg-card/60 hover:text-foreground"
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
