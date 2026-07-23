"use client";

import { ClipboardList, Plus, Search, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { DeleteStudyDialog } from "@/components/features/studies/delete-study-dialog";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
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
import { needsService } from "@/services/needs/needs.service";
import { studiesService } from "@/services/studies/studies.service";
import type { StudySummary } from "@/services/studies/studies.types";

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

export default function StudiesPage() {
  const t = useTranslations("app.studies");
  const router = useRouter();
  const canCreate = usePermission("studySurvey", "create");
  const canWrite = usePermission("studySurvey", "write");

  const [studies, setStudies] = useState<StudySummary[] | null>(null);
  // Villages live on a study's Needs (a Study can hold many now), not the
  // Study itself — resolved per row, keyed by study id, as the union of
  // every Need's own village list.
  const [villagesByStudy, setVillagesByStudy] = useState<Record<string, string[]>>({});
  const [needCountByStudy, setNeedCountByStudy] = useState<Record<string, number>>({});
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  // No synchronous setState here: doing that inside the effect would trigger a
  // cascading render. Both flags are set from the settled promise instead.
  const load = useCallback(() => {
    studiesService
      .list()
      .then((rows) => {
        setStudies(rows);
        setLoadFailed(false);
        Promise.all(
          rows.map((study) =>
            needsService
              .listByStudy(study.id)
              .then((needs) => [study.id, needs] as const)
              .catch(() => [study.id, []] as const),
          ),
        ).then((entries) => {
          setVillagesByStudy(
            Object.fromEntries(
              entries.map(([id, needs]) => [
                id,
                [...new Set(needs.flatMap((n) => n.village))],
              ]),
            ),
          );
          setNeedCountByStudy(
            Object.fromEntries(entries.map(([id, needs]) => [id, needs.length])),
          );
        });
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
      if (!normalized) return true;
      return study.title.toLowerCase().includes(normalized);
    });
  }, [studies, query]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / STUDIES_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paged = filtered.slice(
    (currentPage - 1) * STUDIES_PAGE_SIZE,
    currentPage * STUDIES_PAGE_SIZE,
  );

  const columnCount = 5;

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
              <div className="relative flex-1">
                <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setPage(1);
                  }}
                  className="h-8 pl-9"
                />
              </div>
            </div>

            <Table className="table-fixed">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3">{t("titleColumn")}</TableHead>
                  <TableHead className="py-3">{t("villageColumn")}</TableHead>
                  <TableHead className="py-3">{t("needsColumn")}</TableHead>
                  <TableHead className="py-3">{t("updatedColumn")}</TableHead>
                  <TableHead className="w-16 py-3" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {studies === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: columnCount }).map((__, cell) => (
                        <TableCell key={cell} className="py-5">
                          <Skeleton className="h-4 w-28" />
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
                      <TableCell className="py-4 align-middle whitespace-normal">
                        <Link
                          href={`/studies/${study.id}`}
                          className="text-foreground block text-sm font-medium break-words hover:underline"
                        >
                          {study.title}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 align-middle text-sm break-words whitespace-normal">
                        {villagesByStudy[study.id]?.length
                          ? villagesByStudy[study.id].join(", ")
                          : t("villageNotDefined")}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 align-middle text-sm tabular-nums">
                        {needCountByStudy[study.id] ?? 0}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-4 align-middle text-sm tabular-nums">
                        {formatDate(study.updatedAt)}
                      </TableCell>
                      <TableCell className="py-4 text-right align-middle">
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
