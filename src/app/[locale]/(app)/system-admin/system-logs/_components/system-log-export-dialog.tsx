"use client";

import { Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Organization } from "@/services/organizations/organizations.types";
import { systemLogsService } from "@/services/system-logs/system-logs.service";
import {
  SYSTEM_LOG_CATEGORIES,
  SYSTEM_LOG_LEVELS,
} from "@/services/system-logs/system-logs.types";
import {
  ALL,
  WARN_AND_ABOVE,
  buildSystemLogFilters,
  type SystemLogFilterSelection,
} from "./system-log-filter-utils";

/**
 * Confirm-before-export. The CSV has always honoured the active filters, but
 * the user had no way to see that before the file landed — so a download of
 * "errors / startup / Acme" was indistinguishable from a download of
 * everything. This dialog states the criteria and the matched count in words,
 * and lets them be changed here, so the file's contents are never a surprise.
 *
 * The draft starts from the table's filters but is independent of them:
 * adjusting the export does not disturb the rows on screen.
 */
export function SystemLogExportDialog({
  open,
  onOpenChange,
  selection,
  organizations,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selection: SystemLogFilterSelection;
  organizations: Organization[];
}) {
  const t = useTranslations("systemAdmin.systemLogs");

  // Seeded once per mount — the page mounts this only while it is open, so
  // every open proposes what the user is currently looking at without an
  // effect writing state back on render.
  const [draft, setDraft] = useState<SystemLogFilterSelection>(selection);
  const [matched, setMatched] = useState<number | null>(null);
  const [counting, setCounting] = useState(true);
  const [countFailed, setCountFailed] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFailed, setExportFailed] = useState(false);

  const filters = useMemo(() => buildSystemLogFilters(draft), [draft]);

  // Same stale-response guard as the table: the count must belong to the
  // criteria currently shown, or the button would promise the wrong number.
  // State is written only from the promise callbacks, which keeps this off
  // React's cascading-render path — `counting` is flipped back on by the
  // handler that changes a criterion.
  const countRef = useRef(0);

  useEffect(() => {
    const requestId = ++countRef.current;
    systemLogsService
      .list({ ...filters, limit: 1, offset: 0 })
      .then((res) => {
        if (requestId !== countRef.current) return;
        setMatched(res?.total ?? 0);
        setCountFailed(false);
        setCounting(false);
      })
      .catch(() => {
        if (requestId !== countRef.current) return;
        setMatched(null);
        setCountFailed(true);
        setCounting(false);
      });
  }, [filters]);

  const set = <K extends keyof SystemLogFilterSelection>(
    key: K,
    value: SystemLogFilterSelection[K],
  ) => {
    setCounting(true);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const organizationName =
    draft.organizationId === ALL
      ? t("allOrganizations")
      : (organizations.find((o) => o.id === draft.organizationId)?.name ??
        draft.organizationId);

  const levelLabel =
    draft.levelFilter === ALL
      ? t("allLevels")
      : draft.levelFilter === WARN_AND_ABOVE
        ? t("warnAndAbove")
        : t(`levels.${draft.levelFilter}`);

  // Only the criteria that actually narrow the file are worth restating.
  const criteria: { label: string; value: string }[] = [
    { label: t("filterLevel"), value: levelLabel },
    {
      label: t("filterCategory"),
      value:
        draft.category === ALL ? t("allCategories") : t(`categories.${draft.category}`),
    },
    { label: t("columns.organization"), value: organizationName },
  ];
  if (draft.eventCode)
    criteria.push({ label: t("detail.eventCode"), value: draft.eventCode });
  if (draft.search.trim())
    criteria.push({ label: t("export.searchCriterion"), value: draft.search.trim() });

  const handleExport = async () => {
    setExporting(true);
    setExportFailed(false);
    try {
      await systemLogsService.downloadCsv(filters);
      onOpenChange(false);
    } catch (err) {
      console.error("System log export failed:", err);
      setExportFailed(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Wider than the default sm:max-w-sm: three filter selects side by
          side plus the criteria chips need the room, and truncated option
          labels would defeat the point of confirming what gets exported. */}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
          <DialogDescription>{t("export.description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <div className="space-y-1.5">
              <Label className="text-xs whitespace-nowrap">{t("filterLevel")}</Label>
              <Select
                value={draft.levelFilter}
                onValueChange={(v) => set("levelFilter", v)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder={t("filterLevel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allLevels")}</SelectItem>
                  <SelectItem value={WARN_AND_ABOVE}>{t("warnAndAbove")}</SelectItem>
                  {SYSTEM_LOG_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {t(`levels.${level}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs whitespace-nowrap">{t("filterCategory")}</Label>
              <Select value={draft.category} onValueChange={(v) => set("category", v)}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder={t("filterCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allCategories")}</SelectItem>
                  {SYSTEM_LOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(`categories.${c}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs whitespace-nowrap">
                {t("columns.organization")}
              </Label>
              <Select
                value={draft.organizationId}
                onValueChange={(v) => set("organizationId", v)}
              >
                <SelectTrigger className="w-full text-xs">
                  <SelectValue placeholder={t("filterOrganization")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("allOrganizations")}</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* What the file will contain, in words. */}
          <div className="border-border bg-muted/40 space-y-2 rounded-md border p-3">
            <span className="text-muted-foreground text-[11px]">
              {t("export.summaryTitle")}
            </span>
            <ul className="flex flex-wrap gap-2">
              {criteria.map((c) => (
                <li
                  key={c.label}
                  className="border-border bg-background rounded border px-2 py-1 text-[11px]"
                >
                  <span className="text-muted-foreground">{c.label}: </span>
                  <span className="text-foreground font-medium">{c.value}</span>
                </li>
              ))}
            </ul>

            {(draft.eventCode || draft.search.trim()) && (
              <p className="text-muted-foreground text-[11px]">
                {t("export.inheritedNotice")}
              </p>
            )}

            <p className="text-foreground text-xs">
              {counting
                ? t("export.counting")
                : countFailed
                  ? t("export.countFailed")
                  : matched === 0
                    ? t("export.noMatches")
                    : t("export.matchedCount", { count: matched ?? 0 })}
            </p>
          </div>

          {exportFailed && (
            <p className="text-destructive text-xs">{t("export.failed")}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("export.cancel")}
          </Button>
          <Button
            onClick={handleExport}
            disabled={exporting || counting || matched === 0}
            className="gap-1"
          >
            <Download className="size-3.5" />
            {exporting ? t("export.exporting") : t("export.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
