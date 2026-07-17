"use client";

import { BarChart3, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { StudyStatusBadge } from "@/components/features/studies/study-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRouter } from "@/i18n/navigation";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

export default function PublicSurveysPage() {
  const t = useTranslations("app.publicSurveys");
  const router = useRouter();
  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Which studies have at least one active public survey link — "View
  // Insights" is only meaningful (and only shown) once one exists; opening
  // it before that would just be an empty page.
  const [studiesWithActiveLink, setStudiesWithActiveLink] = useState<Set<string>>(
    new Set(),
  );

  useEffect(() => {
    studiesService
      .list()
      .then(async (rows) => {
        setStudies(rows);
        setLoadFailed(false);
        const linkChecks = await Promise.all(
          rows.map((study) =>
            publicSurveysService
              .listLinks(study.id)
              .then((links) => [study.id, links.some((link) => link.isActive)] as const)
              .catch(() => [study.id, false] as const),
          ),
        );
        setStudiesWithActiveLink(
          new Set(linkChecks.filter(([, has]) => has).map(([id]) => id)),
        );
      })
      .catch(() => {
        setStudies([]);
        setLoadFailed(true);
      });
  }, []);

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">{t("studyColumn")}</TableHead>
                  <TableHead className="w-40 py-3">{t("statusColumn")}</TableHead>
                  <TableHead className="w-40 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {studies === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 3 }).map((__, cell) => (
                        <TableCell key={cell} className="py-5">
                          <div className="bg-muted h-4 w-28 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : studies.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <QrCode className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noStudies")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  studies.map((study) => (
                    <TableRow key={study.id}>
                      <TableCell className="py-4 text-sm font-medium">
                        {study.title}
                      </TableCell>
                      <TableCell className="py-4">
                        <StudyStatusBadge status={study.status} />
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => router.push(`/public-surveys/${study.id}`)}
                          >
                            <QrCode className="size-3.5" />
                            {t("manageLinks")}
                          </Button>
                          {studiesWithActiveLink.has(study.id) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                router.push(`/public-surveys/${study.id}/insights`)
                              }
                            >
                              <BarChart3 className="size-3.5" />
                              {t("viewInsights")}
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
