"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, Eye, Plus, Users2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { SystemAdminGuard } from "@/components/layout/system-admin-guard";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SECTORS } from "@/config/sectors";
import { organizationsService } from "@/services/organizations/organizations.service";
import type { OrganizationSummary } from "@/services/organizations/organizations.types";
import { usersService } from "@/services/users/users.service";
import type { OrgUser } from "@/services/users/users.types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CreateOrganizationDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (organization: OrganizationSummary) => void;
}) {
  const t = useTranslations("app.settings.organizations");
  const tSectors = useTranslations("app.settings.organization.sectors");
  const tValidation = useTranslations("auth.validation");
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    region: z.string().min(1, { message: t("regionRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    sector: z.enum(SECTORS),
    adminName: z.string().min(1, { message: tValidation("nameRequired") }),
    adminEmail: z.string().email({ message: tValidation("emailInvalid") }),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", region: "", email: "", adminName: "", adminEmail: "" },
  });
  const sector = useWatch({ control, name: "sector" });

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      const organization = await organizationsService.createWithAdmin({
        name: values.name,
        region: values.region,
        email: values.email,
        sector: values.sector,
        villages: [],
        adminName: values.adminName,
        adminEmail: values.adminEmail,
      });
      onCreated(organization);
      reset();
      onOpenChange(false);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("genericError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("createTitle")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("nameLabel")}</Label>
            <Input id="name" {...register("name")} />
            {errors.name ? (
              <p className="text-destructive text-sm">{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="region">{t("regionLabel")}</Label>
              <Input id="region" {...register("region")} />
              {errors.region ? (
                <p className="text-destructive text-sm">{errors.region.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="sector">{t("sectorLabel")}</Label>
              <Select
                value={sector || undefined}
                onValueChange={(v) => setValue("sector", v as Values["sector"])}
              >
                <SelectTrigger id="sector" className="w-full">
                  <SelectValue placeholder={t("sectorPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((value) => (
                    <SelectItem key={value} value={value}>
                      {tSectors(value)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.sector ? (
                <p className="text-destructive text-sm">{t("sectorRequired")}</p>
              ) : null}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t("emailLabel")}</Label>
            <Input id="email" type="email" {...register("email")} />
            {errors.email ? (
              <p className="text-destructive text-sm">{errors.email.message}</p>
            ) : null}
          </div>

          <Separator />
          <p className="text-muted-foreground text-xs font-medium">
            {t("firstAdminHeading")}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="adminName">{t("adminNameLabel")}</Label>
              <Input id="adminName" {...register("adminName")} />
              {errors.adminName ? (
                <p className="text-destructive text-sm">{errors.adminName.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="adminEmail">{t("adminEmailLabel")}</Label>
              <Input id="adminEmail" type="email" {...register("adminEmail")} />
              {errors.adminEmail ? (
                <p className="text-destructive text-sm">{errors.adminEmail.message}</p>
              ) : null}
            </div>
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OrganizationDetailSheet({
  organizationId,
  open,
  onOpenChange,
  onUpdated,
}: {
  organizationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (organization: OrganizationSummary) => void;
}) {
  const t = useTranslations("app.settings.organizations");
  const tOrg = useTranslations("app.settings.organization");
  const tSectors = useTranslations("app.settings.organization.sectors");
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
  const [members, setMembers] = useState<OrgUser[] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z.object({
    name: z.string().min(1),
    region: z.string().min(1),
    email: z.string().email(),
    sector: z.enum(SECTORS),
    isActive: z.boolean(),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });
  const sector = useWatch({ control, name: "sector" });
  const isActive = useWatch({ control, name: "isActive" });

  useEffect(() => {
    if (!organizationId || !open) return;
    organizationsService.getById(organizationId).then((org) => {
      setOrganization(org);
      reset({
        name: org.name,
        region: org.region,
        email: org.email,
        sector: org.sector ?? undefined,
        isActive: org.isActive,
      });
    });
    usersService.listByOrganizationId(organizationId).then(setMembers);
  }, [organizationId, open, reset]);

  const onSubmit = async (values: Values) => {
    if (!organizationId) return;
    setFormError(null);
    try {
      const updated = await organizationsService.updateById(organizationId, values);
      setOrganization(updated);
      onUpdated(updated);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : t("genericError"));
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-2xl">
        {organization ? (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <Avatar className="size-11">
                  <AvatarFallback className="text-sm font-medium">
                    {initials(organization.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <SheetTitle>{organization.name}</SheetTitle>
                  <SheetDescription>
                    {t("membersCount", { count: organization.memberCount })}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex-1 space-y-6 overflow-y-auto px-4 pb-4">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="detailName">{t("nameLabel")}</Label>
                  <Input id="detailName" {...register("name")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="detailRegion">{t("regionLabel")}</Label>
                    <Input id="detailRegion" {...register("region")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="detailSector">{t("sectorLabel")}</Label>
                    <Select
                      value={sector || undefined}
                      onValueChange={(v) => setValue("sector", v as Values["sector"])}
                    >
                      <SelectTrigger id="detailSector" className="w-full">
                        <SelectValue placeholder={t("sectorPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map((value) => (
                          <SelectItem key={value} value={value}>
                            {tSectors(value)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="detailEmail">{t("emailLabel")}</Label>
                  <Input id="detailEmail" type="email" {...register("email")} />
                </div>
                <div className="border-border flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-foreground text-sm font-medium">
                      {tOrg("statusLabel")}
                    </p>
                    <p className="text-muted-foreground text-xs">{tOrg("statusHint")}</p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(checked) => setValue("isActive", checked)}
                  />
                </div>

                {errors.name || errors.region || errors.email || errors.sector ? (
                  <p className="text-destructive text-sm">{t("formInvalid")}</p>
                ) : null}
                {formError ? (
                  <p className="text-destructive text-sm">{formError}</p>
                ) : null}

                <Button type="submit" disabled={isSubmitting} className="w-full">
                  {isSubmitting ? tOrg("saving") : tOrg("save")}
                </Button>
              </form>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-foreground text-sm font-medium">
                    {t("membersHeading")}
                  </p>
                  <Button variant="outline" size="sm" className="gap-1.5" asChild>
                    <Link href="/settings/users">
                      <Users2 className="size-3.5" />
                      {t("manageInUsers")}
                    </Link>
                  </Button>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("nameColumn")}</TableHead>
                      <TableHead>{t("membersRoleColumn")}</TableHead>
                      <TableHead>{t("statusColumn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members === null || members.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-muted-foreground py-6 text-center text-sm"
                        >
                          {members === null ? "…" : t("noMembers")}
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member) => (
                        <TableRow key={member.id}>
                          <TableCell>
                            <p className="text-foreground text-sm font-medium">
                              {member.name}
                            </p>
                            <p className="text-muted-foreground text-xs">
                              {member.email}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{member.role.name}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {member.status}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default function OrganizationsSettingsPage() {
  const t = useTranslations("app.settings.organizations");
  const tSectors = useTranslations("app.settings.organization.sectors");
  const [organizations, setOrganizations] = useState<OrganizationSummary[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    organizationsService.listAll().then(setOrganizations);
  }, []);

  const openDetail = (id: string) => {
    setDetailId(id);
    setDetailOpen(true);
  };

  const applyUpdate = (updated: OrganizationSummary) => {
    setOrganizations((prev) =>
      (prev ?? []).map((org) => (org.id === updated.id ? updated : org)),
    );
  };

  return (
    <SystemAdminGuard>
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            <Button className="gap-2" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" />
              {t("newOrganization")}
            </Button>
          }
        />

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("nameColumn")}</TableHead>
                  <TableHead>{t("regionColumn")}</TableHead>
                  <TableHead>{t("sectorColumn")}</TableHead>
                  <TableHead>{t("membersColumn")}</TableHead>
                  <TableHead>{t("statusColumn")}</TableHead>
                  <TableHead className="w-16" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {organizations === null ? (
                  Array.from({ length: 2 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={6}>
                        <div className="bg-muted h-5 w-full rounded" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : organizations.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground h-32 text-center"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <div className="bg-muted flex size-10 items-center justify-center rounded-full">
                          <Building2 className="size-5" />
                        </div>
                        <p>{t("noResults")}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  organizations.map((organization) => (
                    <TableRow
                      key={organization.id}
                      className="hover:bg-muted/50 cursor-pointer"
                      onClick={() => openDetail(organization.id)}
                    >
                      <TableCell className="text-foreground font-medium">
                        {organization.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.region}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.sector ? tSectors(organization.sector) : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {organization.memberCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={organization.isActive ? "default" : "outline"}
                          className={
                            organization.isActive
                              ? "bg-success/10 text-success hover:bg-success/20 border-success/20"
                              : undefined
                          }
                        >
                          {t(organization.isActive ? "statusActive" : "statusInactive")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={t("viewOrganization")}
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(organization.id);
                          }}
                        >
                          <Eye className="size-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <CreateOrganizationDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(organization) =>
            setOrganizations((prev) => [...(prev ?? []), organization])
          }
        />

        <OrganizationDetailSheet
          organizationId={detailId}
          open={detailOpen}
          onOpenChange={setDetailOpen}
          onUpdated={applyUpdate}
        />
      </PageContainer>
    </SystemAdminGuard>
  );
}
