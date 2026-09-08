"use client";

import { ClipboardEdit, Search, Eye, Building2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import { AutoTranslate } from "@/components/common/auto-translate";
import { PageContainer } from "@/components/common/page-container";
import { CrossEntityGuard } from "@/components/layout/cross-entity-guard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";
import type { Organization } from "@/services/organizations/organizations.types";
import { SurveyDetailDrawer } from "./_components/survey-detail-drawer";

interface SurveyItem {
  id: string;
  title: string;
  studyTitle: string | null;
  orgName: string | null;
  status: string;
  responseCount: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

export default function SystemAdminSurveysPage() {
  const t = useTranslations("systemAdmin.surveys");
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectSurveyId, setInspectSurveyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get<Organization[]>(endpoints.organizations.list)
      .then((res) => setOrganizations(res ?? []))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const params: Record<string, string> = {};
    if (selectedOrgId !== "all") {
      params.organizationId = selectedOrgId;
    }
    apiClient
      .get<{ items: SurveyItem[] }>("/surveys", { params })
      .then((res) => {
        if (isMounted) {
          setSurveys(res.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setSurveys([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId]);

  const filteredSurveys = useMemo(() => {
    return surveys.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.orgName && s.orgName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (s.studyTitle && s.studyTitle.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [surveys, searchQuery]);

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <ClipboardEdit className="text-primary size-6" />
                {t("platformTitle")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("readOnlyBadge")}</p>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                  <SelectTrigger className="w-56 text-xs">
                    <Building2 className="text-muted-foreground mr-2 size-3.5" />
                    <SelectValue placeholder={t("filterOrganization")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allOrganizations")}</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={org.id}>
                        <AutoTranslate text={org.name} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  aria-label={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead>{t("columns.linkedStudy")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.responseCount")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <div className="flex justify-center">
                          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredSurveys.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredSurveys.map((survey) => (
                      <TableRow key={survey.id}>
                        <TableCell className="text-foreground font-medium">
                          {survey.title}
                        </TableCell>
                        <TableCell className="text-foreground text-xs font-medium">
                          {survey.orgName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {survey.studyTitle ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              survey.status === "survey_published"
                                ? "border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-700 capitalize dark:text-emerald-400"
                                : "text-xs capitalize"
                            }
                          >
                            {survey.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-primary font-mono text-xs font-bold">
                          {survey.responseCount}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setInspectSurveyId(survey.id)}
                          >
                            <Eye className="size-3.5" />
                            {t("inspectSurvey")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <SurveyDetailDrawer
          surveyId={inspectSurveyId}
          open={!!inspectSurveyId}
          onOpenChange={(open) => !open && setInspectSurveyId(null)}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
