"use client";

import { ArrowLeft, Pencil, Sparkles, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import {
  StudyReviewBadge,
  StudyStatusBadge,
} from "@/components/features/studies/study-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { usePermission } from "@/hooks/use-permission";
import { Link, useRouter } from "@/i18n/navigation";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function StudyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations("app.studies.detail");
  const tStudies = useTranslations("app.studies");
  const router = useRouter();
  const canWrite = usePermission("studySurvey", "write");

  const [study, setStudy] = useState<StudySummary | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    studiesService
      .getById(id)
      .then(setStudy)
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <PermissionGuard module="studySurvey" action="read">
        <PageContainer>
          <PageHeader title={tStudies("noResults")} />
          <Button
            variant="outline"
            onClick={() => router.push("/studies")}
            className="gap-2"
          >
            <ArrowLeft className="size-4" />
            {t("backToList")}
          </Button>
        </PageContainer>
      </PermissionGuard>
    );
  }

  if (study === null) {
    return (
      <PermissionGuard module="studySurvey" action="read">
        <PageContainer>
          <div className="space-y-4">
            <div className="bg-muted h-8 w-64 rounded" />
            <div className="bg-muted h-40 w-full rounded" />
          </div>
        </PageContainer>
      </PermissionGuard>
    );
  }

  const { classification } = study;
  const hasClassification =
    classification.ai.domain !== null || classification.human.domain !== null;

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <Link
          href="/studies"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {t("backToList")}
        </Link>

        <PageHeader
          title={study.title}
          description={study.description ?? undefined}
          actions={
            canWrite ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => router.push(`/studies/${study.id}/edit`)}
                  className="gap-2"
                >
                  <Pencil className="size-4" />
                  {t("edit")}
                </Button>
                <DeleteStudyDialog
                  studyId={study.id}
                  onDeleted={() => router.push("/studies")}
                  trigger={
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="text-destructive gap-2">
                        <Trash2 className="size-4" />
                        {tStudies("delete.action")}
                      </Button>
                    </AlertDialogTrigger>
                  }
                />
              </>
            ) : null
          }
        />

        <div className="flex flex-wrap items-center gap-2">
          <StudyStatusBadge status={study.status} />
          <StudyReviewBadge status={study.reviewStatus} />
          {study.cycleNumber === 1 ? (
            // FR-7: first-round results carry a standing trend caveat until a
            // second cycle exists to compare against.
            <Badge variant="outline">{t("cycleOneCaveat")}</Badge>
          ) : null}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardContent className="space-y-2 p-6">
                <h2 className="text-foreground text-sm font-semibold">
                  {t("needStatementHeading")}
                </h2>
                <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                  {study.needStatement ?? t("needStatementEmpty")}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-6">
                <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                  <Sparkles className="text-muted-foreground size-4" />
                  {t("classificationHeading")}
                </h2>
                {!hasClassification ? (
                  <p className="text-muted-foreground text-sm">
                    {t("classificationEmpty")}
                  </p>
                ) : (
                  <div className="space-y-3 text-sm">
                    {/* The AI suggestion and the human decision are shown side by
                        side, never collapsed into one value — FR-3 requires both
                        be visible, including when they disagree. */}
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground text-xs">{t("aiSuggested")}</p>
                      <p className="text-foreground">
                        {classification.ai.domain ?? "—"}
                        {classification.ai.subDomain
                          ? ` · ${classification.ai.subDomain}`
                          : ""}
                        {classification.ai.confidence !== null ? (
                          <span className="text-muted-foreground">
                            {" "}
                            ({t("confidence")}{" "}
                            {Math.round(classification.ai.confidence * 100)}%)
                          </span>
                        ) : null}
                      </p>
                    </div>
                    <Separator />
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground text-xs">{t("humanDecided")}</p>
                      <p className="text-foreground">
                        {classification.human.domain ?? "—"}
                        {classification.human.subDomain
                          ? ` · ${classification.human.subDomain}`
                          : ""}
                      </p>
                    </div>
                    {classification.overrideReason ? (
                      <div className="space-y-0.5">
                        <p className="text-muted-foreground text-xs">
                          {t("overrideReason")}
                        </p>
                        <p className="text-foreground">{classification.overrideReason}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardContent className="space-y-4 p-6">
              <h2 className="text-foreground text-sm font-semibold">
                {t("detailsHeading")}
              </h2>
              <dl className="space-y-3 text-sm">
                <Detail label={tStudies("villagesColumn")}>
                  {study.villages.length > 0
                    ? study.villages.join(", ")
                    : t("villagesEmpty")}
                </Detail>
                <Detail label={t("methodologyVersion")}>
                  {study.methodologyVersion}
                </Detail>
                <Detail label={t("cycleNumber")}>
                  <span className="tabular-nums">{study.cycleNumber}</span>
                </Detail>
                <Detail label={t("createdAt")}>
                  <span className="tabular-nums">{formatDateTime(study.createdAt)}</span>
                </Detail>
                <Detail label={t("updatedAt")}>
                  <span className="tabular-nums">{formatDateTime(study.updatedAt)}</span>
                </Detail>
              </dl>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </PermissionGuard>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
  );
}
