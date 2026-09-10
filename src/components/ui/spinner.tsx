"use client";

import { useTranslations } from "next-intl";
import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The accessible name is screen-reader-only but still follows the UI locale:
 * it defaults to the shared `common.loading` string and can be overridden by
 * passing an explicit `aria-label` (spread after the default below).
 */
function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
  const t = useTranslations("common");
  return (
    <Loader2Icon
      data-slot="spinner"
      role="status"
      aria-label={t("loading")}
      className={cn("size-4 animate-spin", className)}
      {...props}
    />
  );
}

export { Spinner };
