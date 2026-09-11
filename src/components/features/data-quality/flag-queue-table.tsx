"use client";

import { useTranslations } from "next-intl";
import { AutoTranslate } from "@/components/common/auto-translate";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type {
  CleaningFlag,
  CleaningSeverity,
} from "@/services/data-quality/data-quality.types";

// A severity is what the finding IS, so it reads as a coloured marker rather
// than a filled pill — the only filled control in a row should be the one you
// can click. Same reasoning as the Reviewer Alerts status dot.
const SEVERITY_DOT: Record<CleaningSeverity, string> = {
  missing: "bg-destructive",
  non_standard: "bg-primary",
  out_of_vocabulary: "bg-amber-500",
};

// `flag.field` is a finite, backend-defined set (see the rules in
// data-cleaning/rules/*.ts) — `village[0]`, `village[1]`, ... included, with
// the index kept as-is since it's positional, not translatable content.
export function describeField(
  field: string,
  t: ReturnType<typeof useTranslations>,
): string {
  const villageMatch = /^village\[(\d+)\]$/.exec(field);
  if (villageMatch) return `${t("fields.village")}[${villageMatch[1]}]`;
  return t.has(`fields.${field}`)
    ? t(`fields.${field}` as Parameters<typeof t>[0])
    : field;
}

interface FlagQueueTableProps {
  flags: CleaningFlag[];
  canDecide: boolean;
  onReview: (flag: CleaningFlag) => void;
}

export function FlagQueueTable({ flags, canDecide, onReview }: FlagQueueTableProps) {
  const t = useTranslations("app.dataQuality");
  const { localizedDomain, localizedSubDomain } = useDomainArabicMap();
  // Domain/Sub-domain are master data with an exact, canonical Arabic name —
  // resolved that way instead of AI-translated, so the value shown here
  // always matches what every other Domain display in the app shows for the
  // same name. Every other flagged field (village, contact, ...) has no such
  // master-data table, so those fall back to AutoTranslate.
  const localizeFieldValue = (field: string, value: string) =>
    field === "domain"
      ? localizedDomain(value)
      : field === "subDomain"
        ? localizedSubDomain(value)
        : null;

  if (flags.length === 0) {
    return (
      <p className="text-muted-foreground py-10 text-center text-sm">{t("empty")}</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("columns.record")}</TableHead>
            <TableHead>{t("columns.field")}</TableHead>
            <TableHead>{t("columns.finding")}</TableHead>
            <TableHead>{t("columns.current")}</TableHead>
            <TableHead>{t("columns.proposed")}</TableHead>
            <TableHead className="text-end">{t("columns.action")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {flags.map((flag) => (
            <TableRow key={flag.id}>
              <TableCell className="max-w-xs min-w-[220px]">
                <span dir="auto" className="block text-sm break-words whitespace-normal">
                  {flag.entityLabel ? <AutoTranslate text={flag.entityLabel} /> : "—"}
                </span>
                <span className="text-muted-foreground text-xs">
                  {t(`source.${flag.source}`)}
                </span>
              </TableCell>

              <TableCell className="text-sm">{describeField(flag.field, t)}</TableCell>

              <TableCell>
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      SEVERITY_DOT[flag.severity],
                    )}
                  />
                  <span className="text-sm">{t(`rule.${flag.ruleCode}`)}</span>
                </span>
                {flag.confidence !== null && (
                  <span className="text-muted-foreground text-xs">
                    {t("confidence", { value: Math.round(flag.confidence * 100) })}
                  </span>
                )}
              </TableCell>

              <TableCell className="max-w-[220px] min-w-[160px]">
                <span dir="auto" className="block text-sm break-words whitespace-normal">
                  {flag.originalValue ? (
                    (localizeFieldValue(flag.field, flag.originalValue) ?? (
                      <AutoTranslate text={flag.originalValue} />
                    ))
                  ) : (
                    <span className="text-muted-foreground italic">{t("noValue")}</span>
                  )}
                </span>
                {flag.detail?.redacted && (
                  // The reviewer needs to know the value is hidden ON PURPOSE,
                  // not that the field is empty — otherwise a masked phone
                  // number reads as missing data.
                  <span className="text-muted-foreground text-xs">{t("redacted")}</span>
                )}
              </TableCell>

              <TableCell className="max-w-[220px] min-w-[160px]">
                {flag.proposedValue !== null ? (
                  <span
                    dir="auto"
                    className="block text-sm break-words whitespace-normal"
                  >
                    {localizeFieldValue(flag.field, flag.proposedValue) ?? (
                      <AutoTranslate text={flag.proposedValue} />
                    )}
                  </span>
                ) : flag.acceptable ? (
                  <span className="text-muted-foreground text-sm">
                    {flag.detail?.proposedShape ?? t("recomputedOnAccept")}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-sm italic">
                    {t("fixOnRecord")}
                  </span>
                )}
              </TableCell>

              <TableCell className="text-end">
                {flag.status === "pending" ? (
                  canDecide ? (
                    <Button size="sm" variant="outline" onClick={() => onReview(flag)}>
                      {t("actions.review")}
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">{t("readOnly")}</span>
                  )
                ) : (
                  <Badge variant="secondary">{t(`status.${flag.status}`)}</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
