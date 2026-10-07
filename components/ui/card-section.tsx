import React, { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "./card";
import { cn } from "@/lib/utils";

interface CardSectionProps {
  title?: string | ReactNode;
  description?: string | ReactNode;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
}

/** Compact panel — Attendance-density padding, no inflated sm:p-6. */
export function CardSection({
  title,
  description,
  children,
  className = "",
  headerClassName = "",
}: CardSectionProps) {
  return (
    <Card className={cn("w-full min-w-0 max-w-full shadow-none", className)}>
      {(title || description) && (
        <CardHeader
          className={cn("px-3 py-2.5 sm:px-4 sm:py-3", headerClassName)}
        >
          {title ? <CardTitle>{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      )}
      <CardContent className="w-full min-w-0 max-w-full space-y-3 p-3 sm:p-4">
        {children}
      </CardContent>
    </Card>
  );
}
