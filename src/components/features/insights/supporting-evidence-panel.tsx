import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FileText, ShieldCheck, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { evidenceService } from "@/services/evidence/evidence.service";
import { parseRawEvidenceList } from "@/services/evidence/evidence.schemas";
import { prioritySummaryService } from "@/services/reports/priority-summary.service";

export interface SupportingEvidenceItem {
  id: string;
  fileName: string;
  title?: string;
  fileType: string;
  sourceReferenceId?: string;
  linkedDomainOrKpi?: string;
  description?: string;
  collectedAt?: string;
  uploadedAt: string;
  reviewStatus: string;
  isIncludedInReport: boolean;
}

export function SupportingEvidencePanel({
  needId,
  _studyId,
  onEvidenceToggled,
}: {
  needId: string;
  _studyId?: string;
  onEvidenceToggled?: () => void;
}) {
  const t = useTranslations("PriorityDashboard.evidencePanel");
  const [evidenceList, setEvidenceList] = useState<SupportingEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    evidenceService
      .listByNeed(needId)
      .then((items) => {
        setEvidenceList(
          parseRawEvidenceList(items).map((item) => ({
            id: String(item.id || ""),
            fileName: String(item.fileName || ""),
            title: String(item.title || item.fileName || ""),
            fileType: String(item.fileType || ""),
            sourceReferenceId: String(
              item.sourceReferenceId || String(item.id || "").slice(0, 8),
            ),
            linkedDomainOrKpi: String(item.linkedDomainOrKpi || t("defaultDomain")),
            description: String(item.description || t("defaultDesc")),
            collectedAt: String(item.collectedAt || item.uploadedAt || ""),
            uploadedAt: String(item.uploadedAt || ""),
            reviewStatus: String(item.reviewStatus || "APPROVED"),
            isIncludedInReport: item.isIncludedInReport !== false,
          })),
        );
      })
      .catch(() => setEvidenceList([]))
      .finally(() => setLoading(false));
  }, [needId, t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  const handleToggleInclusion = async (evidenceId: string, currentVal: boolean) => {
    try {
      const newVal = !currentVal;
      setEvidenceList((prev) =>
        prev.map((item) =>
          item.id === evidenceId ? { ...item, isIncludedInReport: newVal } : item,
        ),
      );
      await prioritySummaryService.toggleEvidenceInclusion(evidenceId, newVal);
      if (onEvidenceToggled) onEvidenceToggled();
    } catch {
      load(); // revert on failure
    }
  };

  const approvedCount = evidenceList.filter((e) => e.reviewStatus === "APPROVED").length;
  const includedCount = evidenceList.filter(
    (e) => e.isIncludedInReport && e.reviewStatus === "APPROVED",
  ).length;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="bg-muted/20 border-border flex flex-row items-center justify-between border-b px-6 py-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="text-primary size-4" />
            {t("title")}
          </CardTitle>
          <p className="text-muted-foreground mt-0.5 text-xs">{t("subtitle")}</p>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          {t("approvedIncluded", { included: includedCount, approved: approvedCount })}
        </Badge>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
            <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="text-muted-foreground bg-muted/20 rounded-md border border-dashed p-6 text-center text-xs">
            {t("noEvidence")}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {evidenceList.map((item) => (
              <div
                key={item.id}
                className={`space-y-3 rounded-lg border p-4 transition-colors ${
                  item.isIncludedInReport && item.reviewStatus === "APPROVED"
                    ? "bg-card border-primary/30 shadow-xs"
                    : "bg-muted/30 border-border opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-foreground flex items-center gap-1.5 text-xs font-semibold">
                      <FileText className="text-primary size-3.5" />
                      {item.title}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-2 text-[11px]">
                      <span>Ref: {item.sourceReferenceId}</span>
                      <span>•</span>
                      <span>Type: {item.fileType}</span>
                    </p>
                  </div>
                  <Badge
                    variant={item.reviewStatus === "APPROVED" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {item.reviewStatus === "APPROVED" ? (
                      <span className="text-success flex items-center gap-1">
                        <ShieldCheck className="size-3" />
                        {t("approvedBadge")}
                      </span>
                    ) : (
                      item.reviewStatus
                    )}
                  </Badge>
                </div>

                <div className="text-muted-foreground bg-muted/40 flex items-center gap-1.5 rounded p-2 text-[11px]">
                  <Tag className="text-primary size-3" />
                  <span className="text-foreground font-medium">
                    {item.linkedDomainOrKpi}
                  </span>
                </div>

                <div className="border-border/50 flex items-center justify-between border-t pt-2.5">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`inc-${item.id}`}
                      checked={item.isIncludedInReport}
                      disabled={item.reviewStatus !== "APPROVED"}
                      onCheckedChange={() =>
                        handleToggleInclusion(item.id, item.isIncludedInReport)
                      }
                    />
                    <Label
                      htmlFor={`inc-${item.id}`}
                      className="cursor-pointer text-xs font-medium select-none"
                    >
                      {t("includeInSummary")}
                    </Label>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {new Date(item.uploadedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
