"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Link } from "@/i18n/navigation";
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
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/components/providers/auth-provider";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  CleaningFlag,
  CleaningSeverity,
  CleaningSource,
  DataQualitySummary,
  DuplicateCandidate,
  DuplicateScopes,
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
  // Q23 puts threshold tuning with System Admin / Data Analyst — the same
  // grant, a different action.
  const canTune = usePermission("dataQuality", "write");
  // RIO-AI-004 / Q9 — cross-entity duplicate pairs are the Center/NCNP
  // Supervisor's alone. The endpoint returns an empty page for anyone else, so
  // this only decides whether to ASK for them and whether to show the section
  // at all; it is not the gate.
  const { session } = useAuth();
  const isCrossEntity = session?.role.crossEntity ?? false;

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
  //
  // The thresholds that produced all of this are NOT here. They live on
  // Methodology Configuration, next to the priority thresholds, because that
  // is the record they are versioned in. This screen is where you act on
  // findings; that screen is where you decide what counts as one.
  const [tab, setTab] = useState<"findings" | "duplicates" | "merges" | "crossEntity">(
    "findings",
  );
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[]>([]);
  const [duplicateStatus, setDuplicateStatus] = useState<DuplicateStatus>("pending");
  const [merges, setMerges] = useState<MergeHistoryItem[]>([]);
  const [mergingCandidate, setMergingCandidate] = useState<DuplicateCandidate | null>(
    null,
  );
  const [duplicateTotal, setDuplicateTotal] = useState(0);
  const [crossEntity, setCrossEntity] = useState<DuplicateCandidate[]>([]);
  // The WHOLE duplicateScopes object, not just the cross-entity flag: the
  // settings API merges key by key, so a patch carrying only { crossOrg } would
  // drop the within-study and within-entity scopes alongside it.
  const [scopes, setScopes] = useState<DuplicateScopes>({});
  const [togglingScope, setTogglingScope] = useState(false);
  const crossOrgEnabled = scopes.crossOrg === true;
  const [scanning, setScanning] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  // What the last semantic scan did. Null until one is run: "not run yet" and
  // "ran and found nothing" are different things, and the line under the
  // heading has to say which.
  const [semanticResult, setSemanticResult] = useState<string | null>(null);
  const [semanticScanning, setSemanticScanning] = useState(false);

  // Returns the promise chain rather than awaiting inside the effect body:
  // a synchronous setState there triggers cascading renders (and the lint
  // rule that guards against it). `loading` starts true for the first fetch,
  // and every later reload is kicked off by a user event, which sets it.
  const load = useCallback(
    (signal?: AbortSignal) => {
      return (
        Promise.all([
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
          isCrossEntity
            ? dataQualityService.listCrossEntityDuplicates(
                { pageSize: PAGE_SIZE },
                signal,
              )
            : Promise.resolve({ items: [], total: 0 }),
          isCrossEntity ? dataQualityService.getSettings(signal) : Promise.resolve(null),
        ])
          .then(
            ([pageData, summaryData, duplicatePage, mergePage, crossPage, settings]) => {
              setFlags(pageData.items);
              setTotal(pageData.total);
              setSummary(summaryData);
              setDuplicates(duplicatePage.items);
              setDuplicateTotal(duplicatePage.total);
              setMerges(mergePage.items);
              setCrossEntity(crossPage.items);
              setScopes(settings?.duplicateScopes ?? {});
              setError(null);
            },
          )
          // Two-argument `then` rather than `.catch(...).finally(...)`: on the
          // cancelled path neither handler must run, and a `finally` would clear
          // `loading` for a request whose replacement is still in flight.
          .then(
            () => setLoading(false),
            (cause: unknown) => {
              // Same reasoning as CleaningSettingsPanel: an aborted request is a
              // superseded one, not a broken one.
              if (cause instanceof ApiError && cause.cancelled) return;
              setError(t("loadError"));
              setLoading(false);
            },
          )
      );
    },
    [page, source, status, severity, duplicateStatus, isCrossEntity, t],
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
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Link
              href="/settings/methodology"
              className="text-muted-foreground hover:text-foreground text-sm underline underline-offset-4"
            >
              {t("thresholdsMoved")}
            </Link>
          }
        />

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
            {/* Q9 — only oversight roles get this tab. The endpoints behind it
                return empty for anyone else, so this hides a surface rather
                than granting one. */}
            {isCrossEntity && (
              <TabsTrigger value="crossEntity">
                {t("tabs.crossEntity")}
                {crossEntity.length > 0 ? ` (${crossEntity.length})` : ""}
              </TabsTrigger>
            )}
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
              {/* RIO-AI-004 — the semantic pass feeds THIS queue, not a
                  separate one (Q40: one shared queue). The badge on each pair
                  says which pass proposed it, and a semantic pair carries the
                  model's stated reason.

                  An explicit button rather than a background job: the pass
                  sends need text to an external model, which should not start
                  happening on a timer before the client has ruled on
                  residency (Q10). */}
              {canTune && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t("semantic.title")}</p>
                    <p className="text-muted-foreground max-w-2xl text-xs">
                      {semanticResult ?? t("semantic.description")}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={semanticScanning}
                    onClick={() => {
                      setSemanticScanning(true);
                      setSemanticResult(null);
                      void dataQualityService
                        .scanSemantic()
                        .then((result) => {
                          // A disabled provider and a scan that found nothing
                          // are different outcomes, and the line under the
                          // heading says which one happened.
                          setSemanticResult(
                            result.skippedReason
                              ? t(`semantic.skipped.${result.skippedReason}`)
                              : t("semantic.result", {
                                  embedded: result.embedded,
                                  compared: result.compared,
                                  proposed: result.proposed,
                                }),
                          );
                          setLoading(true);
                          return load();
                        })
                        .catch(() => setSemanticResult(t("semantic.error")))
                        .finally(() => setSemanticScanning(false));
                    }}
                  >
                    {semanticScanning ? t("semantic.scanning") : t("semantic.scan")}
                  </Button>
                </div>
              )}

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

          {/* RIO-AI-004 / Q9 — cross-entity matches, Center/NCNP only.
              Its own tab rather than a section under Possible duplicates,
              because the decision is different in kind. A pair inside one
              entity asks "did we record this twice?"; a pair ACROSS entities
              asks "are two organisations working the same need?" — oversight,
              not housekeeping. The reviewer is reading another entity's text,
              which should never happen by accident.

              The switch lives here too, next to the queue it fills, rather
              than with the detection thresholds: those are numbers that tune a
              comparison, this is a decision about a boundary. */}
          {isCrossEntity && (
            <TabsContent value="crossEntity">
              <div className="space-y-6">
                <Card>
                  <CardContent className="flex flex-wrap items-start justify-between gap-4 pt-6">
                    <div className="max-w-2xl space-y-1">
                      <h2 className="text-base font-semibold">
                        {t("settings.fields.crossOrg.label")}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {t("settings.fields.crossOrg.help")}
                      </p>
                      {scopeError && (
                        <p className="text-destructive text-sm">{scopeError}</p>
                      )}
                    </div>
                    <Switch
                      id="crossOrg"
                      // Q23 gives this to System Admin / Data Analyst, and the
                      // API additionally refuses to ENABLE it for a role that
                      // cannot read across entities.
                      disabled={!canTune || togglingScope}
                      checked={crossOrgEnabled}
                      onCheckedChange={(next) => {
                        const updated = { ...scopes, crossOrg: next };
                        setScopes(updated);
                        setScopeError(null);
                        setTogglingScope(true);
                        void dataQualityService
                          .updateSettings({ duplicateScopes: updated })
                          .then(() => {
                            setLoading(true);
                            return load();
                          })
                          .catch(() => {
                            // Put the switch back where it was: leaving it
                            // showing "on" after a refused save would be the
                            // screen lying about the boundary.
                            setScopes(scopes);
                            setScopeError(t("crossEntity.toggleError"));
                          })
                          .finally(() => setTogglingScope(false));
                      }}
                    />
                  </CardContent>
                </Card>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <h2 className="text-base font-semibold">
                        {t("crossEntity.title")}
                      </h2>
                      <p className="text-muted-foreground max-w-2xl text-sm">
                        {t("crossEntity.description")}
                      </p>
                    </div>
                    {canTune && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={scanning || !crossOrgEnabled}
                        title={crossOrgEnabled ? undefined : t("crossEntity.off")}
                        onClick={() => {
                          setScanning(true);
                          void dataQualityService
                            .scanCrossEntity()
                            .then(() => {
                              setLoading(true);
                              return load();
                            })
                            .catch(() => setError(t("crossEntity.scanError")))
                            .finally(() => setScanning(false));
                        }}
                      >
                        {scanning ? t("crossEntity.scanning") : t("crossEntity.scan")}
                      </Button>
                    )}
                  </div>

                  {crossEntity.length === 0 ? (
                    <p className="text-muted-foreground py-6 text-center text-sm">
                      {crossOrgEnabled ? t("crossEntity.empty") : t("crossEntity.off")}
                    </p>
                  ) : (
                    <DuplicateQueue
                      candidates={crossEntity}
                      canDecide={canDecide}
                      onDecided={() => {
                        setLoading(true);
                        void load();
                      }}
                      // Merging across entities is refused by the service
                      // (CROSS_ORG_MERGE): moving one entity's data into
                      // another's is not something the client's answers
                      // authorise. The reviewer records the finding instead.
                      onMerge={() => undefined}
                    />
                  )}
                </div>
              </div>
            </TabsContent>
          )}
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
