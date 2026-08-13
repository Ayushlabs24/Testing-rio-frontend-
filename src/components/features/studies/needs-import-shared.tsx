"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ImportNeedRowError, ParsedPdfNeedItem } from "@/services/needs/needs.types";

/** Shared error results table — used by both ImportNeedsDialog and
 * ImportSurveyResultsDialog.  Row and error column labels are read from
 * the `app.studies.import` namespace. */
export function ErrorTable({
  rows,
  destructive,
}: {
  rows: ImportNeedRowError[];
  destructive: boolean;
}) {
  const t = useTranslations("app.studies.import");
  return (
    <div className="max-h-56 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-20">{t("rowColumn")}</TableHead>
            <TableHead>{t("errorColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((err) => (
            <TableRow key={err.row}>
              <TableCell>
                <Badge variant="outline">{err.row}</Badge>
              </TableCell>
              <TableCell className={destructive ? "text-destructive text-sm" : "text-sm"}>
                {err.message}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/** Editable preview table for AI-extracted needs — used by both
 * ImportNeedsDialog (PDF path) and ImportSurveyResultsDialog.
 * Column headers and field placeholders come from the `app.studies.import`
 * namespace.  Renders `emptyMessage` when `needs` is empty. */
export function EditableNeedsPreviewTable({
  needs,
  emptyMessage,
  onUpdateField,
  onRemove,
}: {
  needs: ParsedPdfNeedItem[];
  emptyMessage: string;
  onUpdateField: (id: string, field: keyof ParsedPdfNeedItem, value: string) => void;
  onRemove: (id: string) => void;
}) {
  const t = useTranslations("app.studies.import");

  if (needs.length === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/4">{t("needTitleColumn")}</TableHead>
            <TableHead className="w-1/3">{t("needStatementColumn")}</TableHead>
            <TableHead>{t("governorateColumn")}</TableHead>
            <TableHead>{t("referenceIdColumn")}</TableHead>
            <TableHead className="w-12">{t("actionsColumn")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {needs.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="align-top">
                <Input
                  value={item.title}
                  onChange={(e) => onUpdateField(item.id, "title", e.target.value)}
                  className="text-xs"
                />
              </TableCell>
              <TableCell className="align-top">
                <Textarea
                  value={item.statement}
                  onChange={(e) => onUpdateField(item.id, "statement", e.target.value)}
                  rows={2}
                  className="resize-none text-xs"
                />
              </TableCell>
              <TableCell className="align-top">
                <Input
                  value={item.village ?? ""}
                  onChange={(e) => onUpdateField(item.id, "village", e.target.value)}
                  placeholder={t("governorateVillagePlaceholder")}
                  className="text-xs"
                />
              </TableCell>
              <TableCell className="align-top">
                <Input
                  value={item.referenceId ?? ""}
                  onChange={(e) => onUpdateField(item.id, "referenceId", e.target.value)}
                  placeholder={t("refIdPlaceholder")}
                  className="text-xs"
                />
              </TableCell>
              <TableCell className="align-top">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemove(item.id)}
                  aria-label={t("removeNeed")}
                  className="text-destructive hover:bg-destructive/10 size-8"
                >
                  <Trash2 className="size-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
