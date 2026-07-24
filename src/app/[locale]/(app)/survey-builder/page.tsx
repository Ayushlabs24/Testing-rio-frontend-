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
import { usePermission } from "@/hooks/use-permission";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

interface Row {
  need: Need;
  studyTitle: string;
  survey: Survey;
}

const STATUS_BADGE_CLASS: Record<Survey["status"], string | undefined> = {
  DRAFT: undefined,
  SUBMITTED: "bg-badge-warning text-badge-warning-foreground border-transparent",
  REJECTED: "bg-destructive/10 text-destructive border-transparent",
  PUBLISHED: "bg-badge-success text-badge-success-foreground border-transparent",
};

/** One row per Need, not per Study — a Study can hold many Needs now, each
 * running its own independent survey. */
export default function SurveyBuilderPage() {
  const t = useTranslations("app.surveyBuilder");
  const canWrite = usePermission("surveyBuilder", "write");
  const canApprove = usePermission("surveyBuilder", "approve");
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
        // Survey Builder is for reviewing/curating surveys, DRAFT or
        // PUBLISHED — a Need with no survey yet has nothing to curate here
        // (that starts from the Need's own Survey section instead), but a
        // DRAFT survey belongs on this list just as much as a PUBLISHED one;
        // this is exactly where someone would come to open and finish it.
        setRows(
          needs
            .map(({ need, studyTitle }, index) => ({
              need,
              studyTitle,
              survey: surveys[index],
            }))
            // Loose check — a 204/empty response for "no survey yet" can
            // come back as `undefined`, not `null`; either means "skip".
            .filter((row): row is Row => row.survey != null),
        );
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
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead>{t("needColumn")}</TableHead>
                  <TableHead>{t("domainColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="w-20" />
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
                      <TableCell className="py-4 align-middle text-sm font-medium break-words whitespace-normal">
                        {studyTitle}
                      </TableCell>
                      <TableCell className="align-middle text-sm break-words whitespace-normal">
                        {need.title}
                      </TableCell>
                      <TableCell className="align-middle text-sm whitespace-normal">
                        {need.domain && need.subDomain ? (
                          <span className="text-muted-foreground break-words">
                            {need.domain} / {need.subDomain}
                          </span>
                        ) : (
                          <Badge variant="outline">{t("noDomain")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="align-middle">
                        <Badge
                          variant="outline"
                          className={STATUS_BADGE_CLASS[survey.status]}
                        >
                          {t(`status.${survey.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        {canApprove && !canWrite && survey.status === "SUBMITTED" ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/survey-builder/${need.id}/review`}>
                              {t("review")}
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/survey-builder/${need.id}`}>{t("open")}</Link>
                          </Button>
                        )}
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
