"use client";

import { useState } from "react";
import {
  Sparkles,
  MapPin,
  Building2,
  Globe,
  Layers,
  CheckCircle2,
  Eye,
  Loader2,
  AlertCircle,
  FileText,
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
import {
  prioritySummaryService,
  SummaryScopeType,
  ScopeFilters,
} from "@/services/reports/priority-summary.service";

const DOMAINS_LIST = [
  "Water & Sanitation",
  "Health",
  "Education",
  "Food Security",
  "Infrastructure",
  "Livelihood & Income",
  "Social Protection",
  "Environment",
  "Governance & Services",
];

const REGIONS_LIST = [
  "Riyadh Region",
  "Makkah Region",
  "Eastern Province",
  "Asir Region",
  "Madinah Region",
  "Tabuk Region",
];

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
  onGenerated: (response: any) => void;
}) {
  const [scope, setScope] = useState<SummaryScopeType>("VILLAGE");
  const [selectedVillage, setSelectedVillage] = useState<string>(
    villages[0] || "",
  );
  const [selectedDomain, setSelectedDomain] = useState<string>("Water & Sanitation");
  const [selectedRegion, setSelectedRegion] = useState<string>("Riyadh Region");

  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
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
    } catch (err: any) {
      setError(err?.message || "Failed to load data preview");
    } fontally: {
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
    } catch (err: any) {
      setError(err?.message || "Failed to generate AI summary");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Generate AI Priority Summary
          </DialogTitle>
          <DialogDescription className="text-xs">
            Select a Summary Level and configure scope filters. Backend will freeze a data snapshot before calling Gemini.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {error ? (
            <div className="bg-destructive/10 text-destructive text-xs p-3 rounded-md flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </div>
          ) : null}

          {/* STEP 1: Select Summary Level */}
          <div className="space-y-2.5">
            <Label className="text-xs font-semibold text-foreground">
              Step 1: Select Summary Level
            </Label>
            <RadioGroup
              value={scope}
              onValueChange={(val) => {
                setScope(val as SummaryScopeType);
                setPreviewData(null);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                  scope === "VILLAGE"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("VILLAGE")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <MapPin className="size-3.5 text-primary" />
                    Village Summary
                  </span>
                  <RadioGroupItem value="VILLAGE" id="scope-village" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Data for one selected village/study/survey.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                  scope === "SECTOR"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("SECTOR")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Layers className="size-3.5 text-primary" />
                    Sector Summary
                  </span>
                  <RadioGroupItem value="SECTOR" id="scope-sector" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Data for one selected domain/sector across villages.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                  scope === "REGION"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("REGION")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-primary" />
                    Region Summary
                  </span>
                  <RadioGroupItem value="REGION" id="scope-region" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Data for villages in one region/governorate.
                </p>
              </div>

              <div
                className={`p-3 rounded-lg border cursor-pointer transition-colors space-y-1 ${
                  scope === "EXECUTIVE"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/40"
                }`}
                onClick={() => setScope("EXECUTIVE")}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    <Globe className="size-3.5 text-primary" />
                    Executive Summary
                  </span>
                  <RadioGroupItem value="EXECUTIVE" id="scope-exec" />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  High-level overview across all permitted entities.
                </p>
              </div>
            </RadioGroup>
          </div>

          {/* STEP 2: Scope Filters */}
          <div className="space-y-3 bg-muted/20 p-4 rounded-lg border border-border">
            <Label className="text-xs font-semibold text-foreground">
              Step 2: Configure Scope Filters
            </Label>

            {scope === "VILLAGE" && (
              <div className="space-y-1.5">
                <span className="text-[11px] text-muted-foreground">Select Target Village:</span>
                <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Select Village" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All Villages (Consolidated)</SelectItem>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">Target Sector / Domain:</span>
                  <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select Domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {DOMAINS_LIST.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">Village Context:</span>
                  <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Villages</SelectItem>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">Target Region:</span>
                  <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select Region" />
                    </SelectTrigger>
                    <SelectContent>
                      {REGIONS_LIST.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-[11px] text-muted-foreground">Sub-Village Filter:</span>
                  <Select value={selectedVillage} onValueChange={setSelectedVillage}>
                    <SelectTrigger className="w-full text-xs">
                      <SelectValue placeholder="Select Village" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">All Region Villages</SelectItem>
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
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Executive Scope will aggregate all {villages.length || 1} surveyed village(s) and permitted entity regions.</p>
                <div className="flex flex-wrap gap-1 mt-1">
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
              className={`border p-3.5 rounded-lg text-xs space-y-2 ${
                previewData.responseQuality?.submittedResponseCount === 0
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-primary/30 bg-card"
              }`}
            >
              <div className="flex items-center justify-between font-semibold">
                <span className="flex items-center gap-1.5 text-primary">
                  <Eye className="size-3.5" />
                  Frozen Snapshot Preview ({previewData.scope})
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
                    ? "No Data Available"
                    : "Ready for AI"}
                </Badge>
              </div>

              {previewData.responseQuality?.submittedResponseCount === 0 ? (
                <p className="text-destructive text-[11px] font-medium">
                  ⚠️ No survey responses or scoring data available for the selected village/scope. Collect survey responses and calculate scores before generating AI Summary.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                  <div>Submitted Responses: {previewData.responseQuality?.submittedResponseCount}</div>
                  <div>Valid Responses: {previewData.responseQuality?.validResponseCount}</div>
                  <div>Confidence: {previewData.responseQuality?.confidenceLevel}</div>
                  <div>Overall Index: {previewData.severity?.overallVillageNeedsIndex ?? "N/A"}</div>
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
            {previewing ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            Preview Included Data
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
            >
              Cancel
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
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-3.5" />
                  Generate AI Summary
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
