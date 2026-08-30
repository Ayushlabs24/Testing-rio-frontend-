"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import { cn } from "@/lib/utils";
import { ApiError } from "@/services/api/types";
import { priorityService } from "@/services/priority/priority.service";
import type { VillageComparisonEntry } from "@/services/priority/priority.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

// Same critical/high/medium/low → variant mapping the main Priority
// Dashboard list uses (see LEVEL_VARIANT there) — the API sends this field
// upper-cased ("HIGH"), the dashboard's own type lower-cases it, so this
// normalizes before mapping rather than duplicating a second casing.
const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  critical: "destructive",
  high: "default",
  medium: "secondary",
  low: "outline",
};

function statusVariant(
  status: string | null,
): "default" | "secondary" | "outline" | "destructive" {
  if (!status) return "outline";
  return STATUS_VARIANT[status.toLowerCase()] ?? "outline";
}

/** One village's full comparison, as its own card — laid out so every card
 * shows the same fields in the same vertical order, making a column-to-
 * column scan across cards do the actual "compare" work a plain wide table
 * left to horizontal scrolling. */
function VillageCard({
  entry,
  t,
}: {
  entry: VillageComparisonEntry;
  t: ReturnType<typeof useTranslations>;
}) {
  const hasAffected = entry.affectedPeople !== null || entry.affectedHouseholds !== null;
  return (
    <Card className="flex flex-col">
      <CardHeader className="gap-3 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground text-base font-semibold break-words">
            {entry.village}
          </h3>
          {entry.priorityStatus ? (
            <Badge variant={statusVariant(entry.priorityStatus)} className="shrink-0">
              {entry.priorityStatus}
            </Badge>
          ) : null}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-foreground text-3xl font-bold tabular-nums">
            {entry.priorityScore !== null ? entry.priorityScore.toFixed(1) : "—"}
          </span>
          <span className="text-muted-foreground text-xs">
            {t("columns.priorityScore")}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4 pt-0">
        <div className="border-border grid grid-cols-3 gap-2 border-y py-3 text-center">
          <div>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {entry.criticalNeedCount}
            </p>
            <p className="text-muted-foreground text-[11px]">{t("columns.critical")}</p>
          </div>
          <div className="border-border border-x">
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {entry.highNeedCount}
            </p>
            <p className="text-muted-foreground text-[11px]">{t("columns.high")}</p>
          </div>
          <div>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {entry.totalNeedCount}
            </p>
            <p className="text-muted-foreground text-[11px]">{t("columns.totalNeeds")}</p>
          </div>
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            {t("columns.affectedPopulation")}
          </p>
          {hasAffected ? (
            <div className="text-foreground text-sm">
              {entry.affectedPeople !== null ? (
                <p>{t("columns.affectedPeopleValue", { count: entry.affectedPeople })}</p>
              ) : null}
              {entry.affectedHouseholds !== null ? (
                <p>
                  {t("columns.affectedHouseholdsValue", {
                    count: entry.affectedHouseholds,
                  })}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">—</p>
          )}
        </div>

        <div>
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            {t("columns.needTypes")}
          </p>
          <div className="flex flex-wrap gap-1">
            {Object.entries(entry.needTypeCounts).map(([domain, count]) => (
              <Badge key={domain} variant="secondary" className="text-xs">
                {domain} ({count})
              </Badge>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <p className="text-muted-foreground mb-1 text-xs font-medium">
            {t("columns.domainSeverity")}
          </p>
          {entry.domainComponents === null || entry.domainComponents.length === 0 ? (
            <p className="text-muted-foreground text-xs">{t("noDomainData")}</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {entry.domainComponents.map((dc) => (
                <Badge
                  key={dc.domainKey}
                  variant={dc.triggeredOverride ? "destructive" : "outline"}
                  className="text-xs"
                >
                  {dc.domainNameSnapshot}: {Math.round(dc.domainSeverityScore)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function VillageComparisonPage() {
  const t = useTranslations("app.villageComparison");
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [selectedStudyIds, setSelectedStudyIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<VillageComparisonEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  useEffect(() => {
    studiesService
      .list()
      .then(setStudies)
      .catch(() => undefined);
  }, []);

  async function loadComparison(studyIds: string[]) {
    setLoading(true);
    setError(null);
    try {
      setEntries(await priorityService.compareVillages(studyIds));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t("loadError"));
    } finally {
      setLoading(false);
    }
  }

  // Deliberately NOT reactive on every `selectedStudyIds` change — checking
  // several studies in a row used to re-run the comparison after each
  // individual click, which also meant the picker never visually settled
  // before the page below it jumped. Now it only runs once the picker
  // actually closes (Done, outside click, or Esc), or immediately when a
  // chip is removed with the picker already closed (that's a single,
  // deliberate action with nothing left to batch).
  function applySelection(next: string[]) {
    setSelectedStudyIds(next);
    if (isPickerOpen) return;
    if (next.length > 0) void loadComparison(next);
    else setEntries(null);
  }

  function handlePickerOpenChange(open: boolean) {
    setIsPickerOpen(open);
    if (open) return;
    if (selectedStudyIds.length > 0) void loadComparison(selectedStudyIds);
    else setEntries(null);
  }

  return (
    <PermissionGuard module="priorityScoring" action="read">
      <PageContainer>
        <div className="mb-6 flex justify-start">
          <BackButton href="/priority-dashboard" label={t("backToDashboard")} />
        </div>
        <PageHeader title={t("title")} description={t("description")} />

        <Card className="mt-4">
          <CardContent className="p-5">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {t("selectStudiesLabel")}
            </p>
            <MultiSelect
              options={studies.map((s) => ({ value: s.id, label: s.title }))}
              values={selectedStudyIds}
              onChange={applySelection}
              onOpenChange={handlePickerOpenChange}
              placeholder={t("selectStudiesPlaceholder")}
              searchPlaceholder={t("searchStudies")}
              emptyText={t("noStudiesFound")}
              removeAriaLabel={(label) => t("removeStudyAria", { study: label })}
            />
          </CardContent>
        </Card>

        {error ? <p className="text-destructive mt-4 text-sm">{error}</p> : null}

        {selectedStudyIds.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">{t("selectAtLeastOne")}</p>
        ) : loading ? (
          <p className="text-muted-foreground mt-6 text-sm">{t("loading")}</p>
        ) : entries && entries.length === 0 ? (
          <p className="text-muted-foreground mt-6 text-sm">{t("noVillages")}</p>
        ) : entries ? (
          <div
            className={cn(
              "mt-4 grid grid-cols-1 gap-4",
              entries.length >= 2 && "md:grid-cols-2",
              entries.length >= 3 && "xl:grid-cols-3",
            )}
          >
            {entries.map((entry) => (
              <VillageCard key={entry.village} entry={entry} t={t} />
            ))}
          </div>
        ) : null}
      </PageContainer>
    </PermissionGuard>
  );
}
