"use client";

import { BarChart3, QrCode } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { NeedStatusBadge } from "@/components/features/studies/study-status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PUBLIC_SURVEYS_PAGE_SIZE } from "@/config/pagination";
import { useRouter } from "@/i18n/navigation";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import { studiesService } from "@/services/studies/studies.service";

interface Row {
  need: Need;
  studyTitle: string;
}

// A Need only belongs on this list once its survey is actually published —
// `survey_created` means a survey exists but is still a DRAFT, and a public
// link to a DRAFT survey is dead on arrival (the citizen flow rejects it
// with SURVEY_NOT_PUBLISHED). Surfacing it here before that point just
// invites creating/sharing a link that doesn't work yet.
const SURVEY_EXISTS_STATUSES: readonly Need["status"][] = ["survey_published"];

/** One row per Need, not per Study — each Need runs its own independent
 * survey/link set now. */
export default function PublicSurveysPage() {
  const t = useTranslations("app.publicSurveys");
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Which Needs have at least one active public survey link — "View
  // Insights" is only meaningful (and only shown) once one exists; opening
  // it before that would just be an empty page.
  const [needsWithActiveLink, setNeedsWithActiveLink] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  useEffect(() => {
    studiesService
      .list()
      .then(async (studies) => {
        const needsByStudy = await Promise.all(
          studies.map((study) => needsService.listByStudy(study.id).catch(() => [])),
        );
        const nextRows = studies
          .flatMap((study, index) =>
            needsByStudy[index].map((need) => ({ need, studyTitle: study.title })),
          )
          .filter(({ need }) => SURVEY_EXISTS_STATUSES.includes(need.status));
        setRows(nextRows);
        setLoadFailed(false);
        const linkChecks = await Promise.all(
          nextRows.map(({ need }) =>
            publicSurveysService
              .listLinks(need.id)
              .then((links) => [need.id, links.some((link) => link.isActive)] as const)
              .catch(() => [need.id, false] as const),
          ),
        );
        setNeedsWithActiveLink(
          new Set(linkChecks.filter(([, has]) => has).map(([id]) => id)),
        );
      })
      .catch(() => {
        setRows([]);
        setLoadFailed(true);
      });
  }, []);

  const pageCount = Math.max(
    1,
    Math.ceil((rows?.length ?? 0) / PUBLIC_SURVEYS_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pagedRows = useMemo(
    () =>
      (rows ?? []).slice(
        (currentPage - 1) * PUBLIC_SURVEYS_PAGE_SIZE,
        currentPage * PUBLIC_SURVEYS_PAGE_SIZE,
      ),
    [rows, currentPage],
  );

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[45%] py-3">{t("studyColumn")}</TableHead>
                  <TableHead className="w-40 py-3">{t("statusColumn")}</TableHead>
                  <TableHead className="w-40 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 3 }).map((__, cell) => (
                        <TableCell key={cell} className="py-5">
                          <div className="bg-muted h-4 w-28 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
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
                  pagedRows.map(({ need, studyTitle }) => (
                    <TableRow key={need.id}>
                      <TableCell className="max-w-sm py-4 text-sm font-medium whitespace-normal">
                        {studyTitle} — {need.title}
                      </TableCell>
                      <TableCell className="py-4">
                        <NeedStatusBadge status={need.status} />
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => router.push(`/public-surveys/${need.id}`)}
                          >
                            <QrCode className="size-3.5" />
                            {t("manageLinks")}
                          </Button>
                          {/* View Responses hidden for now — screen stays
                           * reachable by direct URL, just not linked from
                           * here yet (this list was getting crowded with
                           * Manage Links/Insights already). */}
                          {needsWithActiveLink.has(need.id) ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5"
                              onClick={() =>
                                router.push(`/public-surveys/${need.id}/insights`)
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

            {rows && rows.length > 0 ? (
              <div className="border-border border-t px-4 py-3">
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
