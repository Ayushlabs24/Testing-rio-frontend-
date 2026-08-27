"use client";

import { Gauge } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { FormattedDate } from "@/components/common/formatted-date";
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
import { PRIORITY_DASHBOARD_PAGE_SIZE } from "@/config/pagination";
import { Link } from "@/i18n/navigation";
import { priorityService } from "@/services/priority/priority.service";
import { GAP_TYPES } from "@/services/priority/priority.types";
import type {
  PriorityDashboardEntry,
  PriorityScore,
} from "@/services/priority/priority.types";

const ALL = "all";

const LEVEL_VARIANT: Record<
  PriorityScore["level"],
  "default" | "secondary" | "outline" | "destructive"
> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

export default function PriorityDashboardPage() {
  const t = useTranslations("app.priorityDashboard");
  const tTheme = useTranslations("app.studies.themes");
  const [entries, setEntries] = useState<PriorityDashboardEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [levelFilter, setLevelFilter] = useState<PriorityScore["level"] | typeof ALL>(
    ALL,
  );
  const [gapTypeFilter, setGapTypeFilter] = useState<string>(ALL);
  // RIO-FR-003 AC 6 — "the ability to filter/group needs by theme". The
  // options come from the loaded rows rather than a separate fetch, so the
  // list only ever offers themes that are actually in use.
  const [themeFilter, setThemeFilter] = useState<string>(ALL);
  // Pagination (Aug 14) — this list has no upper bound (every scored Need
  // across every Study), so it needs paging like every other list page.
  const [page, setPage] = useState(1);

  useEffect(() => {
    priorityService
      .listDashboard()
      .then((rows) => {
        setEntries(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setEntries([]);
        setLoadFailed(true);
      });
  }, []);

  // AC 6's grouping — every theme in use with how many needs carry it,
  // ordered so the most widespread problem reads first.
  const themeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of entries ?? []) {
      for (const theme of entry.themes) counts.set(theme, (counts.get(theme) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([theme, needCount]) => ({ theme, needCount }))
      .sort((a, b) => b.needCount - a.needCount || a.theme.localeCompare(b.theme));
  }, [entries]);

  const summary = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0, unscored: 0 };
    for (const entry of entries ?? []) {
      if (entry.score) counts[entry.score.level] += 1;
      else counts.unscored += 1;
    }
    return counts;
  }, [entries]);

  const filtered = (entries ?? []).filter((entry) => {
    if (levelFilter !== ALL && entry.score?.level !== levelFilter) return false;
    if (gapTypeFilter !== ALL && entry.gapType !== gapTypeFilter) return false;
    if (themeFilter !== ALL && !entry.themes.includes(themeFilter)) return false;
    return true;
  });

  const pageCount = Math.max(
    1,
    Math.ceil(filtered.length / PRIORITY_DASHBOARD_PAGE_SIZE),
  );
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = filtered.slice(
    (currentPage - 1) * PRIORITY_DASHBOARD_PAGE_SIZE,
    currentPage * PRIORITY_DASHBOARD_PAGE_SIZE,
  );

  return (
    <PermissionGuard module="priorityScoring" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link href="/priority-dashboard/village-comparison">
                {t("compareVillages")}
              </Link>
            </Button>
          }
        />
        <p className="text-muted-foreground mb-6 text-xs">{t("placeholderNote")}</p>

        <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
          {(["critical", "high", "medium", "low"] as const).map((level) => (
            <Card key={level}>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-xs">
                  {t(`summary${level.charAt(0).toUpperCase()}${level.slice(1)}`)}
                </p>
                <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                  {summary[level]}
                </p>
              </CardContent>
            </Card>
          ))}
          <Card>
            <CardContent className="p-4">
              <p className="text-muted-foreground text-xs">{t("notScoredBadge")}</p>
              <p className="text-foreground mt-1 text-2xl font-semibold tabular-nums">
                {summary.unscored}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-wrap gap-3 border-b px-4 py-3">
              <Select
                value={levelFilter}
                onValueChange={(v) => {
                  setLevelFilter(v as PriorityScore["level"] | typeof ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-48"
                  aria-label={t("filterLevelLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterLevelAll")}</SelectItem>
                  <SelectItem value="critical">{t("level.critical")}</SelectItem>
                  <SelectItem value="high">{t("level.high")}</SelectItem>
                  <SelectItem value="medium">{t("level.medium")}</SelectItem>
                  <SelectItem value="low">{t("level.low")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={gapTypeFilter}
                onValueChange={(v) => {
                  setGapTypeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-48"
                  aria-label={t("filterGapTypeLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterGapTypeAll")}</SelectItem>
                  {GAP_TYPES.map((gapType) => (
                    <SelectItem key={gapType} value={gapType}>
                      {t(`gapType.${gapType}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={themeFilter}
                onValueChange={(v) => {
                  setThemeFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-56"
                  aria-label={tTheme("filterLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{tTheme("filterAll")}</SelectItem>
                  {themeCounts.map(({ theme, needCount }) => (
                    <SelectItem key={theme} value={theme}>
                      {theme} ({needCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("studyColumn")}</TableHead>
                  <TableHead className="w-28">{t("scoreColumn")}</TableHead>
                  <TableHead className="w-28">{t("levelColumn")}</TableHead>
                  <TableHead className="w-32">{t("gapTypeColumn")}</TableHead>
                  <TableHead className="w-40">{t("scoredColumn")}</TableHead>
                  <TableHead className="w-44 text-right">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 6 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <Gauge className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noScores")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEntries.map((entry) => (
                    <TableRow key={entry.needId}>
                      <TableCell className="py-4 text-sm font-medium">
                        <Link
                          href={`/priority-dashboard/${entry.needId}`}
                          className="text-primary hover:underline"
                        >
                          {entry.studyTitle}
                        </Link>
                      </TableCell>
                      <TableCell className="text-sm tabular-nums">
                        {entry.score ? Math.round(entry.score.overallScore) : "—"}
                      </TableCell>
                      <TableCell>
                        {entry.score ? (
                          <Badge variant={LEVEL_VARIANT[entry.score.level]}>
                            {t(`level.${entry.score.level}`)}
                          </Badge>
                        ) : (
                          <Badge variant="outline">{t("notScoredBadge")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.gapType ? (
                          <Badge variant="outline">{t(`gapType.${entry.gapType}`)}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {entry.score ? (
                          <FormattedDate value={entry.score.scoredAt} />
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild size="sm" variant="outline" className="gap-1.5">
                          <Link href={`/priority-dashboard/${entry.needId}`}>
                            <Gauge className="text-primary size-3.5" />
                            {t("viewMatrix")}
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {filtered.length > 0 ? (
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
