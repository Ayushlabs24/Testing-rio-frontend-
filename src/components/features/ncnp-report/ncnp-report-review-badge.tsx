import { Badge } from "@/components/ui/badge";
import type { NcnpReportReviewStatus } from "@/services/ncnp-report-review/ncnp-report-review.service";

// Same className-map pattern as survey-builder's STATUS_BADGE_CLASS — reused
// here rather than the 4-variant-only Badge `variant` prop, since it's
// already wired to the app's real success/warning/destructive tokens.
const STATUS_BADGE_CLASS: Record<NcnpReportReviewStatus, string | undefined> = {
  draft: "bg-badge-warning text-badge-warning-foreground border-transparent",
  approved: undefined,
  rejected: "bg-destructive/10 text-destructive border-transparent",
  released: "bg-badge-success text-badge-success-foreground border-transparent",
};

export function NcnpReportReviewBadge({
  status,
  label,
}: {
  status: NcnpReportReviewStatus;
  label: string;
}) {
  return (
    <Badge variant="outline" className={STATUS_BADGE_CLASS[status]}>
      {label}
    </Badge>
  );
}
