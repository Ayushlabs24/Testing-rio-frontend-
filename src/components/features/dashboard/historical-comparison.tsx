"use client";

import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { needsService } from "@/services/needs/needs.service";
import { studiesService } from "@/services/studies/studies.service";
import type { Need } from "@/services/needs/needs.types";
import type { StudySummary } from "@/services/studies/studies.types";

const ALL = "all";

/** One row of the comparison: the same village or domain counted once in
 *  the imported prior study and once in the studies run since. */
interface ComparisonRow {
  key: string;
  historical: number;
  current: number;
}

/**
 * RIO-DATA-002 / FR-17, acceptance criterion 2 — "filtering and comparison
 * work" for imported prior-study data.
 *
 * Because an import produces an ordinary Study flagged `isHistorical`
 * rather than a parallel table, comparing old against new is just a matter
 * of partitioning needs by that flag. Same needs, same domains, same
 * villages, same FR-003 priority scoring — only the side of the line
 * differs.
 *
 * The change column is deliberately current minus historical: a positive
 * number means the area reports more needs now than in the prior study,
 * which is the direction a reader cares about.
 */
export function HistoricalComparison() {
  const t = useTranslations("app.dashboard.historicalComparison");
  const [studies, setStudies] = useState<StudySummary[]>([]);
  const [needs, setNeeds] = useState<Need[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<"village" | "domain">("village");
  const [historicalStudyId, setHistoricalStudyId] = useState<string>(ALL);
  const [sector, setSector] = useState<string>(ALL);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const stds = await studiesService.list({ limit: 100 }).catch(() => []);
        const perStudy = await Promise.all(
          stds.map((s) => needsService.listByStudy(s.id).catch(() => [])),
        );
        if (cancelled) return;
        setStudies(stds);
        setNeeds(perStudy.flat());
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const historicalStudies = useMemo(
    () => studies.filter((s) => s.isHistorical),
    [studies],
  );

  const sectors = useMemo(
    () =>
      Array.from(
        new Set(studies.map((s) => s.targetSector).filter((v): v is string => !!v)),
      ).sort(),
    [studies],
  );

  const rows = useMemo<ComparisonRow[]>(() => {
    if (historicalStudies.length === 0) return [];

    const studyById = new Map(studies.map((s) => [s.id, s]));
    const selectedHistoricalIds = new Set(
      historicalStudies
        .filter((s) => historicalStudyId === ALL || s.id === historicalStudyId)
        .map((s) => s.id),
    );

    const tally = new Map<string, ComparisonRow>();
    function bump(key: string, side: "historical" | "current") {
      const row = tally.get(key) ?? { key, historical: 0, current: 0 };
      row[side] += 1;
      tally.set(key, row);
    }

    for (const need of needs) {
      const study = studyById.get(need.studyId);
      if (!study) continue;
      if (sector !== ALL && study.targetSector !== sector) continue;

      // Picking one prior study narrows only the historical side. The
      // current side stays the full baseline, otherwise there is nothing
      // to compare against.
      if (study.isHistorical && !selectedHistoricalIds.has(study.id)) continue;

      const keys =
        groupBy === "village"
          ? need.village.length > 0
            ? need.village
            : [t("unassigned")]
          : [need.domain ?? t("unclassified")];

      for (const key of keys) bump(key, study.isHistorical ? "historical" : "current");
    }

    return [...tally.values()]
      .filter((row) => row.historical > 0 || row.current > 0)
      .sort((a, b) => b.historical + b.current - (a.historical + a.current));
  }, [needs, studies, historicalStudies, historicalStudyId, sector, groupBy, t]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          historical: acc.historical + row.historical,
          current: acc.current + row.current,
        }),
        { historical: 0, current: 0 },
      ),
    [rows],
  );

  // Nothing imported yet, so there is no prior study to compare against.
  // Saying so beats an empty table with no explanation.
  if (!loading && historicalStudies.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">{t("noHistorical")}</p>
        </CardContent>
      </Card>
    );
  }

  const totalDelta = totals.current - totals.historical;

  return (
    <Card>
      <CardHeader className="gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="size-4" />
          {t("title")}
        </CardTitle>
        <p className="text-muted-foreground text-sm">{t("description")}</p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            value={groupBy}
            onValueChange={(v) => setGroupBy(v as "village" | "domain")}
          >
            <SelectTrigger className="h-8 w-full sm:w-40" aria-label={t("groupByLabel")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="village">{t("groupByVillage")}</SelectItem>
              <SelectItem value="domain">{t("groupByDomain")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={historicalStudyId} onValueChange={setHistoricalStudyId}>
            <SelectTrigger
              className="h-8 w-full sm:w-56"
              aria-label={t("priorStudyLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t("priorStudyAll")}</SelectItem>
              {historicalStudies.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.historicalStudyDate
                    ? `${s.title} (${s.historicalStudyDate.slice(0, 4)})`
                    : s.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {sectors.length > 0 ? (
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="h-8 w-full sm:w-44" aria-label={t("sectorLabel")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("sectorAll")}</SelectItem>
                {sectors.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  {groupBy === "village" ? t("villageColumn") : t("domainColumn")}
                </TableHead>
                <TableHead className="w-32 text-end">{t("priorColumn")}</TableHead>
                <TableHead className="w-32 text-end">{t("currentColumn")}</TableHead>
                <TableHead className="w-28 text-end">{t("changeColumn")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, c) => (
                      <TableCell key={c} className="py-4">
                        <div className="bg-muted h-4 w-16 rounded" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground h-24 text-center text-sm"
                  >
                    {t("noRows")}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {rows.map((row) => {
                    const delta = row.current - row.historical;
                    return (
                      <TableRow key={row.key}>
                        <TableCell className="text-sm font-medium">{row.key}</TableCell>
                        <TableCell className="text-end text-sm">
                          {row.historical}
                        </TableCell>
                        <TableCell className="text-end text-sm">{row.current}</TableCell>
                        <TableCell className="text-end">
                          <Badge variant={delta > 0 ? "destructive" : "outline"}>
                            {delta > 0 ? `+${delta}` : delta}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-muted/40 font-medium">
                    <TableCell className="text-sm">{t("totalRow")}</TableCell>
                    <TableCell className="text-end text-sm">
                      {totals.historical}
                    </TableCell>
                    <TableCell className="text-end text-sm">{totals.current}</TableCell>
                    <TableCell className="text-end text-sm">
                      {totalDelta > 0 ? `+${totalDelta}` : totalDelta}
                    </TableCell>
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
