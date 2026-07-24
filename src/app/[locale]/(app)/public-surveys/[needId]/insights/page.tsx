import { redirect } from "@/i18n/navigation";

// Merged into /priority-dashboard/[needId] — that page has the same Severity
// Dashboard / Priority Score / AI Summary tabs, but its AI Summary tab is
// wired to the real Gemini-backed priority-summary service
// (AiPrioritySummaryPanel), while this page's own "AI Summary" section was
// still calling the old response-quality module's canned placeholder text.
// Kept as a redirect so existing bookmarks/links still land somewhere useful.
export default async function PublicSurveyInsightsRedirect({
  params,
}: {
  params: Promise<{ locale: string; needId: string }>;
}) {
  const { locale, needId } = await params;
  redirect({ href: `/priority-dashboard/${needId}`, locale });
}
