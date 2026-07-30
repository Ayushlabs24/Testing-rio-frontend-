"use client";

import { BarChart3, Search, Eye, Download, Building2 } from "lucide-react";
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
import { organizationsService } from "@/services/organizations/organizations.service";
import type { Organization } from "@/services/organizations/organizations.types";

interface ReportItem {
  id: string;
  title: string;
  reportType: string;
  status: string;
  generatedAt: string;
  reviewedBy: string | null;
  exportFormats: string[];
}

export default function SystemAdminReportsPage() {
  const t = useTranslations("systemAdmin.reports");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    organizationsService
      .listAll()
      .then((orgs) => setOrganizations(orgs as unknown as Organization[]))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    let isMounted = true;
    const params: Record<string, string> = {};
    if (selectedOrgId !== "all") {
      params.organizationId = selectedOrgId;
    }
    apiClient
      .get<ReportItem[]>(endpoints.reports.list, { params })
      .then((res) => {
        if (isMounted) {
          setReports(res ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setReports([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [selectedOrgId]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [reports, searchQuery]);

  const handleDownload = async (id: string, format: "pdf" | "excel") => {
    try {
      const blob = await apiClient.downloadBlob(endpoints.reports.export(id, format));
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-${id}.${format === "excel" ? "xlsx" : "pdf"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export download failed:", err);
    }
  };

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <BarChart3 className="text-primary size-6" />
                {t("platformTitle")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("readOnlyNotice")}</p>
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
                    <TableHead>{t("columns.type")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.generatedDate")}</TableHead>
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
                  ) : filteredReports.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredReports.map((report) => {
                      const canExport =
                        report.status === "released" || report.status === "archived";
                      return (
                        <TableRow key={report.id}>
                          <TableCell className="text-foreground font-medium">
                            {report.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {report.reportType}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs capitalize">
                              {report.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground font-mono text-xs">
                            {new Date(report.generatedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canExport && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => handleDownload(report.id, "pdf")}
                                  >
                                    <Download className="size-3.5" />
                                    PDF
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1 text-xs"
                                    onClick={() => handleDownload(report.id, "excel")}
                                  >
                                    <Download className="size-3.5" />
                                    Excel
                                  </Button>
                                </>
                              )}
                              {!canExport && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs"
                                  disabled
                                >
                                  <Eye className="size-3.5" />
                                  {t("actions.view")}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </PageContainer>
    </CrossEntityGuard>
  );
}
