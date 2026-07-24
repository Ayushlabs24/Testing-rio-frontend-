import { redirect } from "@/i18n/navigation";

// The standalone AI Review screen was merged directly into the Need
// workspace page's AiClassificationSection — classification, Override,
// Approve/Reject, and curating suggested questions all happen there now, no
// separate screen. Kept as a redirect so any existing bookmarks/links still
// land somewhere useful instead of 404ing.
export default async function AiReviewRedirect({
  params,
}: {
  params: Promise<{ locale: string; id: string; needId: string }>;
}) {
  const { locale, id, needId } = await params;
  redirect({ href: `/studies/${id}/needs/${needId}`, locale });
}
