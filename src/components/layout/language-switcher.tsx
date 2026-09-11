"use client";

import { Check, Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSelect = (nextLocale: AppLocale) => {
    if (nextLocale === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: nextLocale });
    });
  };

  return (
    <DropdownMenu>
      {/* A thin top progress bar while the locale switch is in flight, so the
          re-render + background translation never reads as a frozen or blank
          screen. Route-level `loading.tsx` skeletons take over from there. */}
      {isPending ? (
        <div
          className="bg-primary/70 fixed inset-x-0 top-0 z-[100] h-0.5 animate-pulse"
          role="progressbar"
          aria-label={t("switcherLabel")}
        />
      ) : null}
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t("switcherLabel")}
          title={t("switcherLabel")}
          disabled={isPending}
        >
          <Languages className={isPending ? "size-4 animate-pulse" : "size-4"} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {routing.locales.map((loc) => (
          <DropdownMenuItem key={loc} onSelect={() => handleSelect(loc)}>
            <span className="flex-1">{t(loc)}</span>
            {loc === locale ? <Check className="size-4" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
