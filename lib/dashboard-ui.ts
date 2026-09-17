/**
 * Responsive Tailwind bundles for the admin/HR dashboard.
 *
 * Viewport tiers (see lib/dashboard-viewport.ts):
 * - Mobile < 768px: hamburger drawer, stacked headers, card lists
 * - Tablet 768–1023px: hamburger drawer, compact topbar chips
 * - Laptop ≥ 1024px: topbar hub nav, multi-column grids
 */

/** Press feedback — hover stays color. Respect reduced motion. */
export const dbIosPressClass =
  "transition-[transform,background-color,color,border-color] duration-press ease-out-ui active:scale-[0.97] motion-reduce:transition-colors motion-reduce:duration-150 motion-reduce:active:scale-100";

/** Ghost/button hover on dark green topbar — do not use muted (white) hover. */
export const dbAppBarNavInteraction = `min-h-9 h-9 rounded-full px-3 hover:bg-sidebar-active hover:text-sidebar-foreground data-[state=open]:bg-sidebar-active data-[state=open]:text-sidebar-foreground focus-visible:bg-sidebar-active focus-visible:text-sidebar-foreground focus-visible:ring-0 focus-visible:ring-offset-0 ${dbIosPressClass}`;

export const dbAppBarNavIdle = `text-sidebar-muted ${dbAppBarNavInteraction}`;

export const dbAppBarNavActive = `bg-sidebar-active text-sidebar-foreground ${dbAppBarNavInteraction}`;

export const dbAppBarGhostButton = `text-sidebar-foreground ${dbAppBarNavInteraction}`;

export const dbAppBarOutlineButton = `border border-sidebar-foreground/35 bg-sidebar-foreground/10 text-sidebar-foreground ${dbAppBarNavInteraction}`;

/** Light circle on dark green — primary fill would disappear into the bar. */
export const dbAppBarAvatarFallback =
  "bg-background text-xs font-medium text-primary";

/** Page wrapper — use instead of VStack gap + space-y (they double up on mobile). */
export const dbPageWrapper =
  "flex w-full min-w-0 flex-col gap-2.5 sm:gap-4 md:gap-5 lg:gap-6";

/** Page title + toolbar row */
export const dbPageHeaderRow =
  "flex w-full flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 md:gap-6";

/** Header action row: full-width grid on mobile, inline on sm+ */
export const dbHeaderActions =
  "grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:shrink-0 sm:flex-wrap sm:justify-end sm:gap-2";

/** Compact header / toolbar button (page surface — keep rounded-md) */
export const dbHeaderButton =
  "min-h-10 h-10 w-full gap-1.5 px-3 text-sm font-medium tracking-tight sm:min-h-9 sm:h-9 sm:w-auto";

/** KPI / stat card grid — 1 col mobile, 2 tablet, 4 desktop */
export const dbKpiGrid =
  "grid w-full grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4";

/** Two-column section grid on laptop+ */
export const dbSectionGrid = "grid w-full grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6";

/** Horizontal scroll fallback for wide tables */
export const dbTableShell =
  "w-full min-w-0 overflow-x-auto rounded-md border border-border bg-card shadow-sm";

/** Form / detail card — clip horizontal overflow on phones */
export const dbFormCard = "w-full min-w-0 max-w-full overflow-x-clip";

/** Filter/toolbar select — full width on mobile, fixed from sm */
export const dbFilterSelect = "w-full min-w-0 sm:w-[180px]";

/** Dialog footer — stacked full-width actions on mobile */
export const dbDialogFooter =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-2";

/** Mobile list card inside dashboard sections */
export const dbMobileListCard =
  "rounded-lg border border-border/80 bg-card p-3 space-y-1";

/** Stacked full-width form/toolbar actions on mobile */
export const dbToolbarActions =
  "flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end";

/** Cutoff / week prev-next row */
export const dbPeriodNavRow =
  "flex w-full min-w-0 max-w-full items-center justify-between gap-1 sm:gap-2";

/** Compact prev/next control for period navigation */
export const dbPeriodNavButton =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center p-0 sm:h-9 sm:w-auto sm:px-3";

/** Scrollable mobile tab bar for section navigation */
export const dbMobileTabList =
  "inline-flex h-auto w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto rounded-lg bg-muted p-1 touch-manipulation [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** Mobile tab trigger — touch-friendly */
export const dbMobileTabTrigger =
  "shrink-0 min-h-10 px-3 text-xs sm:text-sm";
