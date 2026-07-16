"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StudyStatus } from "@/services/studies/studies.types";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** Workflow tone: quiet until captured, builds toward the reviewed end state. */
const STATUS_VARIANT: Record<StudyStatus, BadgeVariant> = {
  draft: "outline",
  need_captured: "secondary",
  evidence_submitted: "secondary",
  ai_classified: "default",
  human_reviewed: "default",
};

export function StudyStatusBadge({ status }: { status: StudyStatus }) {
  const t = useTranslations("app.studies.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}
