"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { FormattedDate } from "@/components/common/formatted-date";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { dataQualityService } from "@/services/data-quality/data-quality.service";
import type {
  CleaningSource,
  DataQualitySummary,
} from "@/services/data-quality/data-quality.types";

const SOURCES: CleaningSource[] = ["manual_entry", "survey_response", "file_upload"];

/**
 * Rules whose proposals are the SAME deterministic reformat every time. Only
 * these get a bulk action — a village near-match is a judgement about one
 * specific place, and offering "accept all" for it would be asking a reviewer
 * to approve hundreds of decisions they never saw. The backend enforces the
 * same list; this is what stops the button appearing in the first place.
 */
const BULK_ACCEPTABLE = new Set([
  "DATE_FORMAT",
  "PHONE_FORMAT",
  "NUMBER_FORMAT",
  "UNIT_MISMATCH",
]);

interface DataQualitySummaryProps {
  summary: DataQualitySummary;
  pendingTotal: number;
  canDecide: boolean;
  onBulkAccepted: () => void;
}

export function DataQualitySummaryCards({
  summary,
  pendingTotal,
  canDecide,
  onBulkAccepted,
}: DataQualitySummaryProps) {
  const t = useTranslations("app.dataQuality");
  const [busyRule, setBusyRule] = useState<string | null>(null);

  const pendingBySource = new Map(
    summary.bySource
      .filter((row) => row.status === "pending")
      .map((row) => [row.source, row.count]),
  );

  const bulkAccept = async (ruleCode: string) => {
    setBusyRule(ruleCode);
    try {
      await dataQualityService.bulkAccept(ruleCode);
      onBulkAccepted();
    } finally {
      setBusyRule(null);
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Q14's per-source report: the counts are the report, one column per
          source, so "what is wrong with each source's data" is answerable at
          a glance rather than by filtering three times. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-xs">{t("summary.openTotal")}</p>
            <p className="text-2xl font-semibold tabular-nums">{pendingTotal}</p>
            {summary.lastRunAt && (
              <p className="text-muted-foreground mt-1 text-xs">
                {t("summary.lastRun")} <FormattedDate value={summary.lastRunAt} />
              </p>
            )}
          </CardContent>
        </Card>

        {SOURCES.map((source) => (
          <Card key={source}>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-xs">{t(`source.${source}`)}</p>
              <p className="text-2xl font-semibold tabular-nums">
                {pendingBySource.get(source) ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {summary.byRule.length > 0 && (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-muted-foreground text-xs">{t("summary.byRule")}</p>
            <ul className="divide-y">
              {summary.byRule.map((row) => (
                <li
                  key={`${row.ruleCode}-${row.source}`}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm">
                    {t(`rule.${row.ruleCode}`)}
                    <span className="text-muted-foreground">
                      {" "}
                      · {t(`source.${row.source}`)}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">{row.count}</span>
                    {canDecide && BULK_ACCEPTABLE.has(row.ruleCode) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busyRule !== null}
                        onClick={() => void bulkAccept(row.ruleCode)}
                      >
                        {busyRule === row.ruleCode
                          ? t("actions.applying")
                          : t("actions.acceptAll")}
                      </Button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
