import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent max-width/padding wrapper used by every page.
 * Change spacing app-wide by editing this component, not per-page classes.
 */
export function PageContainer({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-[100rem] px-4 py-8 sm:px-6 lg:px-8", className)}
      {...props}
    />
  );
}
