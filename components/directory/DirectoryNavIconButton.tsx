"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Icon,
  IconSizes,
  type PhosphorIconName,
} from "@/components/ui/phosphor-icon";
import { cn } from "@/lib/utils";

type Props = {
  href: string;
  icon: PhosphorIconName;
  /** Accessible name and hover tooltip */
  label: string;
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
  onClick?: () => void;
};

/** Icon-only directory nav control — roster, client details, etc. */
export function DirectoryNavIconButton({
  href,
  icon,
  label,
  variant = "outline",
  className,
  onClick,
}: Props) {
  return (
    <Button
      asChild
      variant={variant}
      className={cn("size-9 shrink-0 p-0", className)}
    >
      <Link href={href} aria-label={label} title={label} onClick={onClick}>
        <Icon name={icon} size={IconSizes.sm} />
      </Link>
    </Button>
  );
}
