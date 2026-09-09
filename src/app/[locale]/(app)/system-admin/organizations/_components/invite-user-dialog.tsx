"use client";

import { UserPlus } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
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
import { useAutoTranslate } from "@/hooks/use-auto-translate";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { rolesService } from "@/services/roles/roles.service";
import type { RoleSummary } from "@/services/roles/roles.types";
import { usersService } from "@/services/users/users.service";
import { getAssignableOrganizationRoles } from "./role-options";

interface InviteUserDialogProps {
  organizationId: string;
  organizationName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInvited: () => void;
}

export function InviteUserDialog({
  organizationId,
  organizationName,
  open,
  onOpenChange,
  onInvited,
}: InviteUserDialogProps) {
  const t = useTranslations("systemAdmin.users.inviteDialog");
  const tRoleNames = useTranslations("app.settings.roles.roleNames");
  // The org name goes into a disabled <input>, whose `value` must be a plain
  // string — can't wrap it in <AutoTranslate> the way a display-only element
  // handles this elsewhere (see PageHeader's `title` prop, same constraint).
  const translatedOrgName = useAutoTranslate(organizationName).text;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<RoleSummary[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [credentials, setCredentials] = useState<{
    email: string;
    temporaryPasswordEmailed: boolean;
    temporaryPassword?: string;
  } | null>(null);

  useEffect(() => {
    if (open) {
      // Must go through rolesService, NOT a raw apiClient.get on
      // endpoints.roles.list: `enabled` is a UI-only field the backend's
      // RoleDef does not carry (see role-matrix.ts), synthesized here by
      // joining the local matrix. Fetching raw left every role with
      // `enabled: undefined`, which getAssignableOrganizationRoles filters
      // out as falsy — emptying this dropdown entirely and leaving no way
      // to assign Center Supervisor anywhere in the UI.
      rolesService
        .list()
        .then((allRoles) => {
          // Filter out System Admin role for organization user management
          const filtered = getAssignableOrganizationRoles(allRoles);
          setRoles(filtered);
          if (filtered.length > 0) {
            setRoleId(filtered[0].id);
          }
        })
        .catch(() => {
          setRoles([]);
          setErrorMsg(t("roleLoadError"));
        });
    }
  }, [open, t]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setErrorMsg("");
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) setCredentials(null);
    onOpenChange(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim() || !roleId) return;

    setIsSubmitting(true);
    try {
      const created = await usersService.createForOrg(organizationId, {
        name: name.trim(),
        email: email.trim(),
        roleId,
      });

      resetForm();
      onInvited();
      // Don't close yet — the temporary password (or emailed confirmation)
      // needs to be shown to the admin first; see the `credentials` state.
      setCredentials({
        email: created.email,
        temporaryPasswordEmailed: created.temporaryPasswordEmailed,
        temporaryPassword: created.temporaryPassword,
      });
    } catch {
      setErrorMsg(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (credentials) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-foreground text-sm">
              {t("userCreatedSuccess", { email: credentials.email })}
            </p>
            {credentials.temporaryPasswordEmailed ? (
              <p className="border-badge-success bg-badge-success/40 text-badge-success-foreground rounded-md border p-3 text-sm">
                {t("temporaryPasswordEmailed")}
              </p>
            ) : (
              <div className="border-warning/40 bg-warning/10 space-y-2 rounded-md border p-3">
                <p className="text-foreground text-sm">
                  {t("temporaryPasswordNotEmailed")}
                </p>
                <p className="border-border bg-background rounded-md border px-3 py-2 font-mono text-sm">
                  {credentials.temporaryPassword}
                </p>
                <p className="text-muted-foreground text-xs">
                  {t("temporaryPasswordHint")}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => handleOpenChange(false)}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="text-primary flex items-center gap-2">
              <UserPlus className="size-5" />
              <DialogTitle>{t("title")}</DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-xs">
              {t("description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errorMsg ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
                {errorMsg}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <Label className="text-muted-foreground text-xs">
                {t("organizationLabel")}
              </Label>
              <Input
                value={translatedOrgName}
                disabled
                className="bg-muted font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-name">
                {t("nameLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">
                {t("emailLabel")} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailPlaceholder")}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">
                {t("roleLabel")} <span className="text-destructive">*</span>
              </Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="invite-role">
                  <SelectValue placeholder={t("rolePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {tRoleNames.has(r.key) ? tRoleNames(r.key) : r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              {t("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !name.trim() || !email.trim() || !roleId}
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
