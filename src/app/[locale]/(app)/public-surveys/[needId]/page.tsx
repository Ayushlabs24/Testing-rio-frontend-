"use client";

import { Check, Copy, Plus, QrCode as QrCodeIcon, Share2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { QRCodeSVG } from "qrcode.react";
import { use, useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { BackButton } from "@/components/common/back-button";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { PermissionGuard } from "@/components/layout/permission-guard";
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
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePermission } from "@/hooks/use-permission";
import { ApiError } from "@/services/api/types";
import { needsService } from "@/services/needs/needs.service";
import type { Need } from "@/services/needs/needs.types";
import { publicSurveysService } from "@/services/public-surveys/public-surveys.service";
import type { PublicSurveyLink } from "@/services/public-surveys/public-surveys.types";

const LABEL_MAX_LENGTH = 150;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(iso),
  );
}

function LinkRow({
  link,
  canWrite,
  onDeactivated,
}: {
  link: PublicSurveyLink;
  canWrite: boolean;
  onDeactivated: () => void;
}) {
  const t = useTranslations("app.publicSurveys.detail");
  const [copied, setCopied] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);

  async function copyUrl() {
    await navigator.clipboard.writeText(link.publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // Reuses the existing publicUrl as-is — never generates a new URL or QR.
  // Falls back to the same copy-link behavior (and its "Copied" feedback)
  // when the Web Share API isn't available, or when the user's platform
  // share sheet fails for a reason other than them just cancelling it.
  async function shareUrl() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: link.label, url: link.publicUrl });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    await copyUrl();
  }

  return (
    <TableRow>
      <TableCell
        className="max-w-48 truncate py-4 text-sm font-medium"
        title={link.label}
      >
        {link.label}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {formatDate(link.createdAt)}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {link.expiresAt ? formatDate(link.expiresAt) : t("neverExpires")}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm tabular-nums">
        {link.responseCount}
      </TableCell>
      <TableCell>
        <Badge
          variant={link.isActive ? "default" : "outline"}
          className={
            link.isActive
              ? "bg-badge-success text-badge-success-foreground border-transparent"
              : undefined
          }
        >
          {link.isActive ? t("active") : t("inactive")}
        </Badge>
      </TableCell>
      <TableCell className="py-4">
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={copyUrl}
                  aria-label={copied ? t("copied") : t("copyUrl")}
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{copied ? t("copied") : t("copyUrl")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={shareUrl}
                  aria-label={t("share")}
                >
                  <Share2 className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("share")}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="outline"
                  className="size-8"
                  onClick={() => setQrOpen(true)}
                  aria-label={t("viewQrCode")}
                >
                  <QrCodeIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("viewQrCode")}</TooltipContent>
            </Tooltip>

            {canWrite && link.isActive ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                  >
                    {t("deactivate")}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t("deactivateConfirmTitle")}</AlertDialogTitle>
                    <AlertDialogDescription>
                      {t("deactivateConfirmDescription")}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
                    <AlertDialogAction onClick={onDeactivated}>
                      {t("deactivate")}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </div>
        </TooltipProvider>

        <Dialog open={qrOpen} onOpenChange={setQrOpen}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>{link.label}</DialogTitle>
            </DialogHeader>
            <div className="flex justify-center py-2">
              <div className="bg-background rounded-md border p-3">
                <QRCodeSVG value={link.publicUrl} size={192} />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}

