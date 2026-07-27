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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usersService } from "@/services/users/users.service";
import { apiClient } from "@/services/api/client";
import { endpoints } from "@/services/api/endpoints";

interface RoleOption {
  id: string;
  key: string;
  name: string;
}

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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState("");
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      apiClient
        .get<RoleOption[]>(endpoints.roles.list)
        .then((allRoles) => {
          // Filter out System Admin role for organization user management
          const filtered = allRoles.filter((r) => r.key !== "system_admin");
          setRoles(filtered);
          if (filtered.length > 0) {
            setRoleId(filtered[0].id);
          }
        })
        .catch(() => setRoles([]));
    }
  }, [open]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!name.trim() || !email.trim() || !roleId) return;

    setIsSubmitting(true);
    try {
      await usersService.createForOrg(organizationId, {
        name: name.trim(),
        email: email.trim(),
        roleId,
      });

      resetForm();
      onOpenChange(false);
      onInvited();
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
              <Input value={organizationName} disabled className="bg-muted font-medium" />
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
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
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
