"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ReportStatus } from "@/services/reports/reports.types";

export const REPORT_STATUS_VARIANT: Record<
  ReportStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  draft: "outline",
  // Client-confirmed (Aug 13): confirmed, awaiting the Reviewer — distinct
  // from "draft" (not yet confirmed).
  submitted: "secondary",
  rejected: "destructive",
  released: "default",
  archived: "secondary",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const t = useTranslations("app.reports");
  return <Badge variant={REPORT_STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>;
}
