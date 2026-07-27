"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { organizationsService } from "@/services/organizations/organizations.service";

interface CreateOrganizationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateOrganizationDialogProps) {
  const t = useTranslations("systemAdmin.createDialog");

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [region, setRegion] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [_errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setName("");
    setCode("");
    setRegion("");
    setContactPerson("");
    setContactEmail("");
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    setIsSubmitting(true);
    setErrorMsg("");
    try {
      await organizationsService.create({
        name: name.trim(),
        registrationNumber: code.trim(),
        region: region.trim() ? [region.trim()] : [],
        email: contactEmail.trim() || undefined,
        adminName: contactPerson.trim() || undefined,
        adminEmail: contactEmail.trim() || undefined,
      });

      resetForm();
      onOpenChange(false);
      onCreated();
    } catch {
      setErrorMsg(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="org-name">
                {t("nameLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-code">
                {t("codeLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="org-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder={t("codePlaceholder")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="org-region">{t("regionLabel")}</Label>
              <Input
                id="org-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={t("regionPlaceholder")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="org-contact">{t("contactPersonLabel")}</Label>
                <Input
                  id="org-contact"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder={t("contactPersonPlaceholder")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-email">{t("contactEmailLabel")}</Label>
                <Input
                  id="org-email"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder={t("contactEmailPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("initialStatus")}</Label>
              <div>
                <Badge
                  variant="default"
                  className="bg-badge-success text-badge-success-foreground border-transparent"
                >
                  {t("activeStatus")}
                </Badge>
              </div>
            </div>

            <div className="bg-muted/50 text-muted-foreground rounded-md p-3 text-xs">
              {t("ngoAdminNote")}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim() || !code.trim()}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
