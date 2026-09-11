"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { LoadingButton } from "@/components/common/loading-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Pagination } from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NEED_SUMMARY_QUEUE_PAGE_SIZE } from "@/config/pagination";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { needSummaryService } from "@/services/needs/need-summary.service";
import type { NeedSummary } from "@/services/needs/need-summary.types";
import { resolveApiErrorMessage } from "@/lib/api-error-message";

/**
 * RIO-AI-003's reviewer queue — every suggested summary awaiting a decision.
 *
 * This page exists because of the client's "all entry points" decision: one
 * bulk import or PDF extraction produces a draft per imported need, so summaries
 * arrive in bursts. Confirming them one need page at a time is the difference
 * between the feature being used and being skipped, which is why bulk confirm
 * is here and not an afterthought.
 *
 * Bulk confirm is still one decision per row on the server — each id gets its
 * own audit entry. The batching is a UI affordance, never a shortcut in the
 * record.
 */
export default function NeedSummariesPage() {
  const t = useTranslations("app.needSummaries");
  const tApiErr = useTranslations("apiErrors");

  const [items, setItems] = useState<NeedSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  // Deliberately does NOT set `loading` — doing so would be a synchronous
  // setState inside the effect below. `loading` starts true for the first
  // fetch, and the page-change handler sets it before triggering a reload,
  // which is a user event rather than an effect body.
  const load = useCallback(
    (signal?: AbortSignal) => {
      return needSummaryService
        .listPending(
          {
            limit: NEED_SUMMARY_QUEUE_PAGE_SIZE,
            offset: (page - 1) * NEED_SUMMARY_QUEUE_PAGE_SIZE,
          },
          signal,
        )
        .then((result) => {
          setItems(result.items);
          setTotal(result.total);
          // Anything confirmed elsewhere has left the queue; keeping it
          // selected would send ids the server will only skip.
          setSelected((prev) => {
            const live = new Set(result.items.map((i) => i.id));
            return new Set([...prev].filter((id) => live.has(id)));
          });
        })
        .catch(() => undefined)
        .finally(() => setLoading(false));
    },
    [page],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.id)),
    );
  }

  async function confirmSelected() {
    setConfirming(true);
    setError(null);
    setNote(null);
    try {
      const result = await needSummaryService.confirmMany([...selected]);
      setNote(
        result.skipped.length > 0
          ? t("confirmedPartial", {
              confirmed: result.confirmed.length,
              skipped: result.skipped.length,
            })
          : t("confirmedAll", { count: result.confirmed.length }),
      );
      setSelected(new Set());
      await load();
    } catch (err: unknown) {
      setError(resolveApiErrorMessage(err, tApiErr, t("genericError")));
    } finally {
      setConfirming(false);
    }
  }

  const allSelected = items.length > 0 && selected.size === items.length;

  return (
    <PermissionGuard module="aiReview" action="approve">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-muted-foreground text-sm">
                {t("pendingCount", { count: total })}
              </p>
              <LoadingButton
                text={t("confirmSelected", { count: selected.size })}
                isLoading={confirming}
                disabled={selected.size === 0 || confirming}
                onClick={() => void confirmSelected()}
              />
            </div>

            {error ? <p className="text-destructive text-sm">{error}</p> : null}
            {note ? (
              <p className="text-badge-success-foreground text-sm">{note}</p>
            ) : null}

            {loading ? (
              <div className="bg-muted h-64 animate-pulse rounded-md" />
            ) : items.length === 0 ? (
              <p className="text-muted-foreground py-10 text-center text-sm">
                {t("empty")}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  {/* table-fixed is load-bearing, not cosmetic. Without it the
                      columns size to content, and a summary is a whole
                      paragraph — it stretched the Summary column until "Came
                      from" and "Suggested" were pushed under it and overlapped.
                      A `max-w-*` on the cell does nothing to fix that: a table
                      cell only honours a width once the table has a fixed
                      layout. Same reasoning as the Reviewer SLA table. */}
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={toggleAll}
                            aria-label={t("selectAll")}
                          />
                        </TableHead>
                        <TableHead className="w-[26%]">{t("colNeed")}</TableHead>
                        <TableHead className="w-[40%]">{t("colSummary")}</TableHead>
                        <TableHead className="w-36">{t("colSource")}</TableHead>
                        <TableHead className="w-36">{t("colGenerated")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Checkbox
                              checked={selected.has(item.id)}
                              onCheckedChange={() => toggle(item.id)}
                              aria-label={t("selectOne", {
                                need: item.needTitle ?? item.needId,
                              })}
                            />
                          </TableCell>
                          <TableCell className="align-top break-words whitespace-normal">
                            <Link
                              href={`/studies/${item.studyId}/needs/${item.needId}`}
                              className="text-primary text-sm font-medium hover:underline"
                            >
                              {item.needTitle ? (
                                <AutoTranslate text={item.needTitle} />
                              ) : (
                                item.needId
                              )}
                            </Link>
                            {/* AC 5 — a summary with a failed check is the one
                                worth opening rather than bulk-confirming. */}
                            {item.verificationWarnings.length > 0 ? (
                              <Badge
                                variant="outline"
                                className="border-badge-warning/40 bg-badge-warning/10 text-badge-warning-foreground ml-2"
                              >
                                <AlertTriangle className="size-3" aria-hidden />
                                {item.verificationWarnings.length}
                              </Badge>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-sm break-words whitespace-normal">
                            {/* Clamped rather than shown in full: this queue is
                                for deciding which summaries need a closer look,
                                and the whole text is one click away on the need
                                page. `title` keeps it readable on hover. */}
                            <span className="line-clamp-3" title={item.effectiveText}>
                              <AutoTranslate text={item.effectiveText} />
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-xs break-words whitespace-normal">
                            {t(`trigger.${item.triggerSource}`)}
                          </TableCell>
                          <TableCell className="text-muted-foreground align-top text-xs break-words whitespace-normal">
                            <FormattedDate value={item.generatedAt} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Pagination
                  page={page}
                  pageCount={Math.max(1, Math.ceil(total / NEED_SUMMARY_QUEUE_PAGE_SIZE))}
                  onPageChange={(next) => {
                    setLoading(true);
                    setPage(next);
                  }}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(p, count) => t("pagination.label", { page: p, count })}
                />
              </>
            )}

            <p className="text-muted-foreground flex items-start gap-2 text-xs">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {t("gateNote")}
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    </PermissionGuard>
  );
}
