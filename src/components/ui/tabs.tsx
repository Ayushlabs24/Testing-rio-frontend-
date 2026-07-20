"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Tabs as TabsPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center text-muted-foreground group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
  {
    variants: {
      variant: {
        // Segmented control — a filled track with a solid, elevated pill
        // for the active tab. Good for a compact, self-contained switch.
        default: "justify-center rounded-lg border border-border bg-muted",
        // Underlined — plain labels with a bottom-border indicator, the
        // classic tab look. Used where tabs are a page's primary section
        // switcher (Survey Builder, Sharing): it reads unambiguously as
        // "tabs" without depending on subtle background contrast, which a
        // filled pill on top of an already-white Card washes out.
        line: "justify-start border-b border-border",
      },
      size: {
        default: "",
        lg: "",
      },
    },
    compoundVariants: [
      { variant: "default", size: "default", class: "h-8 gap-1 p-[3px]" },
      { variant: "default", size: "lg", class: "h-11 gap-1.5 p-1.5" },
      { variant: "line", size: "default", class: "h-9 gap-5" },
      { variant: "line", size: "lg", class: "h-auto gap-8" },
    ],
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function TabsList({
  className,
  variant = "default",
  size = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant, size }), className)}
      {...props}
    />
  );
}

const tabsTriggerVariants = cva(
  cn(
    "text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 focus-visible:outline-ring relative inline-flex cursor-pointer items-center justify-center gap-1.5 font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    "group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start",
    // Pill (variant=default): the active trigger becomes its own raised,
    // bordered surface sitting on top of the track.
    "group-data-[variant=default]/tabs-list:rounded-md group-data-[variant=default]/tabs-list:border group-data-[variant=default]/tabs-list:border-transparent group-data-[variant=default]/tabs-list:data-[state=active]:border-border group-data-[variant=default]/tabs-list:data-[state=active]:bg-background group-data-[variant=default]/tabs-list:data-[state=active]:text-foreground group-data-[variant=default]/tabs-list:data-[state=active]:shadow-sm dark:group-data-[variant=default]/tabs-list:data-[state=active]:bg-input/30",
    // Underline (variant=line): the active trigger draws a colored bottom
    // border over the track's shared divider line — `-mb-px` pulls it down
    // so the two borders overlap by exactly 1px instead of stacking.
    "group-data-[variant=line]/tabs-list:-mb-px group-data-[variant=line]/tabs-list:rounded-none group-data-[variant=line]/tabs-list:border-b-2 group-data-[variant=line]/tabs-list:border-transparent group-data-[variant=line]/tabs-list:data-[state=active]:border-primary group-data-[variant=line]/tabs-list:data-[state=active]:text-foreground group-data-[variant=line]/tabs-list:data-[state=active]:font-semibold",
  ),
  {
    variants: {
      size: {
        default: cn(
          "text-sm",
          "group-data-[variant=default]/tabs-list:h-[calc(100%-1px)] group-data-[variant=default]/tabs-list:flex-1 group-data-[variant=default]/tabs-list:px-1.5 group-data-[variant=default]/tabs-list:py-0.5",
          "group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:pb-2",
        ),
        lg: cn(
          "text-sm",
          "group-data-[variant=default]/tabs-list:flex-none group-data-[variant=default]/tabs-list:px-5 group-data-[variant=default]/tabs-list:py-2.5",
          "group-data-[variant=line]/tabs-list:px-0.5 group-data-[variant=line]/tabs-list:pb-3 group-data-[variant=line]/tabs-list:text-base",
        ),
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);

function TabsTrigger({
  className,
  size = "default",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger> &
  VariantProps<typeof tabsTriggerVariants>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(tabsTriggerVariants({ size }), className)}
      {...props}
    />
  );
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  tabsListVariants,
  tabsTriggerVariants,
};
