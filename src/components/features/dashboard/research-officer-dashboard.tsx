"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Sparkles, UploadCloud, CheckCircle2 } from "lucide-react";
import { PageContainer } from "@/components/common/page-container";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { GeographicDistribution } from "@/components/features/dashboard/geographic-distribution";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export function ResearchOfficerDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.researchOfficer");
  const [needs, setNeeds] = useState<Need[] | null>(null);
  const [recentStudies, setRecentStudies] = useState<StudySummary[] | null>(null);

  useEffect(() => {
    studiesService
      .list({ limit: 100 })
      .then(async (studies) => {
        setRecentStudies(
          [...studies]
            .sort(
              (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
            )
            .slice(0, 5),
        );
        const needsByStudy = await Promise.all(
          studies.map((study) => needsService.listByStudy(study.id).catch(() => [])),
        );
        setNeeds(needsByStudy.flat());
      })
      .catch(() => {
        setNeeds([]);
        setRecentStudies([]);
      });
  }, []);

  const awaitingEvidence = needs?.filter((n) => n.status === "draft").length ?? 0;
  const readyToClassify =
    needs?.filter((n) => n.status === "evidence_submitted").length ?? 0;
  const awaitingReview = needs?.filter((n) => n.status === "ai_classified").length ?? 0;
  const completed = needs?.filter((n) => n.status === "survey_published").length ?? 0;

  return (
    <PageContainer>
      <div className="flex flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-foreground text-2xl font-bold tracking-tight">
            {t("title", { name: userName })}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm font-medium">
            {t("description")}
          </p>
        </div>

        {/* Top Stat Cards Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label={t("stats.awaitingEvidence")}
            value={awaitingEvidence}
            icon={UploadCloud}
          />
          <StatCard
            label={t("stats.readyToClassify")}
            value={readyToClassify}
            icon={Sparkles}
          />
          <StatCard
            label={t("stats.awaitingReview")}
            value={awaitingReview}
            icon={ClipboardList}
          />
          <StatCard label={t("stats.completed")} value={completed} icon={CheckCircle2} />
        </div>

        {/* Geographic Distribution Section */}
        <GeographicDistribution variant="ngo" />

        {/* Recent Studies Card */}
        <Card className="border-border/60 rounded-2xl shadow-sm">
          <CardContent className="p-6">
            <h2 className="text-foreground mb-4 text-lg font-bold">
              {t("recentStudiesHeading")}
            </h2>
            {recentStudies === null ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="bg-muted h-10 w-full animate-pulse rounded-xl"
                  />
                ))}
              </div>
            ) : recentStudies.length === 0 ? (
              <p className="text-muted-foreground py-4 text-sm font-medium">
                {t("noStudies")}
              </p>
            ) : (
              <div className="divide-border/60 border-border/60 divide-y overflow-hidden rounded-xl border">
                {recentStudies.map((study) => (
                  <Link
                    key={study.id}
                    href={`/studies/${study.id}`}
                    className="hover:bg-muted/40 flex items-center justify-between gap-4 px-4 py-3.5 text-sm transition-colors"
                  >
                    <span className="text-foreground truncate font-semibold">
                      {study.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs font-medium">
                      {formatDate(study.updatedAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
