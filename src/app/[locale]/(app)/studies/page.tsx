"use client";

import { ClipboardList, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import {
  StudyReviewBadge,
  StudyStatusBadge,
} from "@/components/features/studies/study-status-badge";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { useAuth } from "@/components/providers/auth-provider";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
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
import { STUDIES_PAGE_SIZE } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { Link, useRouter } from "@/i18n/navigation";
import { studiesService } from "@/services/studies/studies.service";
import {
  STUDY_STATUSES,
  type StudyStatus,
  type StudySummary,
} from "@/services/studies/studies.types";

const ALL = "all";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export default function StudiesPage() {
  const t = useTranslations("app.studies");
  const router = useRouter();
  const { session } = useAuth();
  const canCreate = usePermission("studySurvey", "create");
  const canWrite = usePermission("studySurvey", "write");

  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StudyStatus | typeof ALL>(ALL);
  const [village, setVillage] = useState<string>(ALL);
  const [page, setPage] = useState(1);

  const isCrossEntity = session?.role.crossEntity === true;
  const orgVillages = useMemo(() => session?.organization.villages ?? [], [session]);

  // No synchronous setState here: doing that inside the effect would trigger a
  // cascading render. Both flags are set from the settled promise instead.
  const load = useCallback(() => {
    studiesService
      .list()
      .then((rows) => {
        setStudies(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        setStudies([]);
        setLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Filtering is client-side even though the API supports it: the pilot-volume
  // list is small, and this keeps typing responsive without a request per
  // keystroke. Move to server-side filters when a tenant outgrows one page.
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return (studies ?? []).filter((study) => {
      if (status !== ALL && study.status !== status) return false;
      if (village !== ALL && !study.villages.includes(village)) return false;
      if (!normalized) return true;
      return study.title.toLowerCase().includes(normalized);
    });
  }, [studies, query, status, village]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / STUDIES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * STUDIES_PAGE_SIZE,
    currentPage * STUDIES_PAGE_SIZE,
  );

  const columnCount = isCrossEntity ? 6 : 5;

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canCreate ? (
              <Button onClick={() => router.push("/studies/new")} className="gap-2">
                <Plus className="size-4" />
                {t("newStudy")}
              </Button>
            ) : null
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-3">
                <Search className="text-muted-foreground size-4" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                />
              </div>

              {orgVillages.length > 0 ? (
                <Select
                  value={village}
                  onValueChange={(value) => {
                    setVillage(value);
                    setPage(1);
                  }}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-44"
                    aria-label={t("filterVillageLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterVillageAll")}</SelectItem>
                    {orgVillages.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}

              <Select
                value={status}
                onValueChange={(value) => {
                  setStatus(value as StudyStatus | typeof ALL);
                  setPage(1);
                }}
              >
                <SelectTrigger
                  className="h-8 w-full sm:w-44"
                  aria-label={t("filterStatusLabel")}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t("filterStatusAll")}</SelectItem>
                  {STUDY_STATUSES.map((value) => (
                    <SelectItem key={value} value={value}>
                      {t(`status.${value}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">{t("titleColumn")}</TableHead>
                  {isCrossEntity ? (
                    <TableHead className="py-3">{t("organizationColumn")}</TableHead>
                  ) : null}
                  <TableHead className="py-3">{t("villagesColumn")}</TableHead>
                  <TableHead className="w-32 py-3">{t("statusColumn")}</TableHead>
                  <TableHead className="w-36 py-3">{t("reviewColumn")}</TableHead>
                  <TableHead className="w-40 py-3">{t("updatedColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {studies === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: columnCount }).map((__, cell) => (
                        <TableCell key={cell} className="py-5">
                          <div className="bg-muted h-4 w-28 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={columnCount}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <ClipboardList className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noResults")}</p>
                        {!loadFailed && studies.length === 0 && canCreate ? (
                          <p className="text-xs">{t("noResultsHint")}</p>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paged.map((study) => (
                    <TableRow key={study.id}>
                      <TableCell className="py-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="space-y-0.5">
                            <Link
                              href={`/studies/${study.id}`}
                              className="text-foreground text-sm font-medium hover:underline"
                            >
                              {study.title}
                            </Link>
                            {study.description ? (
                              <p className="text-muted-foreground line-clamp-1 text-xs">
                                {study.description}
                              </p>
                            ) : null}
                          </div>
                          {canWrite ? (
                            <DeleteStudyDialog
                              studyId={study.id}
                              onDeleted={load}
                              trigger={
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                                    aria-label={t("delete.action")}
                                  >
                                    <Trash2 className="size-4" />
                                  </Button>
                                </AlertDialogTrigger>
                              }
                            />
                          ) : null}
                        </div>
                      </TableCell>
                      {isCrossEntity ? (
                        <TableCell className="text-muted-foreground py-4 text-sm">
                          {study.organizationName ?? "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className="text-muted-foreground py-4 text-sm">
                        {study.villages.length > 0 ? study.villages.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="py-4">
                        <StudyStatusBadge status={study.status} />
                      </TableCell>
                      <TableCell className="py-4">
                        <StudyReviewBadge status={study.reviewStatus} />
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 text-sm tabular-nums">
                        {formatDate(study.updatedAt)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {filtered.length > 0 ? (
              <div className="border-border border-t px-4 py-3">
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
      </PageContainer>
    </PermissionGuard>
  );
}
