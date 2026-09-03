"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { NeedStatus } from "@/services/needs/needs.types";
import type { AnalyticalStatus } from "@/services/initiatives/initiatives.types";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** Workflow tone: quiet until captured, builds toward the published end state. */
const STATUS_VARIANT: Record<NeedStatus, BadgeVariant> = {
  draft: "outline",
  pending_ai_classification: "outline",
  evidence_submitted: "secondary",
  ai_classified: "secondary",
  ai_classification_failed: "destructive",
  reviewer_approved: "default",
  survey_created: "default",
  survey_published: "default",
};

/** A Need's own lifecycle badge — a Study has no status of its own now (it's
 * a pure container for however many Needs), so this always renders a
 * Need's status, never a Study's. */
export function NeedStatusBadge({ status }: { status: NeedStatus }) {
  const t = useTranslations("app.studies.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

/** RIO-FR-009 (client Q17) tone: quiet while unresolved, warm once a human
 * has actively worked it, settled once linked or documented. */
const ANALYTICAL_STATUS_VARIANT: Record<AnalyticalStatus, BadgeVariant> = {
  open_gap: "destructive",
  observed: "outline",
  under_analysis: "secondary",
  linked_to_initiative: "default",
  documented_in_study: "default",
};

export function AnalyticalStatusBadge({ status }: { status: AnalyticalStatus }) {
  const t = useTranslations("app.studies.need.analyticalStatus");
  return <Badge variant={ANALYTICAL_STATUS_VARIANT[status]}>{t(status)}</Badge>;
}
