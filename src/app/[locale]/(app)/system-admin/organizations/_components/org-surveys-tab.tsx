"use client";

import { ClipboardEdit, Search, Eye } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiClient } from "@/services/api/client";

interface SurveyItem {
  id: string;
  title: string;
  studyTitle: string | null;
  status: string;
  responseCount: number;
  publishedAt: string | null;
  closedAt: string | null;
  createdAt: string | null;
}

interface OrgSurveysTabProps {
  organizationId: string;
}

export function OrgSurveysTab({ organizationId }: OrgSurveysTabProps) {
  const t = useTranslations("systemAdmin.surveys");
  const [surveys, setSurveys] = useState<SurveyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!organizationId) return;

    apiClient
      .get<{ items: SurveyItem[] }>("/surveys", {
        params: { organizationId },
      })
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
  }, [organizationId]);

  const filteredSurveys = useMemo(() => {
    return surveys.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [surveys, searchQuery]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardEdit className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">
            {t("title")} ({surveys.length})
          </CardTitle>
          <Badge variant="outline" className="text-muted-foreground text-xs">
            {t("readOnlyBadge")}
          </Badge>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            placeholder={t("searchPlaceholder")}
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
              <TableHead>{t("columns.linkedStudy")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.responseCount")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <div className="flex justify-center">
                    <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredSurveys.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              filteredSurveys.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="text-foreground font-medium">
                    {survey.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {survey.studyTitle ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs capitalize">
                      {survey.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {survey.responseCount}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="gap-1 text-xs" disabled>
                      <Eye className="size-3.5" />
                      {t("viewOnly")}
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