export default function PublicSurveyDetailPage({
  params,
}: {
  params: Promise<{ needId: string }>;
}) {
  const { needId } = use(params);
  const t = useTranslations("app.publicSurveys.detail");
  const canCreate = usePermission("studySurvey", "create");
  const canWrite = usePermission("studySurvey", "write");

  const [need, setNeed] = useState<Need | null>(null);
  const [links, setLinks] = useState<PublicSurveyLink[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [creating, setCreating] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  function load() {
    Promise.all([needsService.getById(needId), publicSurveysService.listLinks(needId)])
      .then(([needResult, linkRows]) => {
        setNeed(needResult);
        setLinks(linkRows);
        setLoadFailed(false);
      })
      .catch(() => {
        setLinks([]);
        setLoadFailed(true);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId]);

  function handleCreateOpenChange(next: boolean) {
    setCreateOpen(next);
    if (!next) {
      setLabel("");
      setExpiresInDays("");
      setLabelError(null);
      setFormError(null);
    }
  }

  function validateLabel(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) return t("linkLabelRequired");
    if (trimmed.length > LABEL_MAX_LENGTH) return t("linkLabelTooLong");
    return null;
  }

  async function submitCreate() {
    const validationError = validateLabel(label);
    setLabelError(validationError);
    if (validationError) return;

    setCreating(true);
    setFormError(null);
    try {
      await publicSurveysService.createLink(needId, {
        label: label.trim(),
        expiresInDays: expiresInDays ? Number(expiresInDays) : undefined,
      });
      handleCreateOpenChange(false);
      load();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    } finally {
      setCreating(false);
    }
  }

  async function deactivate(linkId: string) {
    await publicSurveysService.deactivateLink(needId, linkId);
    load();
  }

  return (
    <PermissionGuard module="studySurvey" action="read">
      <PageContainer>
        <PageHeader
          title={need?.title ?? ""}
          description={t("description")}
          actions={
            <>
              <BackButton href="/public-surveys" label={t("backToList")} />
              {/* "View Responses" hidden for now — page still exists, just
               * not linked from here yet. */}
              {canCreate ? (
                <Button onClick={() => setCreateOpen(true)} className="gap-2">
                  <Plus className="size-4" />
                  {t("newLink")}
                </Button>
              ) : null}
            </>
          }
        />

        <div className="space-y-4">
          <h2 className="text-foreground text-sm font-semibold">{t("linksHeading")}</h2>

          {links === null ? (
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="bg-muted h-12 animate-pulse rounded-md" />
              ))}
            </div>
          ) : links.length === 0 ? (
            <Card>
              <CardContent className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 text-center text-sm">
                <QrCodeIcon className="size-6" />
                {loadFailed ? t("loadError") : t("noLinks")}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-48">{t("labelColumn")}</TableHead>
                      <TableHead className="w-32">{t("createdColumn")}</TableHead>
                      <TableHead className="w-32">{t("expiryColumn")}</TableHead>
                      <TableHead className="w-28">{t("responsesColumn")}</TableHead>
                      <TableHead className="w-28">{t("statusColumn")}</TableHead>
                      <TableHead className="w-44" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {links.map((link) => (
                      <LinkRow
                        key={link.id}
                        link={link}
                        canWrite={canWrite}
                        onDeactivated={() => deactivate(link.id)}
                      />
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={createOpen} onOpenChange={handleCreateOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("newLink")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="survey-link-label">
                  {t("linkLabelLabel")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="survey-link-label"
                  maxLength={LABEL_MAX_LENGTH}
                  placeholder={t("linkLabelPlaceholder")}
                  value={label}
                  onChange={(e) => {
                    setLabel(e.target.value);
                    if (labelError) setLabelError(null);
                  }}
                  aria-invalid={labelError ? true : undefined}
                />
                {labelError ? (
                  <p className="text-destructive text-sm">{labelError}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="expires-in-days">{t("expiresInDaysLabel")}</Label>
                <Input
                  id="expires-in-days"
                  type="number"
                  min={1}
                  placeholder={t("expiresInDaysPlaceholder")}
                  value={expiresInDays}
                  onChange={(e) => setExpiresInDays(e.target.value)}
                />
              </div>
              {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => handleCreateOpenChange(false)}>
                {t("cancel")}
              </Button>
              <Button onClick={submitCreate} disabled={creating}>
                {creating ? t("creating") : t("create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </PermissionGuard>
  );
}
