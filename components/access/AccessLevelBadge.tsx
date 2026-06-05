"use client";

import { Badge } from "@/components/ui/badge";
import {
  getAccessLevelLabel,
  getAccessLevelVariant,
  type AccessLevel,
} from "@/lib/access-matrix";
import { cn } from "@/lib/utils";

export function AccessLevelBadge({
  level,
  className,
}: {
  level: AccessLevel;
  className?: string;
}) {
  return (
    <Badge
      variant={getAccessLevelVariant(level)}
      className={cn(
        "text-[11px] font-medium whitespace-nowrap",
        level === "none" && "text-muted-foreground",
        className
      )}
    >
      {getAccessLevelLabel(level)}
    </Badge>
  );
}
