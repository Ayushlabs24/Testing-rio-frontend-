"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Sparkles,
  MapPin,
  Building2,
  Globe,
  Layers,
  Eye,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSectorOptions } from "@/hooks/use-sector-options";
import { geographyService } from "@/services/geography/geography.service";
import {
  prioritySummaryService,
  SummaryScopeType,
  ScopeFilters,
  PrioritySummaryResponse,
} from "@/services/reports/priority-summary.service";

export function GenerateSummaryModal({
  open,
  onOpenChange,
  studyId,
  surveyId,
  villages = [],
  onGenerated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studyId: string;
  surveyId: string;
  villages?: string[];
  onGenerated: (response: PrioritySummaryResponse) => void;
}) {
  const t = useTranslations("PriorityDashboard.generateModal");
  const dynamicDomains = useSectorOptions(true);
  const [regionsList, setRegionsList] = useState<string[]>([]);
  const domainsList = useMemo(() => dynamicDomains, [dynamicDomains]);

  const [scope, setScope] = useState<SummaryScopeType>("VILLAGE");
  const [selectedVillage, setSelectedVillage] = useState<string>(villages[0] || "");
  const [selectedDomain, setSelectedDomain] = useState<string>(domainsList[0] || "");
  const [selectedRegion, setSelectedRegion] = useState<string>("");

  useEffect(() => {
    geographyService
      .listRegions()
      .then((regs) => {
        const names = regs.map((r) => r.name);
        setRegionsList(names);
        if (names.length > 0) {
          setSelectedRegion((prev) => prev || names[0]);
        }
      })
      .catch(() => setRegionsList([]));
  }, []);

  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const [previewData, setPreviewData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getFilters = (): ScopeFilters => {
    switch (scope) {
      case "SECTOR":
        return { domainKey: selectedDomain, villageId: selectedVillage };
      case "REGION":
        return { regionId: selectedRegion, villageId: selectedVillage };
      case "EXECUTIVE":
        return { villageIds: villages };
      case "VILLAGE":
      default:
        return { villageId: selectedVillage };
    }
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setError(null);
      const res = await prioritySummaryService.previewSnapshot(
        studyId,
        surveyId,
        scope,
        getFilters(),
      );
      setPreviewData(res.snapshot);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.previewFailed"));
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      setError(null);
      const res = await prioritySummaryService.generateSummary(
        studyId,
        surveyId,
        scope,
        getFilters(),
      );
      onGenerated(res);
      onOpenChange(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("errors.generateFailed"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90%] min-w-2xl sm:w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <Sparkles className="text-primary size-5" />
            {t("title")}
          </DialogTitle>
          <DialogDescription className="text-xs">{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error ? (
            <div className="bg-destructive/10 text-destructive flex items-center gap-2 rounded-md p-3 text-xs">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {/* STEP 1: Select Summary Level */}
          <div className="space-y-2.5">
            <Label className="text-foreground text-xs font-semibold">{t("step1")}</Label>
            <RadioGroup
              value={scope}
              onValueChange={(val) => {
                setScope(val as SummaryScopeType);
                setPreviewData(null);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={`cursor-pointer space-y-1 rounded-lg border p-3 transition-colors ${
                  scope === "VILLAGE"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("VILLAGE")}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <MapPin className="text-primary size-3.5" />
                    {t("scopes.village.title")}
                  </span>
                  <RadioGroupItem value="VILLAGE" id="scope-village" />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("scopes.village.desc")}
                </p>
              </div>

              <div
                className={`cursor-pointer space-y-1 rounded-lg border p-3 transition-colors ${
                  scope === "SECTOR"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("SECTOR")}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Layers className="text-primary size-3.5" />
                    {t("scopes.sector.title")}
                  </span>
                  <RadioGroupItem value="SECTOR" id="scope-sector" />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("scopes.sector.desc")}
                </p>
              </div>

              <div
                className={`cursor-pointer space-y-1 rounded-lg border p-3 transition-colors ${
                  scope === "REGION"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("REGION")}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Building2 className="text-primary size-3.5" />
                    {t("scopes.region.title")}
                  </span>
                  <RadioGroupItem value="REGION" id="scope-region" />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("scopes.region.desc")}
                </p>
              </div>

              <div
                className={`cursor-pointer space-y-1 rounded-lg border p-3 transition-colors ${
                  scope === "EXECUTIVE"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("EXECUTIVE")}
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Globe className="text-primary size-3.5" />
                    {t("scopes.executive.title")}
                  </span>
                  <RadioGroupItem value="EXECUTIVE" id="scope-exec" />
                </div>
                <p className="text-muted-foreground text-[11px]">
                  {t("scopes.executive.desc")}
                </p>
              </div>
            </RadioGroup>
          </div>

          {/* STEP 2: Scope Filters */}
          <div className="bg-muted/20 border-border space-y-3 rounded-lg border p-4">
            <Label className="text-foreground text-xs font-semibold">{t("step2")}</Label>

            {scope === "VILLAGE" && (
              <div className="space-y-1.5">
                <span className="text-muted-foreground text-[11px]">
                  {t("selectVillageLabel")}
                </span>
                <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder={t("allVillages")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t("allVillagesConsolidated")}</SelectItem>
                    {villages.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {scope === "SECTOR" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-muted-foreground text-[11px]">
                    {t("targetSectorLabel")}
                  </span>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={t("selectDomainPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {domainsList.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-muted-foreground text-[11px]">
                    {t("villageContextLabel")}
                  </span>
                  <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={t("allVillages")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("allVillages")}</SelectItem>
                      {villages.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {scope === "REGION" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <span className="text-muted-foreground text-[11px]">
                    {t("targetRegionLabel")}
                  </span>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={t("selectRegionPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {regionsList.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-muted-foreground text-[11px]">
                    {t("subVillageFilterLabel")}
                  </span>
                  <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder={t("allVillages")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">{t("allRegionVillages")}</SelectItem>
                      {villages.map((v) => (
                        <SelectItem key={v} value={v}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {scope === "EXECUTIVE" && (
              <div className="text-muted-foreground space-y-1 text-xs">
                <p>{t("executiveNote", { count: villages.length || 1 })}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {villages.map((v) => (
                    <Badge key={v} variant="outline" className="text-[10px]">
                      {v}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP 3: Preview Data Drawer */}
          {previewData ? (
            <div
              className={`space-y-2 rounded-lg border p-3.5 text-xs ${
                previewData.responseQuality?.submittedResponseCount === 0
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/30 bg-card"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="text-primary flex items-center gap-1.5">
                  <Eye className="size-3.5" />
                  {t("previewTitle")} ({previewData.scope})
                </span>
                <Badge
                  variant={
                    previewData.responseQuality?.submittedResponseCount === 0
                      ? "destructive"
                      : "secondary"
                  }
                  className="text-[10px]"
                >
                  {previewData.responseQuality?.submittedResponseCount === 0
                    ? t("noData")
                    : t("readyForAi")}
                </Badge>
              </div>

              {previewData.responseQuality?.submittedResponseCount === 0 ? (
                <p className="text-destructive text-[11px] font-medium">
                  {t("noDataWarning")}
                </p>
              ) : (
                <div className="text-muted-foreground grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    {t("submittedResponses")}:{" "}
                    {previewData.responseQuality?.submittedResponseCount}
                  </div>
                  <div>
                    {t("validResponses")}:{" "}
                    {previewData.responseQuality?.validResponseCount}
                  </div>
                  <div>
                    {t("confidence")}: {previewData.responseQuality?.confidenceLevel}
                  </div>
                  <div>
                    {t("overallIndex")}:{" "}
                    {previewData.severity?.overallVillageNeedsIndex !== undefined &&
                    previewData.severity?.overallVillageNeedsIndex !== null
                      ? Math.round(previewData.severity.overallVillageNeedsIndex)
                      : t("na")}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={previewing || generating}
            className="gap-1.5 text-xs"
          >
            {previewing ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Eye className="size-3.5" />
            )}
            {t("previewButton")}
          </Button>

          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              {t("cancelButton")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleGenerate}
              disabled={
                generating ||
                (previewData && previewData.responseQuality?.submittedResponseCount === 0)
              }
              className="gap-1.5 text-xs"
            >
              {generating ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  {t("generatingButton")}
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  {t("generateButton")}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
