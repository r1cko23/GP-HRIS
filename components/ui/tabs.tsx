"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

type TabsListProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
> & {
  variant?: "underline" | "segment";
};

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "underline", ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    data-variant={variant}
    className={cn(
      "group/tabs",
      variant === "underline" &&
        "inline-flex h-auto w-full items-center justify-start gap-0 overflow-x-auto border-b border-border bg-transparent p-0 text-muted-foreground [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      variant === "segment" &&
        "inline-flex h-10 w-fit items-center justify-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "gp-pressable inline-flex items-center justify-center whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      // Underline (default page tabs)
      "group-data-[variant=underline]/tabs:mr-5 group-data-[variant=underline]/tabs:border-b-2 group-data-[variant=underline]/tabs:border-transparent group-data-[variant=underline]/tabs:px-1 group-data-[variant=underline]/tabs:pb-2.5 group-data-[variant=underline]/tabs:pt-1 sm:group-data-[variant=underline]/tabs:mr-6",
      "group-data-[variant=underline]/tabs:data-[state=active]:border-primary group-data-[variant=underline]/tabs:data-[state=active]:text-foreground",
      "group-data-[variant=underline]/tabs:data-[state=inactive]:text-muted-foreground group-data-[variant=underline]/tabs:hover:text-foreground",
      // Segment (compact filters)
      "group-data-[variant=segment]/tabs:min-h-8 group-data-[variant=segment]/tabs:rounded-full group-data-[variant=segment]/tabs:px-3.5",
      "group-data-[variant=segment]/tabs:data-[state=active]:bg-card group-data-[variant=segment]/tabs:data-[state=active]:text-foreground group-data-[variant=segment]/tabs:data-[state=active]:shadow-card",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-4 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
