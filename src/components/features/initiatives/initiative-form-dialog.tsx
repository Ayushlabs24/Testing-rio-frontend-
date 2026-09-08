"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { domainsService } from "@/services/domains/domains.service";
import { ApiError } from "@/services/api/types";
import { initiativesService } from "@/services/initiatives/initiatives.service";
import type {
  CreateInitiativePayload,
  Currency,
  Initiative,
} from "@/services/initiatives/initiatives.types";
import { SUPPORTED_CURRENCIES } from "@/services/initiatives/initiatives.types";

const NONE = "__none__";

export function InitiativeFormDialog({
  open,
  onOpenChange,
  onSaved,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  editing: Initiative | null;
}) {
  const t = useTranslations("app.initiatives.create");
  const [domains, setDomains] = useState<string[]>([]);
  // The mount site passes `key={formKey}`, bumped on every open — a fresh
  // instance per open is what lets these start from `editing` directly
  // instead of being reset synchronously in an effect (which
  // react-hooks/set-state-in-effect rightly rejects).
  const [form, setForm] = useState<CreateInitiativePayload>(() =>
    editing
      ? {
          name: editing.name,
          domain: editing.domain ?? undefined,
          geography: editing.geography ?? undefined,
          startDate: editing.startDate ?? undefined,
          expectedEndDate: editing.expectedEndDate ?? undefined,
          status: editing.status,
          fundingSource: editing.fundingSource ?? undefined,
          description: editing.description ?? undefined,
          budget: editing.budget ? Number(editing.budget) : undefined,
          currency: editing.currency as Currency,
          openToOtherEntities: editing.openToOtherEntities,
        }
      : { name: "", currency: "SAR" },
  );
  const [nameError, setNameError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `listPublic()`, not `list()`: this dialog is reachable by NGO Admin,
    // which deliberately holds no `methodologyQuestionBank` grant at all
    // (client-confirmed 2026-08-20 — Methodology Configuration access moved
    // to System Admin only) — `.list()` 403s for that role. The public,
    // name-only, no-permission-required domain list is the right fit here:
    // this dropdown only ever needs domain names, nothing sensitive.
    // No `open` check needed — the mount site remounts this component fresh
    // (via `key={formKey}`) on every open, so a mount always starts open.
    domainsService
      .listPublic()
      .then((rows) => setDomains(rows.map((d) => d.name)))
      .catch(() => setDomains([]));
  }, []);

  async function submit() {
    const trimmedName = form.name.trim();
    if (!trimmedName) {
      setNameError(t("nameRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateInitiativePayload = { ...form, name: trimmedName };
      if (editing) {
        await initiativesService.update(editing.id, payload);
      } else {
        await initiativesService.create(payload);
      }
      onOpenChange(false);
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError && err.code ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? t("editTitle") : t("title")}</DialogTitle>
        </DialogHeader>
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="initiative-name">
              {t("nameLabel")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="initiative-name"
              value={form.name}
              onChange={(e) => {
                setForm((f) => ({ ...f, name: e.target.value }));
                if (nameError) setNameError(null);
              }}
              placeholder={t("namePlaceholder")}
              aria-invalid={nameError ? true : undefined}
            />
            {nameError ? <p className="text-destructive text-sm">{nameError}</p> : null}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("domainLabel")}</Label>
              <Select
                value={form.domain ?? NONE}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, domain: v === NONE ? undefined : v }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("domainPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("domainPlaceholder")}</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="initiative-status">{t("statusLabel")}</Label>
              <Input
                id="initiative-status"
                value={form.status ?? "active"}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initiative-geography">{t("geographyLabel")}</Label>
            <Input
              id="initiative-geography"
              value={form.geography ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, geography: e.target.value || undefined }))
              }
              placeholder={t("geographyPlaceholder")}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="initiative-start">{t("startDateLabel")}</Label>
              <Input
                id="initiative-start"
                type="date"
                value={form.startDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, startDate: e.target.value || undefined }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initiative-end">{t("expectedEndDateLabel")}</Label>
              <Input
                id="initiative-end"
                type="date"
                value={form.expectedEndDate ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, expectedEndDate: e.target.value || undefined }))
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="initiative-funding">{t("fundingSourceLabel")}</Label>
              <Input
                id="initiative-funding"
                value={form.fundingSource ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fundingSource: e.target.value || undefined }))
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="initiative-budget">{t("budgetLabel")}</Label>
              <div className="flex gap-2">
                <Select
                  value={form.currency ?? "SAR"}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, currency: v as Currency }))
                  }
                >
                  <SelectTrigger
                    className="w-24 shrink-0"
                    aria-label={t("currencyLabel")}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  id="initiative-budget"
                  type="number"
                  min={0}
                  className="min-w-0 flex-1"
                  value={form.budget ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      budget: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="initiative-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="initiative-description"
              value={form.description ?? ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value || undefined }))
              }
            />
          </div>

          <div className="flex items-start justify-between gap-4 rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="initiative-open">{t("openToOtherEntitiesLabel")}</Label>
              <p className="text-muted-foreground text-xs">
                {t("openToOtherEntitiesHint")}
              </p>
            </div>
            <Switch
              id="initiative-open"
              checked={form.openToOtherEntities ?? false}
              onCheckedChange={(checked) =>
                setForm((f) => ({ ...f, openToOtherEntities: checked }))
              }
            />
          </div>

          {error ? <p className="text-destructive text-sm">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? t("submitting") : t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
