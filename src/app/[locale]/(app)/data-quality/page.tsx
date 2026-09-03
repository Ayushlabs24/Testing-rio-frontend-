"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DataQualitySummaryCards } from "@/components/features/data-quality/data-quality-summary";
import { DuplicateQueue } from "@/components/features/data-quality/duplicate-queue";
import { FlagReviewDialog } from "@/components/features/data-quality/flag-review-dialog";
import { FlagQueueTable } from "@/components/features/data-quality/flag-queue-table";
import { MergeDialog } from "@/components/features/data-quality/merge-dialog";
import { MergeHistory } from "@/components/features/data-quality/merge-history";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermission } from "@/hooks/use-permission";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  CleaningFlag,
  CleaningSeverity,
  CleaningSource,
  DataQualitySummary,
  DuplicateCandidate,
  DuplicateStatus,
  FlagStatus,
  MergeHistoryItem,
} from "@/services/data-quality/data-quality.types";

const PAGE_SIZE = 25;

const SOURCES: CleaningSource[] = ["manual_entry", "survey_response", "file_upload"];
const STATUSES: FlagStatus[] = ["pending", "accepted", "rejected", "superseded"];
const SEVERITIES: CleaningSeverity[] = ["missing", "non_standard", "out_of_vocabulary"];
const DUPLICATE_STATUSES: DuplicateStatus[] = [
  "pending",
  "confirmed_duplicate",
  "not_duplicate",
];

const ALL = "__all__";

