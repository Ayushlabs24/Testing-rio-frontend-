"use client";

import { Archive, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
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
import { archiveService } from "@/services/archive/archive.service";
import type { ArchiveEntry } from "@/services/archive/archive.types";

const PAGE_SIZE = 10;

interface OrgArchiveTabProps {
  organizationId: string;
}

export function OrgArchiveTab({ organizationId }: OrgArchiveTabProps) {
  const t = useTranslations("systemAdmin.archive");
  const [entries, setEntries] = useState<ArchiveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let isMounted = true;
    if (!organizationId) return;

    archiveService
      .list({ organizationId })
      .then((res) => {
        if (isMounted) {
          setEntries(res ?? []);
          setLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setEntries([]);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [organizationId]);

  const filteredEntries = useMemo(() => {
    return entries.filter((e) =>
      e.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [entries, searchQuery]);

  const pageCount = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Archive className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">
            {t("title")} ({entries.length})
          </CardTitle>
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
              <TableHead>{t("columns.title")}</TableHead>
              <TableHead>{t("columns.kind")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead>{t("columns.date")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex justify-center">
                    <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
                  {t("noResults")}
                </TableCell>
              </TableRow>
            ) : (
              pagedEntries.map((entry) => (
                <TableRow key={`${entry.kind}-${entry.id}`}>
                  <TableCell className="text-foreground font-medium">
                    {entry.title}
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
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredEntries.length > 0 ? (
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
