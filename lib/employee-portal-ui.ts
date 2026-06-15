/**
 * Responsive Tailwind bundles for the employee portal.
 * Separate mobile vs desktop markup: EpMobileView / EpDesktopView (split at md).
 */

export const epTouchButton =
  "min-h-11 h-11 w-full gap-1.5 px-3 text-sm font-medium sm:min-h-9 sm:h-9 sm:w-auto";

export const epSubmitRequestButton =
  "min-h-11 h-11 w-full gap-1.5 px-3 text-sm font-medium";

export const epHeaderActions =
  "grid w-full grid-cols-2 gap-2 md:flex md:w-auto md:shrink-0 md:gap-2";

export const epHeaderButton =
  "h-9 shrink-0 gap-1.5 px-2 text-sm font-medium sm:px-3";

export const epDialogContent =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-2rem)] max-w-none gap-3 overflow-y-auto overscroll-contain rounded-xl p-4 sm:max-w-md sm:w-full sm:gap-4 sm:p-6";

export const epDialogContentForm =
  "max-h-[min(90dvh,90vh)] w-[calc(100vw-2rem)] max-w-none gap-3 overflow-y-auto overscroll-contain rounded-xl p-4 sm:max-w-sm sm:w-full sm:gap-4 sm:p-6";

export const epPageWrapper =
  "flex w-full min-w-0 flex-col gap-2 sm:gap-3 md:gap-4 lg:gap-6";

export const epQuickLinkCard = "border-border/80 bg-card";

export const epQuickLinkCardContent =
  "flex items-center gap-2.5 p-3 sm:gap-3 sm:p-4";

export const epQuickLinkIcon =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:h-10 sm:w-10";

export const epCardInteractive =
  "transition-colors duration-150 motion-safe:md:hover:border-primary/25 motion-safe:md:hover:bg-muted/30";

export const epFormActions =
  "flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3";

export const epFormActionButton = "min-h-11 w-full sm:min-h-9 sm:w-auto";

export const epPageHeaderRow =
  "flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between";
