"use client";

import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  Plus,
  ClipboardList,
  ExternalLink,
  Edit,
  Share2,
  Copy,
  Check,
  QrCode,
  Loader2,
  AlertCircle,
  Play,
  BarChart3
} from "lucide-react";
import { useTranslations } from "next-intl";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { studiesService } from "@/services/studies/studies.service";
import { surveysService, type Survey } from "@/services/surveys/surveys.service";
import type { StudyDetail } from "@/services/studies/studies.types";

export default function StudySurveysListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  // State Management
  const [study, setStudy] = useState<StudyDetail | null>(null);
  const [surveyList, setSurveyList] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Sharing Modal State
  const [shareOpen, setShareOpen] = useState(false);
  const [sharingSurvey, setSharingSurvey] = useState<Survey | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await studiesService.getById(id);
      setStudy(s);

      const surv = await surveysService.getSurveyByStudyId(id);
      if (surv) {
        setSurveyList([surv]);
      } else {
        setSurveyList([]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load surveys.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSurvey = async () => {
    if (!study) return;
    
    // If no focus classification, let's redirect them to select domain first
    if (!study.domain || !study.subDomain) {
      // Direct them to select domain classification
      router.push(`/studies/${study.id}/survey-builder`);
      return;
    }

    setLoading(true);
    try {
      const newSurv = await surveysService.recommendQuestions(study.id);
      setSurveyList([newSurv]);
      router.push(`/studies/${study.id}/survey-builder`);
    } catch (err) {
      console.warn("Failed recommending questions on backend. Setting local mock survey.");
      
      const mockSurv: Survey = {
        id: `mock-survey-${study.id}`,
        studyId: study.id,
        title: `Survey: ${study.title}`,
        status: "DRAFT",
        questions: [],
      };
      setSurveyList([mockSurv]);
      router.push(`/studies/${study.id}/survey-builder`);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenShare = (surv: Survey) => {
    setSharingSurvey(surv);
    setCopied(false);
    setShareOpen(true);
  };

  const copyShareLink = () => {
    if (!sharingSurvey) return;
    const locale = typeof window !== "undefined" ? document.documentElement.lang || "en" : "en";
    const link = `${window.location.origin}/${locale}/surveys/take/${sharingSurvey.id}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "Today";
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
  };

  const getShareUrl = () => {
    if (!sharingSurvey) return "";
    const locale = typeof window !== "undefined" ? document.documentElement.lang || "en" : "en";
    const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3001";
    return `${origin}/${locale}/surveys/take/${sharingSurvey.id}`;
  };

  const shareUrl = getShareUrl();

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        {/* Navigation Breadcrumb */}
        <Link
          href="/studies"
          className="text-muted-foreground hover:text-foreground mb-6 inline-flex items-center gap-1.5 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Studies
        </Link>

        {loading && !study ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="size-10 animate-spin text-indigo-600" />
            <span className="text-sm font-medium text-muted-foreground">Loading surveys dashboard...</span>
          </div>
        ) : error ? (
          <Card className="border-destructive/30 bg-destructive/5 text-destructive p-6 rounded-xl flex items-start gap-3">
            <AlertCircle className="size-5 shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold">Error Loading Surveys</h3>
              <p className="text-sm mt-1">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={loadData}>
                Try Again
              </Button>
            </div>
          </Card>
        ) : study ? (
          <div className="space-y-6">
            {/* Header Description */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-6">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">Study Curation Dashboard</span>
                <h1 className="text-3xl font-extrabold tracking-tight mt-1 text-slate-900">{study.title}</h1>
                <p className="text-xs text-slate-500 mt-1">Focus Area: {study.domain ? `${study.domain} / ${study.subDomain}` : "Unclassified"}</p>
              </div>

              {surveyList.length > 0 && (
                <Button onClick={handleCreateSurvey} className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 shadow">
                  <Plus className="size-4" />
                  Create New Survey
                </Button>
              )}
            </div>

            {/* List / Table or Empty state */}
            {surveyList.length === 0 ? (
              <Card className="border border-dashed border-slate-200 rounded-xl bg-slate-50/50 py-16 text-center">
                <CardContent className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-100 flex size-12 items-center justify-center rounded-full mx-auto">
                    <ClipboardList className="size-6 text-indigo-600" />
                  </div>
                  <div className="max-w-md mx-auto space-y-2">
                    <h3 className="font-semibold text-slate-800 text-base">No Surveys Created Yet</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      There are currently no baseline survey questionnaires configured for this study. Click the button below to initialize focus classification and survey questions.
                    </p>
                  </div>
                  <Button
                    onClick={handleCreateSurvey}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold gap-2 mt-2 shadow"
                  >
                    <Plus className="size-4" />
                    Create Survey
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-md rounded-xl overflow-hidden border border-slate-200 bg-white">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow>
                      <TableHead className="font-semibold text-slate-700">Survey Name</TableHead>
                      <TableHead className="font-semibold text-slate-700 w-32">Status</TableHead>
                      <TableHead className="font-semibold text-slate-700 w-44">Created Date</TableHead>
                      <TableHead className="font-semibold text-slate-700 w-72 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {surveyList.map((surv) => (
                      <TableRow key={surv.id} className="hover:bg-slate-50/50 transition-colors">
                        <TableCell className="font-semibold text-slate-800 py-4 text-sm">
                          {surv.title}
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] font-bold py-0.5 px-2 ${
                              surv.status === "PUBLISHED"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100"
                                : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {surv.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs py-4">
                          {formatDate(study.createdAt)}
                        </TableCell>
                        <TableCell className="py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold gap-1 text-slate-700"
                              onClick={() => router.push(`/studies/${study.id}/survey-responses`)}
                            >
                              <BarChart3 className="size-3.5 text-violet-600" />
                              Responses
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold gap-1 text-slate-700"
                              onClick={() => router.push(`/studies/${study.id}/survey-builder`)}
                            >
                              <Edit className="size-3.5" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs font-semibold gap-1 text-indigo-600 border-indigo-100 hover:bg-indigo-50"
                              onClick={() => handleOpenShare(surv)}
                            >
                              <Share2 className="size-3.5" />
                              Share
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            )}
          </div>
        ) : null}

        {/* Share Survey Dialog */}
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold">Share Survey</DialogTitle>
              <DialogDescription>
                Distribute this survey link to collect responses. Anyone with the URL or QR code can participate.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 flex flex-col items-center">
              {/* Styled Vector QR Code */}
              <div className="bg-slate-50 border p-4 rounded-2xl flex flex-col items-center justify-center size-40 shadow-inner">
                <QrCode className="size-24 text-slate-800" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-2">Scan to Participate</span>
              </div>

              {/* Copy Link input tray */}
              <div className="flex w-full items-center space-x-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="bg-slate-50 font-mono text-xs h-10 select-all"
                />
                <Button
                  onClick={copyShareLink}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shrink-0 gap-1.5 h-10 px-4"
                >
                  {copied ? (
                    <>
                      <Check className="size-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-4" />
                      Copy Link
                    </>
                  )}
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShareOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
