"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError } from "@/services/api/types";
import { priorityService } from "@/services/priority/priority.service";
import type { VillageComparisonEntry } from "@/services/priority/priority.types";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

export default function VillageComparisonPage() {
  const t = useTranslations("app.villageComparison");
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [selectedStudyIds, setSelectedStudyIds] = useState<string[]>([]);
  const [entries, setEntries] = useState<VillageComparisonEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    // Nothing to fetch with an empty selection — the render below already
    // shows "select at least one study" ahead of the `entries` branches, so
    // a stale `entries` value from a previous selection is never shown.
    if (selectedStudyIds.length === 0) return;
    let active = true;
    queueMicrotask(() => {
      if (active) void loadComparison(selectedStudyIds);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStudyIds]);

  return (
    <PermissionGuard module="priorityScoring" action="read">
      <PageContainer>
        <BackButton href="/priority-dashboard" label={t("backToDashboard")} />
        <PageHeader title={t("title")} description={t("description")} />

        <Card className="mt-4">
          <CardContent className="p-5">
            <p className="text-muted-foreground mb-2 text-xs font-medium">
              {t("selectStudiesLabel")}
            </p>
            <MultiSelect
              options={studies.map((s) => ({ value: s.id, label: s.title }))}
              values={selectedStudyIds}
              onChange={setSelectedStudyIds}
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
          <Card className="mt-4">
            <CardContent className="overflow-x-auto p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.village")}</TableHead>
                    <TableHead>{t("columns.priorityScore")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.critical")}</TableHead>
                    <TableHead>{t("columns.high")}</TableHead>
                    <TableHead>{t("columns.totalNeeds")}</TableHead>
                    <TableHead>{t("columns.affectedPopulation")}</TableHead>
                    <TableHead>{t("columns.needTypes")}</TableHead>
                    <TableHead>{t("columns.domainSeverity")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.village}>
                      <TableCell className="font-medium">{entry.village}</TableCell>
                      <TableCell>
                        {entry.priorityScore !== null
                          ? entry.priorityScore.toFixed(1)
                          : "—"}
                      </TableCell>
                      <TableCell>
                        {entry.priorityStatus ? (
                          <Badge variant="outline">{entry.priorityStatus}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>{entry.criticalNeedCount}</TableCell>
                      <TableCell>{entry.highNeedCount}</TableCell>
                      <TableCell>{entry.totalNeedCount}</TableCell>
                      <TableCell>
                        {entry.affectedPeople === null &&
                        entry.affectedHouseholds === null ? (
                          "—"
                        ) : (
                          <div className="text-xs">
                            {entry.affectedPeople !== null ? (
                              <div>
                                {t("columns.affectedPeopleValue", {
                                  count: entry.affectedPeople,
                                })}
                              </div>
                            ) : null}
                            {entry.affectedHouseholds !== null ? (
                              <div>
                                {t("columns.affectedHouseholdsValue", {
                                  count: entry.affectedHouseholds,
                                })}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Object.entries(entry.needTypeCounts).map(([domain, count]) => (
                            <Badge key={domain} variant="secondary" className="text-xs">
                              {domain} ({count})
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.domainComponents === null ||
                        entry.domainComponents.length === 0 ? (
                          <span className="text-muted-foreground text-xs">
                            {t("noDomainData")}
                          </span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {entry.domainComponents.map((dc) => (
                              <Badge
                                key={dc.domainKey}
                                variant={dc.triggeredOverride ? "destructive" : "outline"}
                                className="text-xs"
                              >
                                {dc.domainNameSnapshot}:{" "}
                                {Math.round(dc.domainSeverityScore)}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </PageContainer>
    </PermissionGuard>
  );
}
