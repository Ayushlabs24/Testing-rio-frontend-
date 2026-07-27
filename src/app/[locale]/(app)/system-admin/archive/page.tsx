"use client";

import { Archive, Search, Eye, Building2, RotateCcw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { ArchiveDetailDrawer } from "./_components/archive-detail-drawer";
import { ArchiveStudyDialog } from "./_components/archive-study-dialog";

interface ArchiveEntry {
  id: string;
  kind: "study" | "report";
  title: string;
  status: string;
  date: string;
  studyId: string | null;
  organizationId: string;
  organizationName: string;
  region: string[];
  sector: string | null;
  villages: string[];
}

export default function SystemAdminArchivePage() {
  const t = useTranslations("systemAdmin.archive");
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Drawer & Dialog states
  const [detailStudyId, setDetailStudyId] = useState<string | null>(null);
  const [archiveDialogStudy, setArchiveDialogStudy] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const archiveRequestRef = useRef(0);

  const loadArchive = useCallback(() => {
    const requestId = ++archiveRequestRef.current;
    const params: Record<string, string> = {};
    if (selectedOrgId !== "all") {
      params.organizationId = selectedOrgId;
    }
    apiClient
      .get<ArchiveEntry[]>(endpoints.archive.list, { params })
      .then((res) => {
        if (requestId !== archiveRequestRef.current) return;
        setEntries(res ?? []);
        setLoading(false);
      })
      .catch(() => {
        if (requestId !== archiveRequestRef.current) return;
        setEntries([]);
        setLoading(false);
      });
  }, [selectedOrgId]);

  useEffect(() => {
    organizationsService
      .listAll()
      .then((orgs) => setOrganizations(orgs as unknown as Organization[]))
      .catch(() => setOrganizations([]));
  }, []);

  useEffect(() => {
    loadArchive();
  }, [loadArchive]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [entries, searchQuery]);

  const handleRestore = async (id: string) => {
    try {
      setRestoringId(id);
      await apiClient.post(`/studies/${id}/restore`, {});
      loadArchive();
    } catch {
      // Handled by toast
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <CrossEntityGuard>
      <PageContainer>
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground flex items-center gap-2 text-2xl font-bold tracking-tight">
                <Archive className="text-primary size-6" />
                {t("title")}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">{t("subtitle")}</p>
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
                    <TableHead>{t("columns.title")}</TableHead>
                    <TableHead>{t("columns.organization")}</TableHead>
                    <TableHead>{t("columns.region")}</TableHead>
                    <TableHead>{t("columns.kind")}</TableHead>
                    <TableHead>{t("columns.status")}</TableHead>
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-24 text-center">
                        <div className="flex justify-center">
                          <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredEntries.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-muted-foreground h-24 text-center"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredEntries.map((entry) => (
                      <TableRow key={`${entry.kind}-${entry.id}`}>
                        <TableCell className="text-foreground font-medium">
                          {entry.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {entry.organizationName}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {entry.region.length > 0 ? entry.region.join(", ") : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {entry.kind}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs capitalize">
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-xs">
                          {new Date(entry.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {entry.studyId ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs"
                                onClick={() => setDetailStudyId(entry.studyId)}
                              >
                                <Eye className="size-3.5" />
                                {t("actions.viewDetails")}
                              </Button>
                            ) : null}

                            {entry.kind === "study" && entry.status === "archived" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1 text-xs text-amber-600 hover:text-amber-700"
                                disabled={restoringId === entry.id}
                                onClick={() => handleRestore(entry.id)}
                              >
                                <RotateCcw
                                  className={`size-3.5 ${restoringId === entry.id ? "animate-spin" : ""}`}
                                />
                                {t("actions.restoreStudy")}
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Drawer */}
        <ArchiveDetailDrawer
          studyId={detailStudyId}
          open={!!detailStudyId}
          onClose={() => setDetailStudyId(null)}
        />

        {/* Dialog */}
        <ArchiveStudyDialog
          studyId={archiveDialogStudy?.id ?? null}
          studyTitle={archiveDialogStudy?.title ?? null}
          open={!!archiveDialogStudy}
          onOpenChange={(open) => !open && setArchiveDialogStudy(null)}
          onArchived={loadArchive}
        />
      </PageContainer>
    </CrossEntityGuard>
  );
}
