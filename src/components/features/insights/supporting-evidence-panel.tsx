"use client";

import { useEffect, useState } from "react";
import { FileText, CheckCircle2, XCircle, ShieldCheck, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { evidenceService } from "@/services/evidence/evidence.service";
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
  studyId,
  onEvidenceToggled,
}: {
  needId: string;
  studyId: string;
  onEvidenceToggled?: () => void;
}) {
  const [evidenceList, setEvidenceList] = useState<SupportingEvidenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    evidenceService
      .listByNeed(needId)
      .then((items: any[]) => {
        setEvidenceList(
          items.map((item) => ({
            id: item.id,
            fileName: item.fileName,
            title: item.title || item.fileName,
            fileType: item.fileType,
            sourceReferenceId: item.sourceReferenceId || item.id.slice(0, 8),
            linkedDomainOrKpi: item.linkedDomainOrKpi || "General Community Feedback",
            description: item.description || "Approved community evidence artifact.",
            collectedAt: item.collectedAt || item.uploadedAt,
            uploadedAt: item.uploadedAt,
            reviewStatus: item.reviewStatus || "APPROVED",
            isIncludedInReport: item.isIncludedInReport !== false,
          })),
        );
      })
      .catch(() => setEvidenceList([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

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
  const includedCount = evidenceList.filter((e) => e.isIncludedInReport && e.reviewStatus === "APPROVED").length;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="py-4 px-6 bg-muted/20 border-b border-border flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <FileText className="size-4 text-primary" />
            Supporting Community Evidence & Field Data
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select approved field evidence to contextualize the AI Priority Summary narrative. (Evidence supports the narrative but does not alter scores).
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-normal">
          {includedCount} of {approvedCount} Approved Included
        </Badge>
      </CardHeader>
      <CardContent className="p-6">
        {loading ? (
          <div className="space-y-3">
            <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
            <div className="bg-muted h-12 w-full animate-pulse rounded-md" />
          </div>
        ) : evidenceList.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-md border border-dashed">
            No supporting evidence files uploaded for this assessment yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {evidenceList.map((item) => (
              <div
                key={item.id}
                className={`p-4 rounded-lg border transition-colors space-y-3 ${
                  item.isIncludedInReport && item.reviewStatus === "APPROVED"
                    ? "bg-card border-primary/30 shadow-xs"
                    : "bg-muted/30 border-border opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <FileText className="size-3.5 text-primary" />
                      {item.title}
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-2">
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
                      <span className="flex items-center gap-1 text-success">
                        <ShieldCheck className="size-3" />
                        Approved
                      </span>
                    ) : (
                      item.reviewStatus
                    )}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded">
                  <Tag className="size-3 text-primary" />
                  <span className="font-medium text-foreground">{item.linkedDomainOrKpi}</span>
                </div>

                <div className="flex items-center justify-between border-t border-border/50 pt-2.5">
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
                      className="text-xs cursor-pointer select-none font-medium"
                    >
                      Include in AI Summary
                    </Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground">
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
