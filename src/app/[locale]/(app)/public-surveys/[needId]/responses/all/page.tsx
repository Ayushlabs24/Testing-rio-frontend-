"use client";

import { Download, Eye, MessageSquareText, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { use, useEffect, useMemo, useState } from "react";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type {
  SurveyResponseDetail,
  SurveyResponseSummary,
} from "@/services/public-surveys/public-surveys.types";

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

function ResponseDetailDialog({
  needId,
  responseId,
  onOpenChange,
}: {
  needId: string;
  responseId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("app.publicSurveys.responses");

  return (
    <Dialog open={responseId !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {/* Keyed on responseId so switching to a different response (without
         * the dialog ever fully unmounting) starts with fresh loading state
         * instead of briefly showing the previous response's data. */}
        {responseId ? (
          <ResponseDetailBody key={responseId} needId={needId} responseId={responseId} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ResponseDetailBody({
  needId,
  responseId,
}: {
  needId: string;
  responseId: string;
}) {
  const t = useTranslations("app.publicSurveys.responses");
  const [detail, setDetail] = useState<SurveyResponseDetail | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    publicSurveysService
      .getResponse(needId, responseId)
      .then((result) => setDetail(result))
      .catch(() => setLoadError(true));
  }, [needId, responseId]);

  if (loadError) {
    return <p className="text-destructive text-sm">{t("loadDetailError")}</p>;
  }

  if (!detail) {
    return (
      <div className="space-y-3">
        <div className="bg-muted h-16 animate-pulse rounded-md" />
        <div className="bg-muted h-16 animate-pulse rounded-md" />
        <div className="bg-muted h-16 animate-pulse rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            {t("respondentColumn")}
          </p>
          <p className="text-foreground text-sm font-medium">
            {detail.contactName || t("anonymousRespondent")}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium">
            {t("contactColumn")}
          </p>
          <p className="text-foreground text-sm">{detail.contact}</p>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <p className="text-muted-foreground text-xs font-medium">
            {t("submittedColumn")}
          </p>
          <p className="text-foreground text-sm">{formatDateTime(detail.submittedAt)}</p>
        </div>
      </div>

      <div className="border-border border-t pt-4">
        <p className="text-foreground mb-3 text-sm font-semibold">
          {t("answersHeading")}
        </p>
        {detail.answers.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("noAnswers")}</p>
        ) : (
          <div className="space-y-3">
            {detail.answers.map((answer) => (
              <div key={answer.questionId} className="space-y-1.5">
                <p className="text-muted-foreground text-xs font-medium">
                  {answer.questionText}
                </p>
                <div className="border-border bg-muted/40 rounded-md border px-3.5 py-2 text-sm whitespace-pre-wrap">
                  {answer.answer && answer.answer.trim() ? (
                    answer.answer
                  ) : (
                    <span className="text-muted-foreground">{t("noAnswer")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SurveyResponsesPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.publicSurveys.responses");
  const canExport = usePermission("studySurvey", "export");

  const [need, setNeed] = useState<Need | null>(null);
  const [responses, setResponses] = useState<SurveyResponseSummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    Promise.all([
      needsService.getById(needId),
      publicSurveysService.listResponses(needId),
    ])
      .then(([needResult, responseRows]) => {
        setNeed(needResult);
        setResponses(responseRows);
        setLoadFailed(false);
      })
      .catch(() => {
        setResponses([]);
        setLoadFailed(true);
      });
  }, [needId]);

  const filteredResponses = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return responses ?? [];
    return (responses ?? []).filter(
      (response) =>
        (response.contactName ?? "").toLowerCase().includes(normalized) ||
        response.contact.toLowerCase().includes(normalized),
    );
  }, [responses, query]);

  async function handleExport(format: "csv" | "excel") {
    setExportError(null);
    setExporting(true);
    try {
      await publicSurveysService.exportResponses(needId, format);
    } catch (err) {
      setExportError(err instanceof ApiError ? err.message : t("exportError"));
    } finally {
      setExporting(false);
    }
  }

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <div className="mb-4 flex justify-end">
          <BackButton
            href={`/public-surveys/${needId}/responses`}
            label={t("backToLinks")}
          />
        </div>

        <PageHeader
          title={need?.title ?? ""}
          description={t("description")}
          actions={
            canExport && responses && responses.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="gap-1.5" disabled={exporting}>
                    <Download className="size-3.5" />
                    {exporting ? t("exporting") : t("exportResponses")}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("csv")}>
                    {t("exportCsv")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("excel")}>
                    {t("exportExcel")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null
          }
        />

        {exportError ? (
          <p className="text-destructive mb-4 text-sm">{exportError}</p>
        ) : null}

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex items-center border-b px-4 py-3">
              <div className="relative w-full sm:max-w-xs">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-8 pl-9"
                />
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">{t("respondentColumn")}</TableHead>
                  <TableHead className="py-3">{t("contactColumn")}</TableHead>
                  <TableHead className="w-48 py-3">{t("submittedColumn")}</TableHead>
                  <TableHead className="w-24 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 4 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-28 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filteredResponses.length === 0 ? (
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
                            : responses.length === 0
                              ? t("noResponses")
                              : t("noSearchResults")}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredResponses.map((response) => (
                    <TableRow key={response.id}>
                      <TableCell className="py-4 text-sm font-medium">
                        {response.contactName || t("anonymousRespondent")}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {response.contact}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {formatDateTime(response.submittedAt)}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setViewingId(response.id)}
                        >
                          <Eye className="size-3.5" />
                          {t("view")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <ResponseDetailDialog
          needId={needId}
          responseId={viewingId}
          onOpenChange={(open) => !open && setViewingId(null)}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
