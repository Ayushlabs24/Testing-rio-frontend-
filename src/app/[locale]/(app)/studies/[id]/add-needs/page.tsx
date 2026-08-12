"use client";

import { use, useState } from "react";
import { Edit3, FileSpreadsheet, Sparkles, ArrowRight, ArrowLeft } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { ImportNeedsDialog } from "@/components/features/studies/import-needs-dialog";
import { ImportSurveyResultsDialog } from "@/components/features/studies/import-survey-results-dialog";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Link, useRouter } from "@/i18n/navigation";

export default function AddNeedsOptionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: studyId } = use(params);
  const t = useTranslations("app.studies.addNeedsOptions");
  const locale = useLocale();
  const router = useRouter();
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false);

  return (
    <PermissionGuard module="dataCollection" action="create">
      <PageContainer>
        <PageHeader title={t("title")} description={t("subtitle")} />

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Option 1: Manual Form Entry */}
          <Card className="hover:border-primary/50 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg">
                <Edit3 className="size-6" />
              </div>
              <CardTitle className="text-lg">{t("manualTitle")}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t("manualDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                type="button"
                onClick={() => router.push(`/studies/${studyId}/needs/new`)}
                className="w-full gap-2"
              >
                <span>{t("manualButton")}</span>
                <ArrowIcon className="size-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Option 2: Bulk File Import */}
          <Card className="hover:border-primary/50 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg">
                <FileSpreadsheet className="size-6" />
              </div>
              <CardTitle className="text-lg">{t("importTitle")}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t("importDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                type="button"
                onClick={() => setImportDialogOpen(true)}
                className="w-full gap-2"
              >
                <span>{t("importButton")}</span>
                <ArrowIcon className="size-4" />
              </Button>
            </CardContent>
          </Card>

          {/* Option 3: Upload & Import Survey Results */}
          <Card className="hover:border-primary/50 flex flex-col justify-between shadow-sm transition-all hover:shadow-md">
            <CardHeader className="space-y-3">
              <div className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-lg">
                <Sparkles className="size-6" />
              </div>
              <CardTitle className="text-lg">{t("surveyResultsTitle")}</CardTitle>
              <CardDescription className="text-sm leading-relaxed">
                {t("surveyResultsDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-2">
              <Button
                type="button"
                onClick={() => setSurveyDialogOpen(true)}
                className="w-full gap-2"
              >
                <span>{t("surveyResultsButton")}</span>
                <ArrowIcon className="size-4" />
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Skip to study details link */}
        <div className="mt-8 flex justify-center">
          <Link
            href={`/studies/${studyId}`}
            className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors hover:underline"
          >
            {t("skipToStudy")}
          </Link>
        </div>

        <ImportNeedsDialog
          studyId={studyId}
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImported={() => router.push(`/studies/${studyId}`)}
        />

        <ImportSurveyResultsDialog
          studyId={studyId}
          open={surveyDialogOpen}
          onOpenChange={setSurveyDialogOpen}
          onImported={() => router.push(`/studies/${studyId}`)}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
