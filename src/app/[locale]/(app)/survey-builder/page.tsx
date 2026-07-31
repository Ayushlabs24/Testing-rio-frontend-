"use client";

import { FileQuestion } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { DomainChips } from "@/components/common/domain-chips";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  SURVEY_BUILDER_PAGE_SIZE,
  SURVEY_BUILDER_PAGE_SIZE_OPTIONS,
} from "@/config/pagination";
import { Link } from "@/i18n/navigation";
import { domainsService } from "@/services/domains/domains.service";
import type { Domain } from "@/services/domains/domains.types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";

const ALL = "all";

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
  const tClassification = useTranslations("app.studies.classification");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainFilter, setDomainFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SURVEY_BUILDER_PAGE_SIZE);

  useEffect(() => {
    domainsService
      .list()
      .then(setDomains)
      .catch(() => undefined);
  }, []);

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

  const filtered = useMemo(() => {
    return (rows ?? []).filter((row) => {
      if (statusFilter !== ALL && row.survey.status.toUpperCase() !== statusFilter) {
        return false;
      }
      if (domainFilter !== ALL) {
        const matchesDomain =
          row.need.needDomains.some((d) => d.domain === domainFilter) ||
          row.need.domain === domainFilter;
        if (!matchesDomain) return false;
      }
      return true;
    });
  }, [rows, statusFilter, domainFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <PermissionGuard module="surveyBuilder" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              <Select
                value={domainFilter}
                onValueChange={(value) => {
                  setDomainFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-56"
                  aria-label={t("filterDomainLabel")}
                >
                  <SelectValue placeholder={t("filterDomainAll")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterDomainAll")}</SelectItem>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.name}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={statusFilter}
                onValueChange={(value) => {
                  setStatusFilter(value);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-48"
                  aria-label={t("filterStatusLabel")}
                >
                  <SelectValue placeholder={t("filterStatusAll")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterStatusAll")}</SelectItem>
                  <SelectItem value="DRAFT">{t("status.DRAFT")}</SelectItem>
                  <SelectItem value="SUBMITTED">{t("status.SUBMITTED")}</SelectItem>
                  <SelectItem value="PUBLISHED">{t("status.PUBLISHED")}</SelectItem>
                  <SelectItem value="REJECTED">{t("status.REJECTED")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">{t("studyColumn")}</TableHead>
                  <TableHead className="w-[22%]">{t("needColumn")}</TableHead>
                  <TableHead className="w-[38%]">{t("domainColumn")}</TableHead>
                  <TableHead className="w-[12%]">{t("statusColumn")}</TableHead>
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
                ) : filtered.length === 0 ? (
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
                  paged.map(({ need, studyTitle, survey }) => (
                    <TableRow key={need.id}>
                      <TableCell className="py-4 align-middle text-sm font-medium break-words whitespace-normal">
                        {studyTitle}
                      </TableCell>
                      <TableCell className="align-middle text-sm break-words whitespace-normal">
                        {need.title}
                      </TableCell>
                      <TableCell className="align-middle text-sm whitespace-normal">
                        {need.allDomainsSelected ? (
                          <DomainChips
                            items={[tClassification("allDomainsChip")]}
                            variant="secondary"
                          />
                        ) : need.needDomains.length > 0 ? (
                          <DomainChips
                            items={need.needDomains.map(
                              (d) => `${d.domain} / ${d.subDomain}`,
                            )}
                            variant="secondary"
                          />
                        ) : need.domain && need.subDomain ? (
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
                          className={
                            STATUS_BADGE_CLASS[
                              survey.status.toUpperCase() as Survey["status"]
                            ]
                          }
                        >
                          {t.has(`status.${survey.status.toUpperCase()}`)
                            ? t(
                                `status.${survey.status.toUpperCase()}` as Parameters<
                                  typeof t
                                >[0],
                              )
                            : survey.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right align-middle">
                        {/* Approve/Reject for a SUBMITTED survey now live
                            inline on the detail page itself (see
                            survey-builder/[needId]/page.tsx) — no separate
                            review route to special-case here anymore. */}
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/survey-builder/${need.id}`}>{t("open")}</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {filtered.length > 0 ? (
              <div className="border-border flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-40"
                    aria-label={t("pagination.rowsPerPage")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_BUILDER_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("pagination.rowsPerPage")}: {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Pagination
                  page={currentPage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                  className="sm:w-auto"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
