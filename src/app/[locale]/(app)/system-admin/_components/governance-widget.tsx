"use client";

import { Shield, Building2, UserX, UserCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiClient } from "@/services/api/client";

interface GovernanceSummaryItem {
  id: string;
  entityLabel: string;
  createdAt: string;
}

interface GovernanceSummary {
  stats: {
    totalEvents: number;
    organizationChanges: number;
    userRoleChanges: number;
    securityEvents: number;
    reportActions: number;
    archiveActions: number;
  };
  recentDeactivatedOrgs: GovernanceSummaryItem[];
  recentAdminChanges: GovernanceSummaryItem[];
  recentUserDisables: GovernanceSummaryItem[];
  recentArchiveActions: GovernanceSummaryItem[];
}

export function GovernanceWidget() {
  const t = useTranslations("systemAdmin.governance");
  const [data, setData] = useState<GovernanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<GovernanceSummary>("/audit/summary")
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center py-6">
          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-border">
      <CardHeader className="flex flex-row items-center justify-between py-4">
        <div>
          <CardTitle className="text-foreground flex items-center gap-2 text-base font-bold">
            <Shield className="text-primary size-5" />
            {t("title")}
          </CardTitle>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("subtitle")}</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="gap-1 text-xs">
          <Link href="/system-admin/audit-log">
            {t("viewAllLogs")}
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 gap-3 text-xs md:grid-cols-3">
          {/* Deactivated Orgs Alert */}
          <div className="border-border bg-muted/20 rounded-lg border p-3">
            <h4 className="text-foreground mb-2 flex items-center gap-1.5 font-semibold">
              <Building2 className="size-3.5 text-amber-500" />
              {t("deactivatedOrgsTitle")}
            </h4>
            {data?.recentDeactivatedOrgs.length ? (
              <div className="space-y-1.5">
                {data.recentDeactivatedOrgs.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-foreground truncate font-medium">
                      <AutoTranslate text={e.entityLabel} />
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      <FormattedDate value={e.createdAt} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px] italic">
                {t("emptyState")}
              </p>
            )}
          </div>

          {/* Admin Changes Alert */}
          <div className="border-border bg-muted/20 rounded-lg border p-3">
            <h4 className="text-foreground mb-2 flex items-center gap-1.5 font-semibold">
              <UserCheck className="text-primary size-3.5" />
              {t("adminChangesTitle")}
            </h4>
            {data?.recentAdminChanges.length ? (
              <div className="space-y-1.5">
                {data.recentAdminChanges.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-foreground truncate font-medium">
                      {e.entityLabel}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      <FormattedDate value={e.createdAt} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px] italic">
                {t("emptyState")}
              </p>
            )}
          </div>

          {/* User Disables Alert */}
          <div className="border-border bg-muted/20 rounded-lg border p-3">
            <h4 className="text-foreground mb-2 flex items-center gap-1.5 font-semibold">
              <UserX className="text-destructive size-3.5" />
              {t("userDisablesTitle")}
            </h4>
            {data?.recentUserDisables.length ? (
              <div className="space-y-1.5">
                {data.recentUserDisables.slice(0, 3).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between text-[11px]"
                  >
                    <span className="text-foreground truncate font-medium">
                      {e.entityLabel}
                    </span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      <FormattedDate value={e.createdAt} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-[11px] italic">
                {t("emptyState")}
              </p>
            )}
          </div>

          {/* Recent Archives Alert commented out per user request */}
          {/* <div className="rounded-lg border border-border p-3 bg-muted/20">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 mb-2">
              <Archive className="size-3.5 text-blue-500" />
              {t("recentArchivesTitle")}
            </h4>
            {data?.recentArchiveActions.length ? (
              <div className="space-y-1.5">
                {data.recentArchiveActions.slice(0, 3).map((e) => (
                  <div key={e.id} className="flex justify-between items-center text-[11px]">
                    <span className="font-medium truncate text-foreground">{e.entityLabel}</span>
                    <span className="text-muted-foreground font-mono text-[10px]">
                      <FormattedDate value={e.createdAt} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground italic">{t("emptyState")}</p>
            )}
          </div> */}
        </div>
      </CardContent>
    </Card>
  );
}