export default function DataQualityPage() {
  const t = useTranslations("app.dataQuality");
  const canDecide = usePermission("dataQuality", "approve");

  const [flags, setFlags] = useState<CleaningFlag[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<DataQualitySummary | null>(null);
  const [page, setPage] = useState(1);
  const [source, setSource] = useState<string>(ALL);
  const [status, setStatus] = useState<FlagStatus>("pending");
  const [severity, setSeverity] = useState<string>(ALL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState<CleaningFlag | null>(null);
  // Q40 — one screen, three tabs. Findings are about a FIELD on one record;
  // duplicates are about a PAIR of records; merge history is the record of
  // what was actually combined. Same reviewer and same permission throughout,
  // but genuinely different decisions, so they are tabs rather than one list.
  const [tab, setTab] = useState<"findings" | "duplicates" | "merges">("findings");
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [duplicateStatus, setDuplicateStatus] = useState<DuplicateStatus>("pending");
  const [merges, setMerges] = useState<MergeHistoryItem[]>([]);
  const [mergingCandidate, setMergingCandidate] = useState<DuplicateCandidate | null>(
    null,
  );
  const [duplicateTotal, setDuplicateTotal] = useState(0);

  // Returns the promise chain rather than awaiting inside the effect body:
  // a synchronous setState there triggers cascading renders (and the lint
  // rule that guards against it). `loading` starts true for the first fetch,
  // and every later reload is kicked off by a user event, which sets it.
  const load = useCallback(
    (signal?: AbortSignal) => {
      return Promise.all([
        dataQualityService.listFlags(
          {
            page,
            pageSize: PAGE_SIZE,
            status,
            ...(source === ALL ? {} : { source: source as CleaningSource }),
            ...(severity === ALL ? {} : { severity: severity as CleaningSeverity }),
          },
          signal,
        ),
        dataQualityService.summary(signal),
        dataQualityService.listDuplicates(
          { status: duplicateStatus, pageSize: PAGE_SIZE },
          signal,
        ),
        dataQualityService.listMerges({ pageSize: PAGE_SIZE }, signal),
      ])
        .then(([pageData, summaryData, duplicatePage, mergePage]) => {
          setFlags(pageData.items);
          setTotal(pageData.total);
          setSummary(summaryData);
          setDuplicates(duplicatePage.items);
          setDuplicateTotal(duplicatePage.total);
          setMerges(mergePage.items);
          setError(null);
        })
        .catch(() => setError(t("loadError")))
        .finally(() => setLoading(false));
    },
    [page, source, status, severity, duplicateStatus, t],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Any filter change resets to page 1 — staying on page 4 of a list that now
  // has one page shows an empty table and reads as "no findings".
  const onFilterChange = (setter: (value: string) => void) => (value: string) => {
    setLoading(true);
    setter(value);
    setPage(1);
  };

  const pendingTotal = useMemo(
    () =>
      (summary?.bySource ?? [])
        .filter((row) => row.status === "pending")
        .reduce((sum, row) => sum + row.count, 0),
    [summary],
  );

  return (
    <PermissionGuard module="dataQuality" action="read">
      <PageContainer>
        <PageHeader title={t("title")} description={t("description")} />

        {summary && (
          <DataQualitySummaryCards
            summary={summary}
            pendingTotal={pendingTotal}
            canDecide={canDecide}
            onBulkAccepted={() => {
              setLoading(true);
              void load();
            }}
          />
        )}

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList>
            <TabsTrigger value="findings">
              {t("tabs.findings")}
              {pendingTotal > 0 ? ` (${pendingTotal})` : ""}
            </TabsTrigger>
            <TabsTrigger value="duplicates">
              {t("tabs.duplicates")}
              {duplicateTotal > 0 && duplicateStatus === "pending"
                ? ` (${duplicateTotal})`
                : ""}
            </TabsTrigger>
            <TabsTrigger value="merges">{t("tabs.merges")}</TabsTrigger>
          </TabsList>

          <TabsContent value="findings">
            <Card>
              <CardContent className="space-y-4 pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  <Select
                    value={status}
                    onValueChange={onFilterChange((v) => setStatus(v as FlagStatus))}
                  >
                    <SelectTrigger className="w-[190px]">
                      <SelectValue placeholder={t("filters.status")} />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`status.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={source} onValueChange={onFilterChange(setSource)}>
                    <SelectTrigger className="w-[210px]">
                      <SelectValue placeholder={t("filters.source")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("filters.allSources")}</SelectItem>
                      {SOURCES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`source.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={severity} onValueChange={onFilterChange(setSeverity)}>
                    <SelectTrigger className="w-[210px]">
                      <SelectValue placeholder={t("filters.severity")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("filters.allSeverities")}</SelectItem>
                      {SEVERITIES.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`severity.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => {
                      setLoading(true);
                      void load();
                    }}
                    disabled={loading}
                  >
                    {t("refresh")}
                  </Button>
                </div>

                {error && <p className="text-destructive text-sm">{error}</p>}

                {loading ? (
                  <div className="flex justify-center py-12">
                    <Spinner />
                  </div>
                ) : (
                  <FlagQueueTable
                    flags={flags}
                    canDecide={canDecide}
                    onReview={setReviewing}
                  />
                )}

                <Pagination
                  page={page}
                  pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
                  onPageChange={(next) => {
                    setLoading(true);
                    setPage(next);
                  }}
                  previousLabel={t("pagination.previous")}
                  nextLabel={t("pagination.next")}
                  pageLabel={(current, count) =>
                    t("pagination.label", { page: current, count })
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="duplicates">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={duplicateStatus}
                  onValueChange={(value) => {
                    setLoading(true);
                    setDuplicateStatus(value as DuplicateStatus);
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder={t("filters.status")} />
                  </SelectTrigger>
                  <SelectContent>
                    {DUPLICATE_STATUSES.map((value) => (
                      <SelectItem key={value} value={value}>
                        {t(`duplicates.status.${value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <DuplicateQueue
                  candidates={duplicates}
                  canDecide={canDecide}
                  onDecided={() => {
                    setLoading(true);
                    void load();
                  }}
                  onMerge={setMergingCandidate}
                />
              )}
            </div>
          </TabsContent>

          <TabsContent value="merges">
            <div className="space-y-4">
              {error && <p className="text-destructive text-sm">{error}</p>}
              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <MergeHistory
                  merges={merges}
                  canDecide={canDecide}
                  onUndone={() => {
                    setLoading(true);
                    void load();
                  }}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>

        <MergeDialog
          // Keyed by the pair, for the same reason as the flag dialog: a fresh
          // dialog resets the chosen survivor and note without an effect that
          // writes state on open.
          key={mergingCandidate?.id ?? "no-merge"}
          candidate={mergingCandidate}
          onClose={() => setMergingCandidate(null)}
          onMerged={() => {
            setMergingCandidate(null);
            setLoading(true);
            void load();
          }}
        />

        <FlagReviewDialog
          // Keyed by the flag: a fresh dialog per finding resets its note and
          // error without an effect that writes state on open.
          key={reviewing?.id ?? "none"}
          flag={reviewing}
          onClose={() => setReviewing(null)}
          onDecided={() => {
            setReviewing(null);
            setLoading(true);
            void load();
          }}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
