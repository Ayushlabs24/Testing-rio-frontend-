"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Users,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { PageContainer } from "@/components/common/page-container";
import { PageHeader } from "@/components/common/page-header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { OrganizationConsentCard } from "@/components/features/settings/organization-consent-card";
import { useSectorOptions } from "@/hooks/use-sector-options";
import { usePermission } from "@/hooks/use-permission";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";
import { organizationsService } from "@/services/organizations/organizations.service";
import { usersService } from "@/services/users/users.service";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone?: "primary" | "secondary" | "muted";
}

function StatCard({ icon, label, value, tone = "muted" }: StatCardProps) {
  const toneStyles = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary text-secondary-foreground",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${toneStyles[tone]}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </p>
          <div className="text-foreground truncate text-lg font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function SkeletonStat() {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <Skeleton className="size-10 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-5 w-12" />
        </div>
      </CardContent>
    </Card>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-muted-foreground text-xs font-medium">{label}</p>
        <div className="text-foreground mt-0.5 text-sm">{value}</div>
      </div>
    </div>
  );
}

export default function OrganizationSettingsPage() {
  const t = useTranslations("app.settings.organization");
  const tSectors = useTranslations("app.settings.organization.sectors");
  const sectorOptions = useSectorOptions();
  const locale = useLocale();
  const { session, setSession } = useAuth();
  const canWrite = usePermission("entityTeam", "write");
  const [editing, setEditing] = useState(false);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  // Re-fetched whenever the selected Region changes — Governorate options
  // are scoped to that single Region, never the full 150-row list.
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  // Re-fetched whenever the selected Governorates change — Center options
  // are scoped to the union of all selected Governorates, never the full
  // 1404-row list.
  const [centers, setCenters] = useState<Center[]>([]);

  useEffect(() => {
    usersService.listByOrganization().then((users) => setMemberCount(users.length));
  }, []);

  useEffect(() => {
    geographyService
      .listRegions()
      .then(setRegions)
      .catch(() => undefined);
  }, []);

  // The session's `organization` snapshot is only as fresh as the last
  // login/signup/me call — this page is the org's actual profile screen,
  // so it should show what GET /organizations/current returns right now,
  // not a stale cached copy (e.g. from before another admin's edit).
  useEffect(() => {
    if (!session) return;
    organizationsService.getCurrent().then((current) => {
      setSession({ ...session, organization: { ...session.organization, ...current } });
    });
    // Runs once on mount only — `session` is read from closure at that
    // point (already populated, since AuthGuard guarantees one exists
    // before this page ever renders).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schema = z.object({
    name: z.string().min(1),
    regionId: z.string().nullable(),
    governorateIds: z.array(z.string()),
    centerIds: z.array(z.string()),
    email: z.string().email().or(z.literal("")),
    sector: z.string().nullable(),
    otherSector: z.string(),
    isActive: z.boolean(),
  });
  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      name: session?.organization.name ?? "",
      regionId: session?.organization.regionId ?? null,
      governorateIds: session?.organization.governorateIds ?? [],
      centerIds: session?.organization.centerIds ?? [],
      email: session?.organization.email ?? "",
      sector: session?.organization.sector ?? null,
      otherSector:
        session?.organization.sector === "other" ? session.organization.purpose : "",
      isActive: session?.organization.isActive ?? true,
    },
  });

  const regionId = useWatch({ control, name: "regionId" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });
  const isActive = useWatch({ control, name: "isActive" });
  const selectedSector = useWatch({ control, name: "sector" });

  // Governorate options are scoped to the single currently-selected Region —
  // re-fetched whenever it changes, both while editing and to resolve the
  // read-only display names. A previously-selected Governorate no longer
  // applies once the Region changes, so it's pruned from the current
  // selection once the new option list lands.
  useEffect(() => {
    const load = regionId
      ? geographyService.listGovernorates(regionId)
      : Promise.resolve([]);
    load
      .then((options) => {
        setGovernorates(options);
        const validIds = new Set(options.map((g) => g.id));
        setValue(
          "governorateIds",
          governorateIds.filter((id) => validIds.has(id)),
          { shouldValidate: true },
        );
      })
      .catch(() => setGovernorates([]));
    // governorateIds is read fresh via closure below, not tracked as a
    // dependency — this effect should only re-run when the Region
    // selection itself changes, not on every Governorate toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  // Center options are scoped to the union of all currently-selected
  // Governorates — re-fetched whenever that set changes, same
  // prune-stale-selection pattern as Governorate above.
  useEffect(() => {
    const load =
      governorateIds.length === 0
        ? Promise.resolve([])
        : Promise.all(governorateIds.map((id) => geographyService.listCenters(id))).then(
            (lists) => lists.flat(),
          );
    load
      .then((options) => {
        setCenters(options);
        const validIds = new Set(options.map((c) => c.id));
        setValue(
          "centerIds",
          centerIds.filter((id) => validIds.has(id)),
          { shouldValidate: true },
        );
      })
      .catch(() => setCenters([]));
    // centerIds is read fresh via closure below, not tracked as a
    // dependency — this effect should only re-run when the Governorate
    // selection itself changes, not on every Center toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorateIds]);

  const onSubmit = async (values: Values) => {
    const updated = await organizationsService.update({
      name: values.name,
      regionId: values.regionId,
      governorateIds: values.governorateIds,
      centerIds: values.centerIds,
      email: values.email,
      sector: values.sector ?? null,
      purpose: values.sector === "other" ? values.otherSector : null,
      isActive: values.isActive,
    });
    if (session) {
      setSession({ ...session, organization: { ...session.organization, ...updated } });
    }
    setEditing(false);
  };

  const onLogoSelected = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const logoUrl = reader.result as string;
      const updated = await organizationsService.update({ logoUrl });
      if (session) {
        setSession({ ...session, organization: { ...session.organization, ...updated } });
      }
    };
    reader.readAsDataURL(file);
  };

  if (!session) return null;

  const organization = session.organization;
  const formattedCreatedAt = new Date(organization.createdAt).toLocaleDateString(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const sectorDisplay =
    organization.sector === "other"
      ? organization.purpose || tSectors("other")
      : (organization.sector ?? "—");
  const logoInitial = organization.name.charAt(0).toUpperCase();

  return (
    <PermissionGuard module="entityTeam" action="read" entityOnly>
      <PageContainer>
        <PageHeader
          title={t("title")}
          description={t("description")}
          actions={
            canWrite && !editing ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
                {t("edit")}
              </Button>
            ) : null
          }
        />

        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="overflow-hidden">
            <div className="bg-gradient-hero -mx-(--card-spacing) -mt-(--card-spacing) h-28" />
            <CardContent className="relative">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
                <div className="relative -mt-14 shrink-0">
                  <Avatar className="ring-background size-24 ring-4 sm:size-28">
                    <AvatarImage
                      src={organization.logoUrl ?? undefined}
                      alt={organization.name}
                      className="rounded-full object-cover"
                    />
                    <AvatarFallback className="text-3xl sm:text-4xl">
                      {logoInitial}
                    </AvatarFallback>
                  </Avatar>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 flex size-8 cursor-pointer items-center justify-center rounded-full ring-2 transition-opacity hover:opacity-90"
                      aria-label={t("uploadLogo")}
                    >
                      <Pencil className="size-3.5" />
                    </button>
                  ) : null}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) onLogoSelected(file);
                      event.target.value = "";
                    }}
                  />
                </div>

                <div className="flex flex-1 flex-col gap-4 pt-1">
                  {editing ? (
                    <div className="max-w-sm space-y-2">
                      <Label htmlFor="name">{t("nameLabel")}</Label>
                      <Input id="name" {...register("name")} />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <h2 className="text-foreground text-2xl font-semibold tracking-tight sm:text-3xl">
                        {organization.name}
                      </h2>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">{session.role.name}</Badge>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {memberCount === null ? (
              <>
                <SkeletonStat />
                <SkeletonStat />
                <SkeletonStat />
              </>
            ) : (
              <>
                <StatCard
                  tone="primary"
                  icon={<Users className="size-5" />}
                  label={t("membersLabel")}
                  value={memberCount}
                />
                <StatCard
                  tone="primary"
                  icon={<CalendarDays className="size-5" />}
                  label={t("createdLabel")}
                  value={formattedCreatedAt}
                />
                <StatCard
                  tone="primary"
                  icon={<Layers className="size-5" />}
                  label={t("sectorLabel")}
                  value={sectorDisplay}
                />
              </>
            )}
          </div>

          <OrganizationConsentCard />

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>{t("detailsTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <div className="space-y-5">
                  {/* Bounded so a tall edit form scrolls within itself —
                      the page header/stat cards above and the Save/Cancel
                      row below stay put instead of scrolling along with it. */}
                  <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1">
                    <div className="space-y-2">
                      <Label htmlFor="email">{t("emailLabel")}</Label>
                      <Input id="email" type="email" {...register("email")} />
                    </div>

                    {/* Stacked full-width, not a side-by-side grid — Governorate's
                        chip list can wrap to several rows once many are
                        selected, which would otherwise leave Region's
                        single-line field misaligned next to a much taller
                        column. */}
                    <div className="space-y-2">
                      <Label htmlFor="administrativeRegion">
                        {t("administrativeRegionLabel")}
                      </Label>
                      <Combobox
                        aria-label={t("administrativeRegionLabel")}
                        items={regions.map((r) => ({ value: r.id, label: r.name }))}
                        value={regionId}
                        onSelect={(value) =>
                          setValue("regionId", value, { shouldValidate: true })
                        }
                        placeholder={t("administrativeRegionPlaceholder")}
                        searchPlaceholder={t("administrativeRegionSearchPlaceholder")}
                        emptyText={t("administrativeRegionEmpty")}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("governorateLabel")}</Label>
                      <MultiSelect
                        options={governorates.map((g) => ({
                          value: g.id,
                          label: g.name,
                        }))}
                        values={governorateIds}
                        onChange={(next) =>
                          setValue("governorateIds", next, { shouldValidate: true })
                        }
                        placeholder={
                          regionId ? t("governoratePlaceholder") : t("selectRegionFirst")
                        }
                        searchPlaceholder={t("governorateSearchPlaceholder")}
                        emptyText={t("governorateEmpty")}
                        removeAriaLabel={(governorate) =>
                          t("removeGovernorateSelection", { governorate })
                        }
                        disabled={!regionId}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>{t("centerLabel")}</Label>
                      <MultiSelect
                        options={centers.map((c) => ({ value: c.id, label: c.name }))}
                        values={centerIds}
                        onChange={(next) =>
                          setValue("centerIds", next, { shouldValidate: true })
                        }
                        placeholder={
                          governorateIds.length > 0
                            ? t("centerPlaceholder")
                            : t("selectGovernorateFirst")
                        }
                        searchPlaceholder={t("centerSearchPlaceholder")}
                        emptyText={t("centerEmpty")}
                        removeAriaLabel={(center) =>
                          t("removeCenterSelection", { center })
                        }
                        disabled={governorateIds.length === 0}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sector">{t("sectorLabel")}</Label>
                      <Select
                        value={selectedSector ?? ""}
                        onValueChange={(value) => setValue("sector", value)}
                      >
                        <SelectTrigger id="sector" className="w-full">
                          <SelectValue placeholder={t("sectorPlaceholder")} />
                        </SelectTrigger>
                        <SelectContent>
                          {sectorOptions.map((sector) => (
                            <SelectItem key={sector} value={sector}>
                              {sector}
                            </SelectItem>
                          ))}
                          <SelectItem value="other">{tSectors("other")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {selectedSector === "other" ? (
                      <div className="space-y-2">
                        <Label htmlFor="otherSector">{t("otherSectorLabel")}</Label>
                        <Input
                          id="otherSector"
                          placeholder={t("otherSectorPlaceholder")}
                          {...register("otherSector")}
                        />
                      </div>
                    ) : null}

                    <div className="border-border flex items-center justify-between rounded-md border p-3">
                      <p className="text-foreground text-sm font-medium">
                        {t("statusLabel")}
                      </p>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(checked) => setValue("isActive", checked)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <LoadingButton
                      type="submit"
                      className="gap-2"
                      isLoading={isSubmitting}
                      text={t("save")}
                      startIcon={<Check className="size-4" />}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        reset();
                        setEditing(false);
                      }}
                    >
                      <X className="size-4" />
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="divide-border divide-y">
                  <DetailRow
                    icon={<MapPin className="size-4" />}
                    label={t("administrativeRegionLabel")}
                    value={
                      organization.regionId
                        ? (regions.find((r) => r.id === organization.regionId)?.name ??
                          organization.regionId)
                        : "—"
                    }
                  />
                  <DetailRow
                    icon={<MapPin className="size-4" />}
                    label={t("governorateLabel")}
                    value={
                      organization.governorateIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {organization.governorateIds.map((id) => (
                            <Badge key={id} variant="secondary">
                              {governorates.find((g) => g.id === id)?.name ?? id}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailRow
                    icon={<MapPin className="size-4" />}
                    label={t("centerLabel")}
                    value={
                      organization.centerIds.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {organization.centerIds.map((id) => (
                            <Badge key={id} variant="secondary">
                              {centers.find((c) => c.id === id)?.name ?? id}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )
                    }
                  />
                  <DetailRow
                    icon={<Mail className="size-4" />}
                    label={t("emailLabel")}
                    value={organization.email || "—"}
                  />
                  <DetailRow
                    icon={
                      <span
                        className={`inline-block size-2.5 rounded-full ${
                          organization.isActive ? "bg-success" : "bg-muted-foreground"
                        }`}
                      />
                    }
                    label={t("statusLabel")}
                    value={t(organization.isActive ? "statusActive" : "statusInactive")}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </form>
      </PageContainer>
    </PermissionGuard>
  );
}
