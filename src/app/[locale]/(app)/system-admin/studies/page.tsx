"use client";

import { ClipboardList, Search, Eye, Building2, Layers } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
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
import { StudyDetailDrawer } from "./_components/study-detail-drawer";

interface StudyItem {
  id: string;
  title: string;
  villages: string[];
  cycleNumber: number;
  orgName?: string;
  surveysCount?: number;
  createdBy: string;
  createdAt: string;
}

export default function SystemAdminStudiesPage() {
  const t = useTranslations("systemAdmin.studies");
  const [studies, setStudies] = useState<StudyItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [inspectStudyId, setInspectStudyId] = useState<string | null>(null);
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
      .get<{ items: StudyItem[] }>(endpoints.studies.list, { params })
      .then((res) => {
        if (isMounted) {
          setStudies(res.items ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setStudies([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId]);

  const filteredStudies = useMemo(() => {
    return studies.filter(
      (s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.orgName && s.orgName.toLowerCase().includes(searchQuery.toLowerCase())),
    );
  }, [studies, searchQuery]);

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <ClipboardList className="text-primary size-6" />
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
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead>{t("columns.village")}</TableHead>
                    <TableHead>{t("columns.surveysCount")}</TableHead>
                    <TableHead>{t("columns.createdDate")}</TableHead>
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
                  ) : filteredStudies.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredStudies.map((study) => (
                      <TableRow key={study.id}>
                        <TableCell className="text-foreground font-medium">
                          <div>
                            <p>{study.title}</p>
                            <span className="text-muted-foreground font-mono text-[10px]">
                              Cycle #{study.cycleNumber}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground text-xs font-medium">
                          {study.orgName ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {study.villages.length > 0 ? study.villages.join(", ") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1 font-mono text-xs">
                            <Layers className="text-primary size-3" />
                            {study.surveysCount ?? 0}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {new Date(study.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setInspectStudyId(study.id)}
                          >
                            <Eye className="size-3.5" />
                            {t("inspectStudy")}
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

        <StudyDetailDrawer
          studyId={inspectStudyId}
          open={!!inspectStudyId}
          onOpenChange={(open) => !open && setInspectStudyId(null)}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
