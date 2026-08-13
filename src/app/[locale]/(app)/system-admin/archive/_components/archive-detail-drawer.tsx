"use client";

import { X, FileText } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ArchiveDetailData {
  id: string;
  title: string;
  status: string;
  cycleNumber: number;
  organizationId: string;
  organizationName: string;
  region: string[];
  sector: string | null;
  villages: string[];
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedBy: string | null;
  archiveReason: string | null;
  methodologyVersion: { id: string; version: string; name: string } | null;
  evidenceCount: number;
  needsCount: number;
  reports: {
    id: string;
    title: string;
    status: string;
    reportType: string;
    generatedAt: string;
  }[];
  auditHistory: {
    id: string;
    action: string;
    actorUserId: string | null;
    createdAt: string;
    metadata: Record<string, unknown>;
  }[];
}

interface ArchiveDetailDrawerProps {
  studyId: string | null;
  open: boolean;
  onClose: () => void;
}

export function ArchiveDetailDrawer({
  studyId,
  open,
  onClose,
}: ArchiveDetailDrawerProps) {
  const t = useTranslations("systemAdmin.archive");
  const [data, setData] = useState<ArchiveDetailData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (!studyId || !open) return;

    apiClient
      .get<ArchiveDetailData>(endpoints.archive.byId(studyId))
      .then((res) => {
        if (isMounted) {
          setData(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setData(null);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [studyId, open]);

  if (!open) return null;

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-sm">
      <div className="bg-background border-border flex h-full w-full max-w-2xl flex-col justify-between overflow-y-auto border-l p-6 shadow-2xl">
        <div>
          <div className="border-border flex items-center justify-between border-b pb-4">
            <div>
              <h2 className="text-foreground flex items-center gap-2 text-lg font-bold">
                <FileText className="text-primary size-5" />
                {t("drawer.title")}
              </h2>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {t("readOnlyBanner")}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label={t("drawer.close")}
            >
              <X className="size-5" />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          ) : data ? (
            <div className="space-y-6 pt-4">
              {/* Status Banner */}
              <div className="border-primary/20 bg-primary/5 flex items-center justify-between rounded-lg border p-4">
                <div>
                  <h3 className="text-foreground text-sm font-semibold">{data.title}</h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {data.organizationName} • {data.region.join(", ")}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs capitalize">
                  {data.status}
                </Badge>
              </div>

              {/* Metadata Cards */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <Card className="p-3">
                  <span className="text-muted-foreground">{t("drawer.archivedAt")}</span>
                  <p className="text-foreground mt-1 font-mono font-medium">
                    {data.archivedAt ? new Date(data.archivedAt).toLocaleString() : "—"}
                  </p>
                </Card>
                <Card className="p-3">
                  <span className="text-muted-foreground">{t("drawer.archivedBy")}</span>
                  <p className="text-foreground mt-1 font-mono font-medium">
                    {data.archivedBy ?? "System"}
                  </p>
                </Card>
              </div>

              {data.archiveReason ? (
                <Card className="p-3 text-xs">
                  <span className="text-muted-foreground">
                    {t("drawer.archiveReason")}
                  </span>
                  <p className="text-foreground mt-1">{data.archiveReason}</p>
                </Card>
              ) : null}

              {/* Snapshot Metrics */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <Card className="p-3 text-center">
                  <span className="text-muted-foreground">
                    {t("drawer.evidenceCount")}
                  </span>
                  <p className="text-primary mt-1 font-mono text-lg font-bold">
                    {data.evidenceCount}
                  </p>
                </Card>
                <Card className="p-3 text-center">
                  <span className="text-muted-foreground">{t("drawer.needsCount")}</span>
                  <p className="text-primary mt-1 font-mono text-lg font-bold">
                    {data.needsCount}
                  </p>
                </Card>
                <Card className="p-3 text-center">
                  <span className="text-muted-foreground">
                    {t("drawer.methodologyVersion")}
                  </span>
                  <p className="text-primary mt-1 font-mono text-sm font-semibold">
                    {data.methodologyVersion?.version ?? "v5.0"}
                  </p>
                </Card>
              </div>

              {/* Linked Reports */}
              <div>
                <h4 className="text-foreground mb-2 text-xs font-semibold">
                  {t("drawer.publishedReports")} ({data.reports.length})
                </h4>
                {data.reports.length === 0 ? (
                  <p className="text-muted-foreground text-xs italic">
                    {t("drawer.noLinkedReports")}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.reports.map((report) => (
                      <div
                        key={report.id}
                        className="border-border flex items-center justify-between rounded border p-2.5 text-xs"
                      >
                        <div>
                          <p className="text-foreground font-medium">{report.title}</p>
                          <span className="text-muted-foreground font-mono text-[10px]">
                            {report.reportType}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {report.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Audit Trail */}
              <div>
                <h4 className="text-foreground mb-2 text-xs font-semibold">
                  {t("drawer.auditTrail")} ({data.auditHistory.length})
                </h4>
                <div className="max-h-48 space-y-2 overflow-y-auto">
                  {data.auditHistory.map((audit) => (
                    <div
                      key={audit.id}
                      className="bg-muted/40 flex items-center justify-between rounded p-2 text-[11px]"
                    >
                      <span className="text-foreground font-mono font-medium">
                        {audit.action}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {new Date(audit.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-border flex justify-end border-t pt-4">
          <Button variant="outline" size="sm" onClick={onClose}>
            {t("drawer.close")}
          </Button>
        </div>
      </div>
    </div>
  );
}
