"use client";

import {
  Archive as ArchiveIcon,
  Database,
  Download,
  ExternalLink,
  Eye,
  Plus,
  Search,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { useAuth } from "@/components/providers/auth-provider";
import { AutoTranslate } from "@/components/common/auto-translate";
import { FormattedDate } from "@/components/common/formatted-date";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { HistoricalStudyUploadDialog } from "@/components/features/archive/historical-study-upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ARCHIVE_PAGE_SIZE } from "@/config/pagination";
import { usePermission } from "@/hooks/use-permission";
import { useRouter } from "@/i18n/navigation";
import { studyConfigService } from "@/services/study-config/study-config.service";
import { HistoricalStudyImportDialog } from "@/components/features/archive/historical-study-import-dialog";
import { archiveService } from "@/services/archive/archive.service";
import { historicalStudiesService } from "@/services/historical-studies/historical-studies.service";
import type { ArchiveEntry, ArchiveEntryKind } from "@/services/archive/archive.types";
import { isImportableFileName } from "@/services/historical-studies/historical-studies.types";

const ALL = "all";

export default function ArchivePage() {
  const t = useTranslations("app.archive");
  const tDetail = useTranslations("app.archive.detail");
  const tUpload = useTranslations("app.archive.uploadHistorical");
  const tGeo = useTranslations("app.geography");
  const tReportStatus = useTranslations("app.reports.status");
  const locale = useLocale() as AppLocale;
  // RIO-FR-013 (client Q26): "sector" here is the study's own subject
  // (Target Sector, chosen at Study creation), not the owning entity's
  // sector — someone filtering for "Health" wants health studies, not
  // studies from health-sector organisations. Sourced live from the
  // Methodology Configuration's Target Sector list, same pattern as every
  // other configurable-list dropdown in the app.
  const [sectorOptions, setSectorOptions] = useState<
    { name: string; nameAr: string | null }[]
  >([]);
  const router = useRouter();
  const { session } = useAuth();
  const isCrossEntity = session?.role.crossEntity ?? false;
  // RIO-DATA-002 — an import creates org-scoped Study and Need rows, so the
  // server refuses one for another entity's archive entry
  // (CROSS_ORG_IMPORT_FORBIDDEN). A crossEntity role browses every org's
  // archive, so without this the Import button would appear on rows where
  // it is guaranteed to fail.
  const ownOrgId = session?.organization.id ?? null;

  const [entries, setEntries] = useState<ArchiveEntry[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ArchiveEntryKind | typeof ALL>(ALL);
  const [organizationId, setOrganizationId] = useState<string | typeof ALL>(ALL);
  const [region, setRegion] = useState<string | typeof ALL>(ALL);
  const [sector, setSector] = useState<string | typeof ALL>(ALL);
  const [village, setVillage] = useState<string | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  // RIO-FR-013 — uploading a pre-platform study is an archive write;
  // RIO-DATA-002 importing it is a needs write. Different permissions
  // because they are different acts on different data.
  const canUploadHistorical = usePermission("archiveSharingAudit", "write");
  const [uploadOpen, setUploadOpen] = useState(false);
  // RIO-FR-013 (client feedback 2026-09-04) — a historical row's own detail
  // popup: with the row click no longer auto-downloading (replaced by the
  // Preview/Download icons), a click still needs to do *something* useful —
  // show the full metadata that doesn't fit in the table's columns
  // (Governorates/Centers, Subject, Author, Methodology Version, uploaded
  // by/at).
  const [detailEntry, setDetailEntry] = useState<ArchiveEntry | null>(null);
  // RIO-DATA-002 — the archive entry queued for import into the unified
  // dashboard.
  const [importEntry, setImportEntry] = useState<ArchiveEntry | null>(null);
  const canImport = usePermission("dataCollection", "write");

  // Filter option lists (Entity/Region/Village) are derived from a single
  // unfiltered baseline fetch, same idea as the existing Entity-options
  // fetch below — non-crossEntity callers just get their own org's rows
  // back (RLS-scoped server-side), so this is safe to always run.
  const [allOrgs, setAllOrgs] = useState<Array<{ id: string; name: string }>>([]);
  const [allRegions, setAllRegions] = useState<string[]>([]);
  const [allVillages, setAllVillages] = useState<string[]>([]);
  useEffect(() => {
    archiveService
      .list({})
      .then((rows) => {
        const orgById = new Map(rows.map((r) => [r.organizationId, r.organizationName]));
        setAllOrgs(Array.from(orgById.entries()).map(([id, name]) => ({ id, name })));
        setAllRegions(Array.from(new Set(rows.flatMap((r) => r.region))).sort());
        setAllVillages(Array.from(new Set(rows.flatMap((r) => r.villages))).sort());
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    studyConfigService
      .listTargetSectors()
      .then((options) =>
        setSectorOptions(
          options
            .filter((o) => o.isActive)
            .map((o) => ({ name: o.name, nameAr: o.nameAr })),
        ),
      )
      .catch(() => undefined);
  }, []);

  function loadEntries() {
    archiveService
      .list({
        kind: kind === ALL ? undefined : kind,
        search: search || undefined,
        organizationId: organizationId === ALL ? undefined : organizationId,
        region: region === ALL ? undefined : region,
        sector: sector === ALL ? undefined : sector,
        village: village === ALL ? undefined : village,
      })
      .then((rows) => {
        setEntries(rows);
        setLoadFailed(false);
        setPage(1);
      })
      .catch(() => {
        setEntries([]);
        setLoadFailed(true);
        setPage(1);
      });
  }

  useEffect(loadEntries, [kind, search, organizationId, region, sector, village]);

  // +1 for the Actions column (view details, plus preview/download/import
  // for historical entries).
  const columnCount = (isCrossEntity ? 6 : 5) + 1;
  const pageCount = Math.max(1, Math.ceil((entries?.length ?? 0) / ARCHIVE_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = (entries ?? []).slice(
    (currentPage - 1) * ARCHIVE_PAGE_SIZE,
    currentPage * ARCHIVE_PAGE_SIZE,
  );
  const hasActiveFilters =
    search !== "" ||
    kind !== ALL ||
    organizationId !== ALL ||
    region !== ALL ||
    sector !== ALL ||
    village !== ALL;

  function openEntry(entry: ArchiveEntry) {
    if (entry.kind === "study" && entry.studyId) {
      router.push(`/studies/${entry.studyId}`);
    } else if (entry.kind === "report") {
      router.push(`/reports/${entry.id}`);
    } else if (entry.kind === "historical" && entry.studyId) {
      // RIO-DATA-002 — once imported, the entry's real content lives on the
      // Study, so the row opens the imported needs rather than doing nothing.
      router.push(`/studies/${entry.studyId}`);
    }
    // A not-yet-imported "historical" entry has no page to navigate to —
    // it's handled by the explicit View/Preview/Download/Import buttons in
    // the Actions column instead of a row click, since a click-to-download
    // row surprised users.
  }

  // Fetched as a blob (authenticated, cookie-based session) rather than
  // linking the endpoint directly, same pattern used for evidence document
  // downloads elsewhere in the app.
  async function withHistoricalFileBlob(
    entry: ArchiveEntry,
    consume: (url: string) => void,
  ): Promise<void> {
    try {
      const blob = await historicalStudiesService.getFileBlob(entry.id);
      const url = URL.createObjectURL(blob);
      consume(url);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      // Best-effort — a failed preview/download shouldn't throw an
      // unhandled rejection into a click handler.
    }
  }

  function previewHistoricalFile(entry: ArchiveEntry) {
    void withHistoricalFileBlob(entry, (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function downloadHistoricalFile(entry: ArchiveEntry) {
    void withHistoricalFileBlob(entry, (url) => {
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = entry.title;
      anchor.click();
    });
  }

  return (
    <PermissionGuard module="archiveSharingAudit" action="read">
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canUploadHistorical ? (
              <Button onClick={() => setUploadOpen(true)} className="gap-2">
                <Plus className="size-4" />
                {t("uploadHistorical.trigger")}
              </Button>
            ) : null
          }
        />

        <Card>
          <CardContent className="p-0">
            <div className="border-border flex flex-col gap-3 border-b px-4 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" />
                  <Input
                    placeholder={t("searchPlaceholder")}
                    aria-label={t("searchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 ps-9"
                  />
                </div>
                <Select
                  value={kind}
                  onValueChange={(v) => setKind(v as ArchiveEntryKind | typeof ALL)}
                >
                  <SelectTrigger
                    className="h-8 w-full sm:w-44"
                    aria-label={t("filterKindLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterKindAll")}</SelectItem>
                    <SelectItem value="study">{t("filterKindStudy")}</SelectItem>
                    <SelectItem value="report">{t("filterKindReport")}</SelectItem>
                    <SelectItem value="historical">
                      {t("filterKindHistorical")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {isCrossEntity ? (
                  <Select value={organizationId} onValueChange={setOrganizationId}>
                    <SelectTrigger
                      className="h-8 w-full sm:w-48"
                      aria-label={t("filterEntityLabel")}
                    >
                      <SelectValue placeholder={t("filterEntityAll")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>{t("filterEntityAll")}</SelectItem>
                      {allOrgs.map((org) => (
                        <SelectItem key={org.id} value={org.id}>
                          <AutoTranslate text={org.name} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger
                    className="h-8 w-full sm:w-44"
                    aria-label={t("filterRegionLabel")}
                  >
                    <SelectValue placeholder={t("filterRegionAll")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterRegionAll")}</SelectItem>
                    {allRegions.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={village} onValueChange={setVillage}>
                  <SelectTrigger
                    className="h-8 w-full sm:w-44"
                    aria-label={t("filterVillageLabel")}
                  >
                    <SelectValue placeholder={t("filterVillageAll")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterVillageAll")}</SelectItem>
                    {allVillages.map((v) => (
                      <SelectItem key={v} value={v}>
                        <AutoTranslate text={v} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger
                    className="h-8 w-full sm:w-48"
                    aria-label={t("filterSectorLabel")}
                  >
                    <SelectValue placeholder={t("filterSectorAll")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>{t("filterSectorAll")}</SelectItem>
                    {sectorOptions.map((s) => (
                      <SelectItem key={s.name} value={s.name}>
                        {localizedName(s, locale)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-64">{t("titleColumn")}</TableHead>
                  {isCrossEntity ? (
                    <TableHead className="w-56">{t("entityColumn")}</TableHead>
                  ) : null}
                  <TableHead className="w-28">{t("kindColumn")}</TableHead>
                  <TableHead className="w-28">{t("statusColumn")}</TableHead>
                  <TableHead className="w-52">{t("villagesColumn")}</TableHead>
                  <TableHead className="w-40">{t("dateColumn")}</TableHead>
                  <TableHead className="w-56">{t("actionsColumn")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries === null ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: columnCount }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="h-56 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="bg-muted flex size-14 items-center justify-center rounded-full">
                          <ArchiveIcon className="text-muted-foreground size-6" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground text-sm font-medium">
                            {loadFailed ? t("loadError") : t("noResults")}
                          </p>
                          {!loadFailed ? (
                            <p className="text-muted-foreground max-w-sm text-xs">
                              {hasActiveFilters
                                ? t("noResultsFilteredHint")
                                : t("noResultsEmptyHint")}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedEntries.map((entry) => {
                    const isHistorical = entry.kind === "historical";
                    return (
                      <TableRow
                        key={`${entry.kind}-${entry.id}`}
                        onClick={
                          isHistorical && !entry.studyId
                            ? () => setDetailEntry(entry)
                            : () => openEntry(entry)
                        }
                        className="hover:bg-accent/50 cursor-pointer"
                      >
                        <TableCell className="max-w-64 py-4 text-sm font-medium break-words whitespace-normal">
                          <AutoTranslate text={entry.title} />
                        </TableCell>
                        {isCrossEntity ? (
                          <TableCell className="text-muted-foreground max-w-56 text-sm break-words whitespace-normal">
                            <AutoTranslate text={entry.organizationName} />
                          </TableCell>
                        ) : null}
                        <TableCell>
                          <Badge variant="outline">{t(`kind.${entry.kind}`)}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {entry.kind === "report" && tReportStatus.has(entry.status)
                            ? tReportStatus(
                                entry.status as Parameters<typeof tReportStatus>[0],
                              )
                            : t.has(`statusValues.${entry.status}`)
                              ? t(
                                  `statusValues.${entry.status}` as Parameters<
                                    typeof t
                                  >[0],
                                )
                              : entry.status}
                        </TableCell>
                        <TableCell className="text-muted-foreground max-w-52 text-sm break-words whitespace-normal">
                          {entry.villages.length === 0 ? (
                            "—"
                          ) : (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span>
                                <AutoTranslate
                                  text={entry.villages.slice(0, 2).join(", ")}
                                />
                              </span>
                              {entry.villages.length > 2 ? (
                                <Badge
                                  variant="outline"
                                  className="text-[10px]"
                                  title={entry.villages.slice(2).join(", ")}
                                >
                                  +{entry.villages.length - 2}
                                </Badge>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          <FormattedDate value={entry.date} />
                        </TableCell>
                        <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="size-8"
                              title={t("viewDetails")}
                              aria-label={t("viewDetails")}
                              onClick={() =>
                                isHistorical && !entry.studyId
                                  ? setDetailEntry(entry)
                                  : openEntry(entry)
                              }
                            >
                              <Eye className="size-4" />
                            </Button>
                            {isHistorical ? (
                              <>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  title={t("previewFile")}
                                  aria-label={t("previewFile")}
                                  onClick={() => previewHistoricalFile(entry)}
                                >
                                  <ExternalLink className="size-4" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="size-8"
                                  title={t("downloadFile")}
                                  aria-label={t("downloadFile")}
                                  onClick={() => downloadHistoricalFile(entry)}
                                >
                                  <Download className="size-4" />
                                </Button>
                                {/* RIO-DATA-002 — only a historical entry has
                                    anything to import. Once imported this
                                    becomes a link to the needs it produced;
                                    a file the importer cannot parse (e.g. a
                                    PDF) shows neither, because offering a
                                    button that always fails is worse than
                                    offering none. */}
                                {entry.studyId ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/studies/${entry.studyId}`)
                                    }
                                  >
                                    {t("viewImported")}
                                  </Button>
                                ) : canImport &&
                                  entry.organizationId === ownOrgId &&
                                  isImportableFileName(entry.fileName ?? "") ? (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setImportEntry(entry)}
                                  >
                                    <Database className="size-4" />
                                    {t("importToDashboard")}
                                  </Button>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {entries && entries.length > 0 ? (
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

        {canUploadHistorical ? (
          <HistoricalStudyUploadDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            sectorOptions={sectorOptions}
            onUploaded={loadEntries}
          />
        ) : null}

        <Dialog
          open={detailEntry !== null}
          onOpenChange={(open) => !open && setDetailEntry(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{tDetail("title")}</DialogTitle>
            </DialogHeader>
            {detailEntry ? (
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-muted-foreground text-xs font-medium">
                    {t("titleColumn")}
                  </p>
                  <p dir="auto" className="text-foreground text-sm break-words">
                    <AutoTranslate text={detailEntry.title} />
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tDetail("entityLabel")}
                    </p>
                    <p className="text-foreground text-sm break-words">
                      <AutoTranslate text={detailEntry.organizationName} />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tUpload("regionLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      {detailEntry.region.length ? (
                        <AutoTranslate text={detailEntry.region.join(", ")} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tGeo("governorateLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      {detailEntry.governorateNames?.length ? (
                        <AutoTranslate text={detailEntry.governorateNames.join(", ")} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tGeo("centerLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      {detailEntry.centerNames?.length ? (
                        <AutoTranslate text={detailEntry.centerNames.join(", ")} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tUpload("subjectLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      {detailEntry.sector ? (
                        <AutoTranslate text={detailEntry.sector} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tUpload("studyDateLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      <FormattedDate value={detailEntry.date} />
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tUpload("authorLabel")}
                    </p>
                    <p className="text-foreground text-sm break-words">
                      {detailEntry.author ? (
                        <AutoTranslate text={detailEntry.author} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tUpload("methodologyVersionLabel")}
                    </p>
                    <p className="text-foreground text-sm break-words">
                      {detailEntry.methodologyVersionLabel ? (
                        <AutoTranslate text={detailEntry.methodologyVersionLabel} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tDetail("uploadedByLabel")}
                    </p>
                    <p className="text-foreground text-sm break-words">
                      {detailEntry.uploadedByName ? (
                        <AutoTranslate text={detailEntry.uploadedByName} />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground text-xs font-medium">
                      {tDetail("uploadedAtLabel")}
                    </p>
                    <p className="text-foreground text-sm">
                      {detailEntry.uploadedAt ? (
                        <FormattedDate value={detailEntry.uploadedAt} withTime />
                      ) : (
                        tDetail("notAvailable")
                      )}
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetailEntry(null)}>
                {tDetail("close")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <HistoricalStudyImportDialog
          entry={importEntry}
          open={importEntry !== null}
          onOpenChange={(next) => {
            if (!next) setImportEntry(null);
          }}
          onImported={loadEntries}
        />
      </PageContainer>
    </PermissionGuard>
  );
}
