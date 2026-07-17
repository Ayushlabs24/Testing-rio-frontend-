"use client";

import { FileQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
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
import { Link } from "@/i18n/navigation";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

interface Row {
  need: Need;
  studyTitle: string;
  survey: Survey | null;
}

/** One row per Need, not per Study — a Study can hold many Needs now, each
 * running its own independent survey. */
export default function SurveyBuilderPage() {
  const t = useTranslations("app.surveyBuilder");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    studiesService
      .list()
      .then(async (studies) => {
        const needsByStudy = await Promise.all(
          studies.map((study) => needsService.listByStudy(study.id).catch(() => [])),
        );
        const needs = studies.flatMap((study, index) =>
          needsByStudy[index].map((need) => ({ need, studyTitle: study.title })),
        );
        const surveys = await Promise.all(
          needs.map(({ need }) =>
            surveysService.getSurveyByNeedId(need.id).catch(() => null),
          ),
        );
        setRows(needs.map(({ need, studyTitle }, index) => ({ need, studyTitle, survey: surveys[index] })));
        setLoadFailed(false);
      })
      .catch(() => {
        setRows([]);
        setLoadFailed(true);
      });
  }, []);

  return (
    <PermissionGuard module="surveyBuilder" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead>{t("needColumn")}</TableHead>
                  <TableHead>{t("domainColumn")}</TableHead>
                  <TableHead className="w-36">{t("statusColumn")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 5 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <FileQuestion className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map(({ need, studyTitle, survey }) => (
                    <TableRow key={need.id}>
                      <TableCell className="py-4 text-sm font-medium">
                        {studyTitle}
                      </TableCell>
                      <TableCell className="text-sm">{need.title}</TableCell>
                      <TableCell className="text-sm">
                        {need.domain && need.subDomain ? (
                          <span className="text-muted-foreground">
                            {need.domain} / {need.subDomain}
                          </span>
                        ) : (
                          <Badge variant="outline">{t("noDomain")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {survey ? (
                          <Badge
                            variant={survey.status === "DRAFT" ? "outline" : "default"}
                            className={
                              survey.status !== "DRAFT"
                                ? "bg-badge-success text-badge-success-foreground border-transparent"
                                : undefined
                            }
                          >
                            {survey.status}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">
                            {t("noSurvey")}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/survey-builder/${need.id}`}>{t("open")}</Link>
                        </Button>
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
