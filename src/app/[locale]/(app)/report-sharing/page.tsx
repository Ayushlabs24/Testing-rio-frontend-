import { redirect } from "@/i18n/navigation";

// Report Sharing merged into the unified /sharing page (Studies/Reports
// tabs) — kept as a redirect so any existing bookmarks/links still land
// somewhere useful instead of 404ing.
export default async function ReportSharingRedirect({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/sharing", locale });
}
