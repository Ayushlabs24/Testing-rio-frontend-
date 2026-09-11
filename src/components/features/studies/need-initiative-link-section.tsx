"use client";

import { Link2, Plus, Unlink } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnalyticalStatusBadge } from "@/components/features/studies/study-status-badge";
import { AutoTranslate } from "@/components/common/auto-translate";
import { ApiError } from "@/services/api/types";
import { initiativesService } from "@/services/initiatives/initiatives.service";
import type { Initiative } from "@/services/initiatives/initiatives.types";
import { translationService } from "@/services/translation/translation.service";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";

function LinkInitiativeDialog({
  open,
  onOpenChange,
  needId,
  excludeIds,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  needId: string;
  excludeIds: Set<string>;
  onLinked: () => void;
}) {
  const t = useTranslations("app.studies.need.linkInitiative");
  const locale = useLocale();
  const [options, setOptions] = useState<Initiative[]>([]);
  // Combobox item labels are plain strings, so <AutoTranslate> can't be hung
  // off them — resolve name + owning-org name through the same translation
  // endpoint once per list (same pattern as report-sharing-panel's org combo).
  const [labelById, setLabelById] = useState<Map<string, { name: string; org: string }>>(
    new Map(),
  );
  // Starts true, not reset in an effect — the mount site remounts this
  // dialog fresh (via a bumped `key`) on every open, so a mount always
  // starts open and about to fetch (matches the pattern in
  // initiative-form-dialog.tsx / need-summary-section.tsx).
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initiativesService
      .list()
      .then(async (rows) => {
        const list = rows.filter((r) => !excludeIds.has(r.id));
        setOptions(list);
        if (locale !== "ar") return;
        const entries = await Promise.all(
          list.map(async (o) => {
            const [name, org] = await Promise.all([
              translationService
                .translate(o.name, "ar")
                .then((r) => r.translatedText)
                .catch(() => o.name),
              translationService
                .translate(o.orgName, "ar")
                .then((r) => r.translatedText)
                .catch(() => o.orgName),
            ]);
            return [o.id, { name, org }] as const;
          }),
        );
        setLabelById(new Map(entries));
      })
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await initiativesService.linkNeed(needId, selectedId);
      onOpenChange(false);
      onLinked();
    } catch (err) {
      setError(err instanceof ApiError && err.code ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Combobox
            items={options.map((o) => ({
              value: o.id,
              label: labelById.get(o.id)?.name ?? o.name,
              description: labelById.get(o.id)?.org ?? o.orgName,
            }))}
            value={selectedId}
            onSelect={setSelectedId}
            placeholder={t("selectPlaceholder")}
            searchPlaceholder={t("searchPlaceholder")}
            emptyText={loading ? t("loading") : t("noOptions")}
            loading={loading}
            aria-label={t("selectPlaceholder")}
          />
          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={!selectedId || submitting}>
            {submitting ? t("linking") : t("link")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** RIO-FR-009 — surfaces a Need's analytical status and its links to
 * Initiatives. Viewing requires `initiatives:read`; linking/unlinking
 * requires `initiatives:write`, gated by the caller via `canManage`. */
export function NeedInitiativeLinkSection({
  need,
  canManage,
  onNeedUpdated,
}: {
  need: Need;
  canManage: boolean;
  /** Linking/unlinking can flip the Need's own analyticalStatus (open_gap
   * <-> linked_to_initiative) server-side — this refreshes the parent's copy
   * so the badge above doesn't go stale until a manual reload. */
  onNeedUpdated: (need: Need) => void;
}) {
  const t = useTranslations("app.studies.need.initiativeLink");
  const [linked, setLinked] = useState<Initiative[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  // Bumped on every open so `key={dialogKey}` below remounts the dialog
  // with fresh internal state instead of resetting it inside an effect.
  const [dialogKey, setDialogKey] = useState(0);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);
  // Client feedback: unlink is a confirmed action with a visible success
  // message afterwards (both locales).
  const [confirmUnlinkId, setConfirmUnlinkId] = useState<string | null>(null);
  const [unlinkSuccess, setUnlinkSuccess] = useState(false);

  function load() {
    initiativesService
      .listLinkedByNeed(need.id)
      .then((rows) => {
        setLinked(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setLinked([]);
        setLoadFailed(true);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [need.id]);

  function refreshNeed() {
    needsService
      .getById(need.id)
      .then(onNeedUpdated)
      .catch(() => undefined);
  }

  function handleLinked() {
    load();
    refreshNeed();
  }

  async function unlink(initiativeId: string) {
    setUnlinkingId(initiativeId);
    setUnlinkError(null);
    setUnlinkSuccess(false);
    try {
      await initiativesService.unlinkNeed(need.id, initiativeId);
      setConfirmUnlinkId(null);
      load();
      refreshNeed();
      setUnlinkSuccess(true);
      window.setTimeout(() => setUnlinkSuccess(false), 4000);
    } catch (err) {
      setUnlinkError(
        err instanceof ApiError && err.code ? err.message : t("genericError"),
      );
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <Card className="shadow-md">
      <CardContent className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-foreground flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span className="bg-primary/10 text-primary flex size-7 shrink-0 items-center justify-center rounded-full">
              <Link2 className="size-3.5" />
            </span>
            <span className="truncate">{t("heading")}</span>
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <AnalyticalStatusBadge status={need.analyticalStatus} />
            {canManage ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => {
                  setDialogKey((k) => k + 1);
                  setDialogOpen(true);
                }}
              >
                <Plus className="size-3.5" />
                {t("linkAction")}
              </Button>
            ) : null}
          </div>
        </div>

        {linked === null ? (
          <div className="bg-muted h-10 w-full animate-pulse rounded-md" />
        ) : linked.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {loadFailed ? t("loadError") : t("noLinks")}
          </p>
        ) : (
          <ul className="space-y-2">
            {linked.map((initiative) => (
              <li
                key={initiative.id}
                className="border-border bg-muted/40 flex items-center justify-between gap-3 rounded-md border px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    <AutoTranslate text={initiative.name} />
                  </p>
                  <p className="text-muted-foreground truncate text-xs">
                    <AutoTranslate text={initiative.orgName} />
                  </p>
                </div>
                {canManage ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive shrink-0 gap-1.5"
                    disabled={unlinkingId === initiative.id}
                    onClick={() => setConfirmUnlinkId(initiative.id)}
                  >
                    <Unlink className="size-3.5" />
                    {unlinkingId === initiative.id ? t("unlinking") : t("unlinkAction")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {unlinkSuccess ? (
          <p role="status" className="text-sm font-medium text-emerald-600">
            {t("unlinkSuccess")}
          </p>
        ) : null}
        {unlinkError ? <p className="text-destructive text-sm">{unlinkError}</p> : null}
      </CardContent>

      <AlertDialog
        open={confirmUnlinkId !== null}
        onOpenChange={(next) => !next && setConfirmUnlinkId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("unlinkConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("unlinkConfirmBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={unlinkingId !== null}>
              {t("unlinkConfirmCancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={unlinkingId !== null}
              onClick={(e) => {
                e.preventDefault();
                if (confirmUnlinkId) void unlink(confirmUnlinkId);
              }}
            >
              {unlinkingId !== null ? t("unlinking") : t("unlinkConfirmAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <LinkInitiativeDialog
        key={dialogKey}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        needId={need.id}
        excludeIds={new Set((linked ?? []).map((i) => i.id))}
        onLinked={handleLinked}
      />
    </Card>
  );
}
