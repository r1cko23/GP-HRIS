"use client";

import { Suspense } from "react";
import { X } from "phosphor-react";
import { cn } from "@/lib/utils";
import { AppNav } from "@/components/AppNav";

interface SidebarProps {
  className?: string;
  onClose?: () => void;
}

function SidebarInner({ className, onClose }: SidebarProps) {
  return (
    <div
      className={cn(
        "app-sidebar flex h-full w-72 max-w-[min(18rem,100%)] shrink-0 flex-col",
        className
      )}
      data-testid="sidebar-container"
    >
      <div className="app-shell-header sidebar-brand-header flex items-center justify-between border-b px-3">
        <div className="sidebar-logo-plate flex-1">
          <img
            src="/gp-logo.webp"
            alt="Green Pasture People Management Inc."
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="ml-2 rounded-md p-2 text-sidebar-muted hover:bg-sidebar-active hover:text-sidebar-foreground"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      <div className="app-sidebar-body flex-1 overflow-y-auto px-3 py-4">
        <AppNav orientation="drawer" onNavigate={onClose} />
      </div>

      <div className="app-sidebar-divider-t border-t p-4">
        <p className="mb-2 text-center text-xs text-sidebar-muted">
          © 2026 Green Pasture People Management Inc.
          <br />
          All rights reserved
        </p>
        <div className="text-center">
          <a
            href="/privacy"
            className="text-xs text-sidebar-accent transition-colors hover:underline"
          >
            Privacy Notice
          </a>
        </div>
      </div>
    </div>
  );
}

function SidebarFallback({ className }: SidebarProps) {
  return (
    <div
      className={cn(
        "app-sidebar flex h-full w-72 max-w-[min(18rem,100%)] shrink-0 flex-col",
        className
      )}
      aria-hidden
    >
      <div className="app-shell-header sidebar-brand-header shrink-0 border-b" />
    </div>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <Suspense fallback={<SidebarFallback {...props} />}>
      <SidebarInner {...props} />
    </Suspense>
  );
}
