"use client";

import { Milestone, Plus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { AutoTranslate } from "@/components/common/auto-translate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { usePermission } from "@/hooks/use-permission";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import { InitiativeFormDialog } from "@/components/features/initiatives/initiative-form-dialog";
import { initiativesService } from "@/services/initiatives/initiatives.service";
import type { Initiative } from "@/services/initiatives/initiatives.types";

export function InitiativesPanel() {
  const t = useTranslations("app.initiatives");
  const tStatus = useTranslations("app.initiatives.statusValues");
  const { localizedDomain } = useDomainArabicMap();
  const { session } = useAuth();
  const canWriteInitiatives = usePermission("initiatives", "write");
  const canCreateInitiatives = usePermission("initiatives", "create");
  const canWrite = canWriteInitiatives || canCreateInitiatives;

  const [rows, setRows] = useState<Initiative[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Initiative | null>(null);
  // Bumped on every open so `key={formKey}` below remounts the dialog with
  // fresh internal state instead of resetting it inside an effect.
  const [formKey, setFormKey] = useState(0);

  function load() {
    initiativesService
      .list()
      .then((data) => {
        setRows(data);
        setLoadFailed(false);
      })
      .catch(() => {
        setRows([]);
        setLoadFailed(true);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const myOrgId = session?.organization.id;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {canWrite ? (
          <Button
            onClick={() => {
              setEditing(null);
              setFormKey((k) => k + 1);
              setFormOpen(true);
            }}
            className="gap-2"
          >
            <Plus className="size-4" />
            {t("newInitiative")}
          </Button>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nameColumn")}</TableHead>
                  <TableHead>{t("orgColumn")}</TableHead>
                  <TableHead className="w-32">{t("domainColumn")}</TableHead>
                  <TableHead className="w-28">{t("statusColumn")}</TableHead>
                  <TableHead className="w-36 text-center">
                    {t("linkedNeedsColumn")}
                  </TableHead>
                  <TableHead className="w-44">{t("visibilityColumn")}</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows === null ? (
                  Array.from({ length: 3 }).map((_, index) => (
                    <TableRow key={index}>
                      {Array.from({ length: 7 }).map((__, cell) => (
                        <TableCell key={cell} className="py-4">
                          <div className="bg-muted h-4 w-24 rounded" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2.5">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <Milestone className="size-5" />
                        </div>
                        <p>{loadFailed ? t("loadError") : t("noInitiatives")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((row) => {
                    const isOwner = row.orgId === myOrgId;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="py-4 text-sm font-medium break-words whitespace-normal">
                          <AutoTranslate text={row.name} />
                        </TableCell>
                        <TableCell className="text-sm break-words whitespace-normal">
                          <AutoTranslate text={row.orgName} />
                        </TableCell>
                        <TableCell className="text-sm">
                          {row.domain ? localizedDomain(row.domain) : "—"}
                        </TableCell>
                        <TableCell className="text-sm capitalize">
                          {tStatus.has(row.status.toLowerCase())
                            ? tStatus(
                                row.status.toLowerCase() as Parameters<typeof tStatus>[0],
                              )
                            : row.status}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {row.linkedNeedCount}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge
                            variant={row.openToOtherEntities ? "default" : "outline"}
                          >
                            {row.openToOtherEntities
                              ? t("visibilityOpen")
                              : t("visibilityOwnerOnly")}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-4">
                          {isOwner && canWrite ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditing(row);
                                setFormKey((k) => k + 1);
                                setFormOpen(true);
                              }}
                            >
                              {t("edit")}
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <InitiativeFormDialog
        key={formKey}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSaved={load}
        editing={editing}
      />
    </div>
  );
}
