"use client";

import { MessageSquareText, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { BackButton } from "@/components/common/back-button";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  SURVEY_RESPONSES_PAGE_SIZE,
  SURVEY_RESPONSES_PAGE_SIZE_OPTIONS,
} from "@/config/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { QuestionResponseRow } from "@/services/public-surveys/public-surveys.types";

/**
 * Every respondent's answer to one specific question — a dedicated,
 * server-paginated page rather than a dialog. A published survey can
 * collect thousands of responses; a modal that lists them all in one
 * scrolling `<div>` doesn't hold up at that scale, so this gets the exact
 * same search + rows-per-page + pagination treatment as the main "View All
 * Responses" table.
 */
export default function QuestionResponsesPage({
  params,
}: {
  params: Promise<{ needId: string; questionId: string }>;
}) {
  const { needId, questionId } = use(params);
  const t = useTranslations("app.publicSurveys.questionResponses");

  const [questionText, setQuestionText] = useState("");
  const [items, setItems] = useState<QuestionResponseRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(SURVEY_RESPONSES_PAGE_SIZE);

  const debouncedQuery = useDebouncedValue(query);

  useEffect(() => {
    let cancelled = false;
    publicSurveysService
      .listQuestionResponses(needId, questionId, {
        search: debouncedQuery.trim() || undefined,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      })
      .then((result) => {
        if (cancelled) return;
        setQuestionText(result.questionText);
        setItems(result.items);
        setTotal(result.total);
        setLoadFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setTotal(0);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [needId, questionId, debouncedQuery, page, pageSize]);

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton
            href={`/public-surveys/${needId}/responses`}
            label={t("backToSummary")}
          />
        </div>

        <PageHeader
          title={questionText || t("title")}
          description={t("description")}
          actions={
            <Badge variant="outline">{t("totalResponses", { count: total })}</Badge>
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex items-center border-b px-4 py-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 ps-9"
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">{t("respondentColumn")}</TableHead>
                  <TableHead className="py-3">{t("contactColumn")}</TableHead>
                  <TableHead className="py-3">{t("answerColumn")}</TableHead>
                  <TableHead className="w-48 py-3">{t("submittedColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 4 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-28 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={4}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <MessageSquareText className="size-5" />
                        </div>
                        <p>
                          {loadFailed
                            ? t("loadError")
                            : debouncedQuery.trim()
                              ? t("noSearchResults")
                              : t("noResponses")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.responseId}>
                      <TableCell className="py-4 text-sm font-medium">
                        {item.respondentName || t("anonymousRespondent")}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {item.contact}
                      </TableCell>
                      <TableCell dir="auto" className="py-4 text-sm break-words">
                        {item.answer && item.answer.trim() ? (
                          <AutoTranslate text={item.answer} />
                        ) : (
                          <span className="text-muted-foreground">{t("noAnswer")}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        <FormattedDate value={item.submittedAt} withTime />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {total > 0 ? (
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
                    aria-label={t("rowsPerPageLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SURVEY_RESPONSES_PAGE_SIZE_OPTIONS.map((size) => (
                      <SelectItem key={size} value={String(size)}>
                        {t("rowsPerPageLabel")}: {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Pagination
                  page={page}
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
