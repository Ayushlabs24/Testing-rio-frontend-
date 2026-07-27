"use client";

import { ClipboardList, Search, Eye } from "lucide-react";
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
import { endpoints } from "@/services/api/endpoints";

interface StudyItem {
  id: string;
  title: string;
  cycleNumber: number;
  villages: string[];
  createdAt: string;
  status: string;
  surveysCount?: number;
}

interface OrgStudiesTabProps {
  organizationId: string;
}

export function OrgStudiesTab({ organizationId }: OrgStudiesTabProps) {
  const t = useTranslations("systemAdmin.studies");
  const [studies, setStudies] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let isMounted = true;
    if (!organizationId) return;

    apiClient
      .get<{ items: StudyItem[] }>(endpoints.studies.list, {
        params: { organizationId },
      })
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
  }, [organizationId]);

  const filteredStudies = useMemo(() => {
    return studies.filter((s) =>
      s.title.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [studies, searchQuery]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="text-primary size-5" />
          <CardTitle className="text-base font-semibold">
            {t("title")} ({studies.length})
          </CardTitle>
          <Badge variant="outline" className="text-muted-foreground text-xs">
            {t("readOnlyBadge")}
          </Badge>
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
              <TableHead>{t("columns.village")}</TableHead>
              <TableHead>{t("columns.createdDate")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
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
            ) : filteredStudies.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-muted-foreground h-24 text-center">
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
                  <TableCell className="text-muted-foreground text-xs">
                    {study.villages.length > 0 ? study.villages.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {new Date(study.createdAt).toLocaleDateString()}
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
