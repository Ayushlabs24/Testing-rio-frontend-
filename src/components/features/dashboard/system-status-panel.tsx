"use client";

import { Bot, Clock, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

interface SystemStatusPanelProps {
  aiServiceOnline?: boolean;
  // A single global SLA-hours figure — the backend (ReviewerSlaService) has
  // never had a per-type (surveys/reports/sharing) breakdown; the earlier
  // three-number shape here didn't correspond to anything real.
  reviewSlaHours?: number;
  consentVersion?: string;
  className?: string;
}

export function SystemStatusPanel({
  aiServiceOnline,
  reviewSlaHours,
  consentVersion,
  className,
}: SystemStatusPanelProps) {
  const t = useTranslations("systemAdmin.dashboard");

  const items = [
    {
      key: "ai",
      icon: Bot,
      iconColor: "text-purple-500",
      title: t("aiService"),
      statusText:
        aiServiceOnline === undefined
          ? t("statusUnavailable")
          : aiServiceOnline
            ? t("aiServiceOnline")
            : t("aiServiceOffline"),
      statusVariant: aiServiceOnline ? "ok" : "attention",
      detail:
        aiServiceOnline === undefined ? t("statusNotConfigured") : t("aiServiceDetail"),
      href: "/settings/methodology",
      manageLabel: t("manage"),
    },
    {
      key: "sla",
      icon: Clock,
      iconColor: "text-amber-500",
      title: t("reviewSla"),
      statusText: reviewSlaHours ? t("reviewSlaStatus") : t("statusUnavailable"),
      statusVariant: reviewSlaHours ? "ok" : "attention",
      detail: reviewSlaHours
        ? t("reviewSlaDetail", { hours: reviewSlaHours })
        : t("statusNotConfigured"),
      href: "/settings/methodology",
      manageLabel: t("manage"),
    },
    {
      key: "consent",
      icon: FileText,
      iconColor: "text-emerald-500",
      title: t("consentInstruments"),
      statusText: consentVersion ?? t("statusUnavailable"),
      statusVariant: consentVersion ? "ok" : "attention",
      detail: consentVersion
        ? t("consentDetail", { version: consentVersion })
        : t("statusNotConfigured"),
      href: "/settings/organization",
      manageLabel: t("manage"),
    },
  ] as const;

  const STATUS_DOT = {
    ok: "bg-emerald-500",
    attention: "bg-amber-500",
    warning: "bg-destructive",
  } as const;

  return (
    <div className={className}>
      <h3 className="text-foreground mb-4 text-base font-bold">{t("systemStatus")}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.key}
              className="border-border/60 bg-card flex flex-col gap-3 rounded-2xl border p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="bg-muted flex size-10 items-center justify-center rounded-xl">
                  <Icon className={`size-5 ${item.iconColor}`} />
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  asChild
                  className="text-primary h-8 px-3 text-sm font-semibold"
                >
                  <Link href={item.href}>{item.manageLabel}</Link>
                </Button>
              </div>

              <div>
                <p className="text-foreground text-base font-bold">{item.title}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span
                    className={`size-2.5 shrink-0 rounded-full ${STATUS_DOT[item.statusVariant]}`}
                  />
                  <span className="text-foreground text-sm font-semibold">
                    {item.statusText}
                  </span>
                </div>
                <p className="text-muted-foreground mt-1.5 text-sm leading-snug">
                  {item.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
