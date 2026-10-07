"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Icon, IconSizes } from "@/components/ui/phosphor-icon";
import { peopleEmployeeHirePath } from "@/lib/hubs";
import { usePermissions } from "@/lib/hooks/usePermissions";
import { cn } from "@/lib/utils";

type Props = {
  clientId: string;
  className?: string;
};

export function DirectoryAddEmployeeButton({ clientId, className }: Props) {
  const { hasCapability } = usePermissions();
  if (!hasCapability("fn:employees.create")) return null;

  return (
    <Button size="sm" className={cn(className)} asChild>
      <Link href={peopleEmployeeHirePath(clientId)}>
        <Icon name="Plus" size={IconSizes.sm} className="mr-1" />
        Add employee
      </Link>
    </Button>
  );
}
