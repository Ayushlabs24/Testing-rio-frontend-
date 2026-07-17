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
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

export default function PublicSurveysPage() {
  const t = useTranslations("app.publicSurveys");
  const router = useRouter();
  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    studiesService
      .list()
      .then((rows) => {
        setStudies(rows);
        setLoadFailed(false);
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
