"use client";

import { BarChart3, Search, Eye, Download } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
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

const PAGE_SIZE = 10;

interface ReportItem {
  id: string;
  title: string;
  reportType: string;
  status: string;
  generatedAt: string;
  reviewedBy: string | null;
  exportFormats: string[];
}

interface OrgReportsTabProps {
  organizationId: string;
}

export function OrgReportsTab({ organizationId }: OrgReportsTabProps) {
  const t = useTranslations("systemAdmin.reports");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    if (!organizationId) return;

    apiClient
      .get<ReportItem[]>(endpoints.reports.list, {
        params: { organizationId },
      })
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
  }, [organizationId]);

  const filteredReports = useMemo(() => {
    return reports.filter((r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [reports, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredReports.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedReports = filteredReports.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const handleDownload = async (id: string, format: "pdf" | "excel") => {
    const blob = await apiClient.downloadBlob(endpoints.reports.export(id, format));
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `report-${id}.${format === "excel" ? "xlsx" : "pdf"}`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">
            {t("title")} ({reports.length})
          </CardTitle>
          <Badge variant="outline" className="text-muted-foreground text-xs">
            {t("readOnlyNotice")}
          </Badge>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
          <Input
            placeholder={t("searchPlaceholder")}
            aria-label={t("searchPlaceholder")}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
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
                <TableCell colSpan={5} className="text-muted-foreground h-24 text-center">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              pagedReports.map((report) => {
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

        {filteredReports.length > 0 ? (
          <div className="border-border flex justify-end border-t px-4 py-3">
            <Pagination
              page={currentPage}
              pageCount={pageCount}
              onPageChange={setPage}
              previousLabel={t("pagination.previous")}
              nextLabel={t("pagination.next")}
              pageLabel={(p, count) => t("pagination.label", { page: p, count })}
            />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
