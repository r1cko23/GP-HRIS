"use client";

import { usePathname } from "next/navigation";
import { hubForPath } from "@/lib/hubs";
import { HubBackLink } from "@/components/hubs/HubBackLink";
import { HubSubnav } from "@/components/hubs/HubSubnav";

/**
 * Hub chrome sits at the top of every dashboard page under a hub:
 * back to the hub index beside section tabs (when not already on the index).
 * Sticky so the back control stays visible while the page scrolls.
 */
export function HubChrome() {
  const pathname = usePathname() || "";
  const hub = hubForPath(pathname);
  const showBack = Boolean(hub && pathname !== hub.href);

  if (!hub) return null;

  if (!showBack) {
    return <HubSubnav />;
  }

  return (
    <div className="sticky top-0 z-20 -mx-3 mb-3 border-b border-border/60 bg-background/95 px-3 pb-2.5 pt-0.5 backdrop-blur-sm sm:-mx-6 sm:mb-4 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <HubBackLink href={hub.href} label={hub.label} />
        <div className="min-w-0 flex-1 overflow-x-auto">
          <HubSubnav />
        </div>
      </div>
    </div>
  );
}
