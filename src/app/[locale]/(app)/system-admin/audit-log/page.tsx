"use client";

import {
  Shield,
  Search,
  Eye,
  Download,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useCallback } from "react";
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
import { organizationsService } from "@/services/organizations/organizations.service";
import type { Organization } from "@/services/organizations/organizations.types";
import { AuditDetailDrawer } from "./_components/audit-detail-drawer";

interface AuditItem {
  id: string;
  organizationId: string | null;
  actor: { id: string; name: string; email: string } | null;
  action: string;
  entityType: string;
  entityId: string | null;
  entityLabel: string;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditListResponse {
  items: AuditItem[];
  total: number;
  limit: number;
  offset: number;
}

interface AuditSummaryResponse {
  stats: {
    totalEvents: number;
    organizationChanges: number;
    userRoleChanges: number;
    securityEvents: number;
    reportActions: number;
    archiveActions: number;
  };
}

export default function SystemAdminAuditLogPage() {
  const t = useTranslations("systemAdmin.auditLog");
  const [items, setItems] = useState<AuditItem[]>([]);
  const [total, setTotal] = useState(0);
  const [limit] = useState(25);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [selectedEntityType, setSelectedEntityType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [summaryStats, setSummaryStats] = useState<AuditSummaryResponse["stats"] | null>(
    null,
  );
  const [inspectEventId, setInspectEventId] = useState<string | null>(null);

  const loadLogs = useCallback(() => {
    const params: Record<string, string | number> = {
      limit,
      offset,
    };
    if (selectedOrgId !== "all") params.organizationId = selectedOrgId;
    if (selectedEntityType !== "all") params.entityType = selectedEntityType;
    if (searchQuery.trim()) params.search = searchQuery.trim();

    apiClient
      .get<AuditListResponse>("/audit", { params })
      .then((res) => {
        setItems(res?.items ?? []);
        setTotal(res?.total ?? 0);
        setLoading(false);
      })
      .catch(() => {
        setItems([]);
        setTotal(0);
        setLoading(false);
      });
  }, [limit, offset, selectedOrgId, selectedEntityType, searchQuery]);

  useEffect(() => {
    organizationsService
      .listAll()
      .then((orgs) => setOrganizations(orgs as unknown as Organization[]))
      .catch(() => setOrganizations([]));

    apiClient
      .get<AuditSummaryResponse>("/audit/summary")
      .then((res) => setSummaryStats(res.stats))
      .catch(() => setSummaryStats(null));
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  const handleExportCsv = async () => {
    try {
      const blob = await apiClient.downloadBlob("/audit/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
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
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Shield className="text-primary size-6" />
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="gap-1 text-xs"
            >
              <Download className="size-3.5" />
              {t("actions.exportCsv")}
            </Button>
          </div>

          {/* Stats Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.totalEvents")}
              </span>
              <p className="text-foreground mt-1 font-mono text-lg font-bold">
                {summaryStats?.totalEvents ?? total}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.orgChanges")}
              </span>
              <p className="text-primary mt-1 font-mono text-lg font-bold">
                {summaryStats?.organizationChanges ?? 0}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.userRoleChanges")}
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {summaryStats?.userRoleChanges ?? 0}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.securityEvents")}
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-amber-500">
                {summaryStats?.securityEvents ?? 0}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.reportActions")}
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-blue-500">
                {summaryStats?.reportActions ?? 0}
              </p>
            </Card>
            <Card className="p-3 text-center">
              <span className="text-muted-foreground text-[11px]">
                {t("stats.archiveActions")}
              </span>
              <p className="mt-1 font-mono text-lg font-bold text-purple-500">
                {summaryStats?.archiveActions ?? 0}
              </p>
            </Card>
          </div>

          {/* Main Table Card */}
          <Card>
            <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <Select
                  value={selectedOrgId}
                  onValueChange={(val) => {
                    setSelectedOrgId(val);
                    setOffset(0);
                  }}
                >
                  <SelectTrigger className="w-48 text-xs">
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

                <Select
                  value={selectedEntityType}
                  onValueChange={(val) => {
                    setSelectedEntityType(val);
                    setOffset(0);
                  }}
                >
                  <SelectTrigger className="w-40 text-xs">
                    <SelectValue placeholder={t("filterEntityType")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("allEntityTypes")}</SelectItem>
                    <SelectItem value="organization">
                      {t("entityTypes.organization")}
                    </SelectItem>
                    <SelectItem value="user">{t("entityTypes.user")}</SelectItem>
                    <SelectItem value="study">{t("entityTypes.study")}</SelectItem>
                    <SelectItem value="report">{t("entityTypes.report")}</SelectItem>
                    <SelectItem value="survey">{t("entityTypes.survey")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="relative w-full sm:w-64">
                <Search className="text-muted-foreground absolute top-2.5 left-2.5 size-4" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setOffset(0);
                  }}
                  className="pl-9 text-xs"
                />
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.timestamp")}</TableHead>
                    <TableHead>{t("columns.actor")}</TableHead>
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead>{t("columns.action")}</TableHead>
                    <TableHead>{t("columns.entity")}</TableHead>
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
                  ) : items.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-muted-foreground font-mono text-xs whitespace-nowrap">
                          {new Date(item.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-foreground text-xs font-medium">
                          {item.actor ? (
                            <div>
                              <span>{item.actor.name}</span>
                              <span className="text-muted-foreground block font-mono text-[10px]">
                                {item.actor.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic">
                              {t("systemActor")}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {item.organizationId
                            ? item.organizationId.slice(0, 8) + "..."
                            : t("globalScope")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="font-mono text-[10px] uppercase"
                          >
                            {item.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          <span className="text-foreground font-semibold">
                            {item.entityLabel}
                          </span>
                          <span className="text-muted-foreground block font-mono text-[10px] capitalize">
                            {item.entityType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1 text-xs"
                            onClick={() => setInspectEventId(item.id)}
                          >
                            <Eye className="size-3.5" />
                            {t("actions.viewDetails")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <div className="border-border flex items-center justify-between border-t px-4 py-3 text-xs">
                <span className="text-muted-foreground font-mono">
                  {t("paginationShowing", {
                    start: offset + 1,
                    end: Math.min(offset + limit, total),
                    total,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={offset === 0}
                    onClick={() => setOffset(Math.max(0, offset - limit))}
                  >
                    <ChevronLeft className="mr-1 size-3.5" />
                    {t("previous")}
                  </Button>
                  <span className="text-muted-foreground font-mono">
                    {t("paginationPage", { current: currentPage, total: totalPages })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage >= totalPages}
                    onClick={() => setOffset(offset + limit)}
                  >
                    {t("next")}
                    <ChevronRight className="ml-1 size-3.5" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Drawer */}
        <AuditDetailDrawer
          eventId={inspectEventId}
          open={!!inspectEventId}
          onClose={() => setInspectEventId(null)}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
