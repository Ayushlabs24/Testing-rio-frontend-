"use client";

import { ClipboardList, Sparkles, UploadCloud, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

interface NeedRow extends Need {
  studyTitle: string;
}

/**
 * Research Officer's own dashboard — their work is Study → Need → Evidence
 * → Submit → AI Classification, so the dashboard reflects that pipeline
 * directly instead of the generic org-stats tiles (Users/Roles/Modules
 * count), which this role has no read access to populate anyway (no
 * entityTeam/rolesPermissions) and aren't meaningful to this job either way.
 * A Study has no status of its own now — every stat here is per-Need.
 */
export function ResearchOfficerDashboard({ userName }: { userName: string }) {
  const t = useTranslations("app.dashboard.researchOfficer");
  const [needs, setNeeds] = useState<NeedRow[] | null>(null);

  useEffect(() => {
    studiesService
      .list({ limit: 100 })
      .then(async (studies) => {
        const needsByStudy = await Promise.all(
          studies.map((study) => needsService.listByStudy(study.id).catch(() => [])),
        );
        setNeeds(
          studies.flatMap((study, index) =>
            needsByStudy[index].map((need) => ({ ...need, studyTitle: study.title })),
          ),
        );
      })
      .catch(() => setNeeds([]));
  }, []);

  const awaitingEvidence = needs?.filter((n) => n.status === "draft").length ?? 0;
  const readyToClassify =
    needs?.filter((n) => n.status === "evidence_submitted").length ?? 0;
  const awaitingReview = needs?.filter((n) => n.status === "ai_classified").length ?? 0;
  const completed = needs?.filter((n) => n.status === "survey_published").length ?? 0;

  const recentNeeds = needs
    ? [...needs]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 5)
    : null;

  return (
    <PageContainer>
      <PageHeader title={t("title", { name: userName })} description={t("description")} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <Card>
        <CardContent className="space-y-3 p-6">
          <h2 className="text-foreground text-sm font-semibold">
            {t("recentStudiesHeading")}
          </h2>
          {recentNeeds === null ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-muted h-9 w-full animate-pulse rounded" />
              ))}
            </div>
          ) : recentNeeds.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("noStudies")}</p>
          ) : (
            <div className="divide-border divide-y rounded-md border">
              {recentNeeds.map((need) => (
                <Link
                  key={need.id}
                  href={`/studies/${need.studyId}/needs/${need.id}`}
                  className="hover:bg-muted/50 flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm"
                >
                  <span className="truncate font-medium">{need.studyTitle}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <NeedStatusBadge status={need.status} />
                    <span className="text-muted-foreground text-xs">
                      {formatDate(need.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
