"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { geographicDashboardService } from "@/services/geographic-dashboard/geographic-dashboard.service";
import type {
  GeoItemKind,
  GeoLevel,
  GeoPointItemsResponse,
} from "@/services/geographic-dashboard/geographic-dashboard.types";

interface PointItemsDialogProps {
  /** The point to list, or null when the dialog is closed. Driving open/closed
   *  off the same value that identifies the point means a stale list can never
   *  outlive the point it belongs to. */
  pointId: string | null;
  pointName: string;
  kind: GeoItemKind;
  level: GeoLevel;
  /** The panel's active filters, passed through so the list matches the count
   *  that was clicked rather than the unfiltered total. */
  filters: { sector?: string; urgency?: string; status?: string };
  onClose: () => void;
}

/** Colours match the map's priority bands so a row reads the same as its dot. */
const BAND_BADGE: Record<string, string> = {
  critical: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
};

type LoadState =
  | { status: "loading" }
  | { status: "ok"; data: GeoPointItemsResponse }
  | { status: "error" };

export function PointItemsDialog({
  pointId,
  pointName,
  kind,
  level,
  filters,
  onClose,
}: PointItemsDialogProps) {
  return (
    <Dialog open={pointId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-hidden sm:max-w-2xl">
        {/* Keyed on what is being asked for, so switching from Needs to
            Studies remounts with a fresh loading state instead of resetting
            three pieces of state by hand inside an effect. Mounted only while
            open, so closing the dialog also drops any in-flight request. */}
        {pointId ? (
          <PointItemsBody
            key={`${pointId}:${kind}:${level}`}
            pointId={pointId}
            pointName={pointName}
            kind={kind}
            level={level}
            filters={filters}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PointItemsBody({
  pointId,
  pointName,
  kind,
  level,
  filters,
}: Omit<PointItemsDialogProps, "onClose"> & { pointId: string }) {
  // Same namespace the map panel uses, so `band.*` here is the same wording a
  // reader just saw on the dot they clicked.
  const t = useTranslations("app.dashboard.needsMap");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    geographicDashboardService
      .getPointItems(pointId, { kind, level, ...filters })
      .then((data) => {
        if (!cancelled) setState({ status: "ok", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [pointId, kind, level, filters]);

  const data = state.status === "ok" ? state.data : null;
  const title =
    kind === "studies"
      ? t("pointItemsStudiesTitle", { place: pointName })
      : kind === "published"
        ? t("pointItemsPublishedTitle", { place: pointName })
        : t("pointItemsNeedsTitle", { place: pointName });

  const rows = kind === "studies" ? (data?.studies ?? []) : (data?.needs ?? []);
  // The server caps the list. Saying so is the difference between a short list
  // and a list that looks complete but is not.
  const truncated = data ? data.total > rows.length : false;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>
          {state.status === "loading"
            ? t("pointItemsLoading")
            : state.status === "error"
              ? t("pointItemsFailed")
              : truncated
                ? t("pointItemsShowing", { shown: rows.length, total: data?.total ?? 0 })
                : t("pointItemsCount", { count: data?.total ?? 0 })}
        </DialogDescription>
      </DialogHeader>

      <div className="-mx-1 max-h-[60vh] space-y-2 overflow-y-auto px-1 py-1">
        {state.status === "ok" && rows.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {t("pointItemsEmpty")}
          </p>
        ) : null}

        {kind === "studies"
          ? (data?.studies ?? []).map((s) => (
              <div
                key={s.id}
                className="border-border/60 flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {t("pointItemsNeedsHere", { count: s.needCount })} · {s.orgName}
                  </p>
                </div>
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={`/studies/${s.id}`}>
                    {t("pointItemsDetail")}
                    <ArrowUpRight className="ms-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            ))
          : (data?.needs ?? []).map((n) => (
              <div
                key={n.id}
                className="border-border/60 flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{n.title}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {n.studyTitle}
                  </p>
                </div>
                {n.band ? (
                  <Badge className={`shrink-0 border-0 ${BAND_BADGE[n.band] ?? ""}`}>
                    {t(`band.${n.band}`)}
                  </Badge>
                ) : null}
                {/* A need's page lives under its study, so both ids are used. */}
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={`/studies/${n.studyId}/needs/${n.id}`}>
                    {t("pointItemsDetail")}
                    <ArrowUpRight className="ms-1 size-3.5" />
                  </Link>
                </Button>
              </div>
            ))}
      </div>
    </>
  );
}
