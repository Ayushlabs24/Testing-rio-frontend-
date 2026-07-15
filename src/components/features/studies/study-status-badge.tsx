"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { StudyReviewStatus, StudyStatus } from "@/services/studies/studies.types";

type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

/** Lifecycle tone: draft is quiet, active is the live state, archived is spent. */
const STATUS_VARIANT: Record<StudyStatus, BadgeVariant> = {
  draft: "outline",
  active: "default",
  completed: "secondary",
  archived: "outline",
};

/** Review tone: only a rejection needs to read as a problem. */
const REVIEW_VARIANT: Record<StudyReviewStatus, BadgeVariant> = {
  none: "outline",
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export function StudyStatusBadge({ status }: { status: StudyStatus }) {
  const t = useTranslations("app.studies.status");
  return <Badge variant={STATUS_VARIANT[status]}>{t(status)}</Badge>;
}

export function StudyReviewBadge({ status }: { status: StudyReviewStatus }) {
  const t = useTranslations("app.studies.review");
  return <Badge variant={REVIEW_VARIANT[status]}>{t(status)}</Badge>;
}
