"use client";

import { ListTree, MoreVertical, Plus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/routing";
import { localizedName } from "@/lib/bilingual";
import { useEffect, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermission } from "@/hooks/use-permission";
import { cn } from "@/lib/utils";
import { domainsService } from "@/services/domains/domains.service";
import type { Domain, SubDomain } from "@/services/domains/domains.types";
import { ApiError } from "@/services/api/types";

interface EntityFormState {
  code: string;
  // Locale-scoped, not a bilingual pair of fields: this single "Name" input
  // edits `name` while the app is in English and `nameAr` while it's in
  // Arabic (see openEditDomain/submitDomain) — one visible field per client
  // preference, not English/Arabic shown side by side.
  name: string;
  displayOrder: string;
}

const EMPTY_FORM: EntityFormState = { code: "", name: "", displayOrder: "0" };

function StatusBadge({
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  isActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <Badge
      variant={isActive ? "default" : "outline"}
      className={
        isActive
          ? "bg-badge-success text-badge-success-foreground border-transparent"
          : undefined
      }
    >
      {isActive ? activeLabel : inactiveLabel}
    </Badge>
  );
}

/** One row in either the domain list or the sub-domain list — name, status
 * badge, and a single ⋮ menu for Edit/Activate/Deactivate, instead of a
 * Switch + Edit icon repeated on every row. */
function EntityRow({
  name,
  isActive,
  selected,
  onClick,
  onEdit,
  onToggleActive,
  canWrite,
  t,
}: {
  name: string;
  isActive: boolean;
  selected?: boolean;
  onClick?: () => void;
  onEdit: () => void;
  onToggleActive: (next: boolean) => void;
  canWrite: boolean;
  t: (key: string) => string;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors",
        onClick && "hover:bg-muted/60 cursor-pointer",
        selected && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={cn(
            "text-sm font-medium",
            selected ? "text-primary" : "text-foreground",
          )}
        >
          {name}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusBadge
          isActive={isActive}
          activeLabel={t("active")}
          inactiveLabel={t("inactive")}
        />
        {canWrite ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={(event) => event.stopPropagation()}
                aria-label={t("actions")}
              >
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>{t("edit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onToggleActive(!isActive)}>
                {isActive ? t("deactivate") : t("activate")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}

export function DomainsTab() {
  const t = useTranslations("app.settings.methodology.domains");
  const canWrite = usePermission("methodologyQuestionBank", "write");
  const locale = useLocale() as AppLocale;

  const [domains, setDomains] = useState<Domain[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [subDomains, setSubDomains] = useState<SubDomain[] | null>(null);

  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
  const [domainForm, setDomainForm] = useState<EntityFormState>(EMPTY_FORM);

  const [subDialogOpen, setSubDialogOpen] = useState(false);
  const [editingSubDomain, setEditingSubDomain] = useState<SubDomain | null>(null);
  const [subForm, setSubForm] = useState<EntityFormState>(EMPTY_FORM);

  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadDomains = () => {
    domainsService
      .list()
      .then((rows) => {
        setDomains(rows);
        setLoadFailed(false);
        if (!selectedDomainId && rows.length > 0) setSelectedDomainId(rows[0]!.id);
      })
      .catch(() => {
        setDomains([]);
        setLoadFailed(true);
      });
  };

  useEffect(() => {
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubDomains = (domainId: string) => {
    domainsService
      .listSubDomains(domainId)
      .then(setSubDomains)
      .catch(() => setSubDomains([]));
  };

  useEffect(() => {
    if (selectedDomainId) loadSubDomains(selectedDomainId);
  }, [selectedDomainId]);

  const selectedDomain = domains?.find((d) => d.id === selectedDomainId) ?? null;

  function openCreateDomain() {
    setEditingDomain(null);
    setDomainForm(EMPTY_FORM);
    setFormError(null);
    setDomainDialogOpen(true);
  }

  function openEditDomain(domain: Domain) {
    setEditingDomain(domain);
    setDomainForm({
      code: domain.code,
      name: locale === "ar" ? (domain.nameAr ?? "") : domain.name,
      displayOrder: String(domain.displayOrder),
    });
    setFormError(null);
    setDomainDialogOpen(true);
  }

  async function submitDomain() {
    setSaving(true);
    setFormError(null);
    try {
      const code = domainForm.code.trim();
      const name = domainForm.name.trim();
      const displayOrder = Number(domainForm.displayOrder) || 0;
      if (editingDomain) {
        // Editing follows the current locale — see EntityFormState's comment.
        await domainsService.update(
          editingDomain.id,
          locale === "ar"
            ? { code, nameAr: name, displayOrder }
            : { code, name, displayOrder },
        );
      } else {
        // A brand-new option always sets the English name, regardless of UI
        // language — its Arabic value is added later via Edit while
        // viewing in Arabic.
        await domainsService.create({ code, name, displayOrder });
      }
      setDomainDialogOpen(false);
      loadDomains();
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 409
          ? t("codeConflict")
          : t("genericError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleDomainActive(domain: Domain, isActive: boolean) {
    await domainsService.setActive(domain.id, isActive);
    loadDomains();
  }

  function openCreateSubDomain() {
    setEditingSubDomain(null);
    setSubForm(EMPTY_FORM);
    setFormError(null);
    setSubDialogOpen(true);
  }

  function openEditSubDomain(sub: SubDomain) {
    setEditingSubDomain(sub);
    setSubForm({
      code: sub.code,
      name: locale === "ar" ? (sub.nameAr ?? "") : sub.name,
      displayOrder: String(sub.displayOrder),
    });
    setFormError(null);
    setSubDialogOpen(true);
  }

  async function submitSubDomain() {
    if (!selectedDomainId) return;
    setSaving(true);
    setFormError(null);
    try {
      const code = subForm.code.trim();
      const name = subForm.name.trim();
      const displayOrder = Number(subForm.displayOrder) || 0;
      if (editingSubDomain) {
        // Editing follows the current locale — see EntityFormState's comment.
        await domainsService.updateSubDomain(
          selectedDomainId,
          editingSubDomain.id,
          locale === "ar"
            ? { code, nameAr: name, displayOrder }
            : { code, name, displayOrder },
        );
      } else {
        // A brand-new option always sets the English name — see submitDomain.
        await domainsService.createSubDomain(selectedDomainId, {
          code,
          name,
          displayOrder,
        });
      }
      setSubDialogOpen(false);
      loadSubDomains(selectedDomainId);
    } catch (error) {
      setFormError(
        error instanceof ApiError && error.status === 409
          ? t("codeConflict")
          : t("genericError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleSubDomainActive(sub: SubDomain, isActive: boolean) {
    if (!selectedDomainId) return;
    await domainsService.setSubDomainActive(selectedDomainId, sub.id, isActive);
    loadSubDomains(selectedDomainId);
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        {canWrite ? (
          <Button onClick={openCreateDomain} className="gap-2">
            <Plus className="size-4" />
            {t("newDomain")}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card>
          <CardContent className="space-y-1 p-3">
            <h2 className="text-muted-foreground px-1 pb-2 text-xs font-semibold tracking-wide uppercase">
              {t("domainsHeading")}
            </h2>
            {domains === null ? (
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="bg-muted h-10 animate-pulse rounded-lg" />
              ))
            ) : domains.length === 0 ? (
              <p className="text-muted-foreground px-1 py-6 text-center text-sm">
                {loadFailed ? t("loadError") : t("noDomains")}
              </p>
            ) : (
              domains.map((domain) => (
                <EntityRow
                  key={domain.id}
                  name={localizedName(domain, locale)}
                  isActive={domain.isActive}
                  selected={selectedDomainId === domain.id}
                  onClick={() => setSelectedDomainId(domain.id)}
                  onEdit={() => openEditDomain(domain)}
                  onToggleActive={(next) => toggleDomainActive(domain, next)}
                  canWrite={canWrite}
                  t={t}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3">
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                {t("subDomainsHeading")}
                {selectedDomain ? ` — ${localizedName(selectedDomain, locale)}` : ""}
              </h2>
              {canWrite && selectedDomainId ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 gap-1.5"
                  onClick={openCreateSubDomain}
                >
                  <Plus className="size-3.5" />
                  {t("newSubDomain")}
                </Button>
              ) : null}
            </div>

            {!selectedDomainId ? (
              <div className="text-muted-foreground flex h-32 flex-col items-center justify-center gap-2 text-center text-sm">
                <ListTree className="size-6" />
                {t("selectDomainHint")}
              </div>
            ) : subDomains === null ? (
              <div className="space-y-1">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="bg-muted h-10 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : subDomains.length === 0 ? (
              <p className="text-muted-foreground px-1 py-6 text-center text-sm">
                {t("noSubDomains")}
              </p>
            ) : (
              <div className="space-y-1">
                {subDomains.map((sub) => (
                  <EntityRow
                    key={sub.id}
                    name={localizedName(sub, locale)}
                    isActive={sub.isActive}
                    onEdit={() => openEditSubDomain(sub)}
                    onToggleActive={(next) => toggleSubDomainActive(sub, next)}
                    canWrite={canWrite}
                    t={t}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={domainDialogOpen} onOpenChange={setDomainDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDomain ? t("editDomain") : t("newDomain")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain-name">{t("nameLabel")}</Label>
              <Input
                id="domain-name"
                dir={editingDomain && locale === "ar" ? "rtl" : undefined}
                value={domainForm.name}
                onChange={(e) => setDomainForm({ ...domainForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-order">{t("displayOrderLabel")}</Label>
              <Input
                id="domain-order"
                type="number"
                value={domainForm.displayOrder}
                onChange={(e) =>
                  setDomainForm({ ...domainForm, displayOrder: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="domain-code">{t("codeLabel")}</Label>
              <Input
                id="domain-code"
                value={domainForm.code}
                onChange={(e) => setDomainForm({ ...domainForm, code: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">{t("codeHint")}</p>
            </div>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDomainDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submitDomain}
              disabled={saving || !domainForm.code || !domainForm.name}
            >
              {saving
                ? editingDomain
                  ? t("saving")
                  : t("creating")
                : editingDomain
                  ? t("save")
                  : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={subDialogOpen} onOpenChange={setSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSubDomain ? t("editSubDomain") : t("newSubDomain")}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t("parentDomainLabel")}</Label>
              <Input
                value={selectedDomain ? localizedName(selectedDomain, locale) : ""}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-name">{t("nameLabel")}</Label>
              <Input
                id="sub-name"
                dir={editingSubDomain && locale === "ar" ? "rtl" : undefined}
                value={subForm.name}
                onChange={(e) => setSubForm({ ...subForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-order">{t("displayOrderLabel")}</Label>
              <Input
                id="sub-order"
                type="number"
                value={subForm.displayOrder}
                onChange={(e) => setSubForm({ ...subForm, displayOrder: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sub-code">{t("codeLabel")}</Label>
              <Input
                id="sub-code"
                value={subForm.code}
                onChange={(e) => setSubForm({ ...subForm, code: e.target.value })}
              />
              <p className="text-muted-foreground text-xs">{t("codeHint")}</p>
            </div>
            {formError ? <p className="text-destructive text-sm">{formError}</p> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubDialogOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={submitSubDomain}
              disabled={saving || !subForm.code || !subForm.name}
            >
              {saving
                ? editingSubDomain
                  ? t("saving")
                  : t("creating")
                : editingSubDomain
                  ? t("save")
                  : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
