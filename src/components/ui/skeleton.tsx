import { cn } from "@/lib/utils";

/** Shared loading placeholder — matches the `animate-pulse` visual style
 * every page already hand-rolls inline (`<div className="bg-muted ... animate-pulse rounded" />`).
 * New/migrated loading states should use this instead of repeating that
 * className string. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-muted animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

export { Skeleton };
