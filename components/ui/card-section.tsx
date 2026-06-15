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

export function CardSection({
  title,
  description,
  children,
  className = "",
  headerClassName = "",
}: CardSectionProps) {
  return (
    <Card className={cn("w-full", className)}>
      {(title || description) && (
        <CardHeader className={cn("p-3 pb-3 sm:p-6 sm:pb-4", headerClassName)}>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className="w-full min-w-0 max-w-full space-y-4 p-3 sm:p-6">
        {children}
      </CardContent>
    </Card>
  );
}