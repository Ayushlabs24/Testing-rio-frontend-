"use client";

import { ShieldCheck, UserPlus, Users } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";

interface AssignNgoAdminDialogProps {
  organizationId: string;
  organizationName: string;
  hasCurrentAdmin: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssigned: () => void;
}

export function AssignNgoAdminDialog({
  organizationId,
  organizationName,
  hasCurrentAdmin,
  open,
  onOpenChange,
  onAssigned,
}: AssignNgoAdminDialogProps) {
  const t = useTranslations("systemAdmin.ngoAdmin.dialog");
  const [mode, setMode] = useState<"select" | "invite">("select");

  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && organizationId) {
      usersService
        .listForOrg(organizationId)
        .then((users) => setOrgUsers(users.filter((u) => u.role.key !== "system_admin")))
        .catch(() => setOrgUsers([]));
    }
  }, [open, organizationId]);

  const resetForm = () => {
    setMode("select");
    setSelectedUserId("");
    setName("");
    setEmail("");
    setReason("");
    setErrorMsg("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (mode === "select" && !selectedUserId) return;
    if (mode === "invite" && (!name.trim() || !email.trim())) return;

    setIsSubmitting(true);
    try {
      if (mode === "select") {
        await usersService.assignNgoAdmin(organizationId, {
          userId: selectedUserId,
          reason: reason.trim() || undefined,
        });
      } else {
        await usersService.assignNgoAdmin(organizationId, {
          name: name.trim(),
          email: email.trim(),
          reason: reason.trim() || undefined,
        });
      }

      resetForm();
      onOpenChange(false);
      onAssigned();
    } catch {
      setErrorMsg(t("errorToast"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="text-primary flex items-center gap-2">
              <ShieldCheck className="size-5" />
              <DialogTitle>
                {hasCurrentAdmin ? t("titleChange") : t("titleAssign")}
              </DialogTitle>
            </div>
            <DialogDescription className="pt-1 text-xs">
              {t("description")} ({organizationName})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {errorMsg ? (
              <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-xs">
                {errorMsg}
              </div>
            ) : null}

            <Tabs
              value={mode}
              onValueChange={(val) => setMode(val as "select" | "invite")}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="select" className="gap-2 text-xs">
                  <Users className="size-3.5" />
                  {t("modeSelect")}
                </TabsTrigger>
                <TabsTrigger value="invite" className="gap-2 text-xs">
                  <UserPlus className="size-3.5" />
                  {t("modeInvite")}
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {mode === "select" ? (
              <div className="space-y-1.5 pt-2">
                <Label htmlFor="user-select">
                  {t("selectUserLabel")} <span className="text-destructive">*</span>
                </Label>
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger id="user-select">
                    <SelectValue placeholder={t("selectUserPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {orgUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} ({u.email}) — {u.role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-3 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="admin-name">
                    {t("nameLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="admin-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-email">
                    {t("emailLabel")} <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("emailPlaceholder")}
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="assign-reason">{t("reasonLabel")}</Label>
              <Textarea
                id="assign-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("reasonPlaceholder")}
                rows={2}
              />
            </div>

            <div className="border-primary/20 bg-primary/5 text-muted-foreground space-y-1.5 rounded-lg border p-3 text-xs">
              <p className="text-foreground font-medium">{t("confirmationText")}</p>
              <p className="italic">{t("auditNotice")}</p>
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
              disabled={
                isSubmitting ||
                (mode === "select" && !selectedUserId) ||
                (mode === "invite" && (!name.trim() || !email.trim()))
              }
            >
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
