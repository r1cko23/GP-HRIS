"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  epViewportBlockDesktopOnly,
  epViewportBlockMobileOnly,
  epViewportDesktopOnly,
  epViewportMobileOnly,
} from "@/lib/employee-portal-viewport";

type ViewportProps = {
  children: ReactNode;
  className?: string;
};

export function EpMobileView({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportMobileOnly, className)}>{children}</div>
  );
}

export function EpDesktopView({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportDesktopOnly, className)}>{children}</div>
  );
}

export function EpMobileBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportBlockMobileOnly, className)}>{children}</div>
  );
}

export function EpDesktopBlock({ children, className }: ViewportProps) {
  return (
    <div className={cn(epViewportBlockDesktopOnly, className)}>{children}</div>
  );
}
