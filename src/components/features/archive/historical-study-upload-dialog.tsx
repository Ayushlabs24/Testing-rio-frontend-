"use client";

import { FileText, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/services/api/types";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";
import { historicalStudiesService } from "@/services/historical-studies/historical-studies.service";

const NONE = "__none__";
const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx"];

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** RIO-FR-013 (client Q25, confirmed by Ganesh 2026-09-04) — uploading a
 * study conducted before the platform existed, as a reference document
 * (PDF/Word) into the Archive. Fields match the client's own answer:
 * entity (implicit — the caller's own org, or whichever org a crossEntity
 * caller is acting as), region, subject, date, author, methodology
 * version. Region/Governorate/Center use the full KSA Geographic
 * Reference (client feedback 2026-09-04: a proper cascading picker, not
 * free text) rather than the caller's own org-scoped subset — a
 * pre-platform document's coverage isn't limited to the uploading org's
 * own registered area. */
export function HistoricalStudyUploadDialog({
  open,
  onOpenChange,
  sectorOptions,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectorOptions: string[];
  onUploaded: () => void;
}) {
  const t = useTranslations("app.archive.uploadHistorical");
  const tGeo = useTranslations("app.geography");
  const locale = useLocale() as AppLocale;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [regionId, setRegionId] = useState<string>(NONE);
  const [governorateIds, setGovernorateIds] = useState<string[]>([]);
  const [centerIds, setCenterIds] = useState<string[]>([]);
  const [targetSector, setTargetSector] = useState<string>(NONE);
  const [studyDate, setStudyDate] = useState("");
  const [author, setAuthor] = useState("");
  const [methodologyVersionLabel, setMethodologyVersionLabel] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);

  useEffect(() => {
    if (!open) return;
    geographyService
      .listRegions()
      .then(setRegions)
      .catch(() => setRegions([]));
  }, [open]);

  useEffect(() => {
    // Nothing to fetch with no region selected — `governorateOptions` below
    // derives the empty-options case at render time instead of clearing
    // this state synchronously here (a stale fetch resolving after the
    // region changed again would otherwise race a manual clear anyway).
    if (regionId === NONE) return;
    geographyService
      .listGovernorates(regionId)
      .then(setGovernorates)
      .catch(() => setGovernorates([]));
  }, [regionId]);

  useEffect(() => {
    if (governorateIds.length === 0) return;
    Promise.all(governorateIds.map((id) => geographyService.listCenters(id)))
      .then((lists) => setCenters(lists.flat()))
      .catch(() => setCenters([]));
  }, [governorateIds]);

  const governorateOptions = regionId === NONE ? [] : governorates;
  const centerOptions = governorateIds.length === 0 ? [] : centers;

  function reset() {
    setTitle("");
    setRegionId(NONE);
    setGovernorateIds([]);
    setCenterIds([]);
    setTargetSector(NONE);
    setStudyDate("");
    setAuthor("");
    setMethodologyVersionLabel("");
    setFile(null);
    setError(null);
  }

  async function submit() {
    if (
      !title.trim() ||
      !studyDate ||
      !author.trim() ||
      !methodologyVersionLabel.trim() ||
      !file
    ) {
      setError(t("missingFields"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const regionName = regions.find((r) => r.id === regionId)?.name;
      await historicalStudiesService.create({
        title: title.trim(),
        region: regionName ? [regionName] : [],
        governorateIds,
        centerIds,
        targetSector: targetSector === NONE ? undefined : targetSector,
        studyDate,
        author: author.trim(),
        methodologyVersionLabel: methodologyVersionLabel.trim(),
        file,
      });
      reset();
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError && err.code ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="hist-title">
              {t("studyTitleLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="hist-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("studyTitlePlaceholder")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>{t("regionLabel")}</Label>
              <Select
                value={regionId}
                onValueChange={(v) => {
                  setRegionId(v);
                  setGovernorateIds([]);
                  setCenterIds([]);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("regionPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("regionPlaceholder")}</SelectItem>
                  {regions.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {localizedName(r, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tGeo("governorateLabel")}</Label>
              <MultiSelect
                options={governorateOptions.map((g) => ({
                  value: g.id,
                  label: localizedName(g, locale),
                }))}
                values={governorateIds}
                onChange={(next) => {
                  setGovernorateIds(next);
                  const stillValid = new Set(
                    centers
                      .filter((c) => next.includes(c.governorateId))
                      .map((c) => c.id),
                  );
                  setCenterIds((prev) => prev.filter((id) => stillValid.has(id)));
                }}
                placeholder={tGeo("governoratePlaceholder")}
                searchPlaceholder={tGeo("governorateSearchPlaceholder")}
                emptyText={
                  regionId === NONE ? t("selectRegionFirst") : tGeo("governorateEmpty")
                }
                disabled={regionId === NONE}
                removeAriaLabel={(g) =>
                  tGeo("removeGovernorateSelection", { governorate: g })
                }
                singleLine
                maxVisibleChips={1}
              />
            </div>
            <div className="space-y-2">
              <Label>{tGeo("centerLabel")}</Label>
              <MultiSelect
                options={centerOptions.map((c) => ({
                  value: c.id,
                  label: localizedName(c, locale),
                }))}
                values={centerIds}
                onChange={setCenterIds}
                placeholder={
                  governorateIds.length > 0
                    ? tGeo("centerPlaceholder")
                    : tGeo("selectGovernorateFirst")
                }
                searchPlaceholder={tGeo("centerSearchPlaceholder")}
                emptyText={tGeo("centerEmpty")}
                disabled={governorateIds.length === 0}
                removeAriaLabel={(c) => tGeo("removeCenterSelection", { center: c })}
                singleLine
                maxVisibleChips={1}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("subjectLabel")}</Label>
              <Select value={targetSector} onValueChange={setTargetSector}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("subjectPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("subjectPlaceholder")}</SelectItem>
                  {sectorOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="hist-date">
                {t("studyDateLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hist-date"
                type="date"
                value={studyDate}
                onChange={(e) => setStudyDate(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="hist-author">
                {t("authorLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hist-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder={t("authorPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hist-methodology">
                {t("methodologyVersionLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="hist-methodology"
                value={methodologyVersionLabel}
                onChange={(e) => setMethodologyVersionLabel(e.target.value)}
                placeholder={t("methodologyVersionPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              {t("fileLabel")} <span className="text-destructive">*</span>
            </Label>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="border-input hover:bg-muted/30 flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors"
            >
              {file ? (
                <FileText className="text-primary size-7" />
              ) : (
                <UploadCloud className="text-muted-foreground size-7" />
              )}
              <span className="text-foreground text-sm font-medium">
                {file ? file.name : t("chooseFile")}
              </span>
              <span className="text-muted-foreground text-xs">
                {file ? formatFileSize(file.size) : t("fileHint")}
              </span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_EXTENSIONS.join(",")}
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                if (selected) setFile(selected);
                e.target.value = "";
              }}
            />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
