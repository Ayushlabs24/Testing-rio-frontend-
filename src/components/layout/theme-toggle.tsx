"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const THEME_CYCLE = ["light", "dark", "system"] as const;
type CycleTheme = (typeof THEME_CYCLE)[number];

const THEME_ICONS: Record<CycleTheme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const noopSubscribe = () => () => {};

/** True once mounted on the client — false during SSR and the first client render. */
function useMounted() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const mounted = useMounted();

  const current = (mounted ? theme : "system") as CycleTheme;
  const Icon = THEME_ICONS[current] ?? Monitor;

  const handleClick = () => {
    const currentIndex = THEME_CYCLE.indexOf(current);
    const next = THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length];
    setTheme(next);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={`${t("toggleLabel")}: ${t(current)}`}
      title={t(current)}
      onClick={handleClick}
    >
      <Icon className="size-4" />
    </Button>
  );
}
