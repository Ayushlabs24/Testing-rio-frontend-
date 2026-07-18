"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  Layers,
  Mail,
  MapPin,
  Pencil,
  Trees,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { PermissionGuard } from "@/components/layout/permission-guard";
import { OrganizationConsentCard } from "@/components/features/settings/organization-consent-card";
import { useSectorOptions } from "@/hooks/use-sector-options";
import { usePermission } from "@/hooks/use-permission";
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
        <div className="bg-muted size-10 shrink-0 rounded-lg" />
        <div className="space-y-2">
          <div className="bg-muted h-3 w-20 rounded" />
          <div className="bg-muted h-5 w-12 rounded" />
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

/** Splits on commas so pasting/typing "Region A, Region B" (or the same for
 * villages) adds separate chips, not one literal comma-joined string. */
function parseChipInput(raw: string): string[] {
  return raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function ChipListEditor({
  values,
  onChange,
  placeholder,
  addLabel,
  removeAriaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  addLabel: string;
  removeAriaLabel: (value: string) => string;
}) {
  const [draft, setDraft] = useState("");

  const commitDraft = () => {
    const additions = parseChipInput(draft).filter((v) => !values.includes(v));
    if (additions.length > 0) onChange([...values, ...additions]);
    setDraft("");
  };

  return (
    <div className="space-y-2">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {value}
              <button
                type="button"
                onClick={() => onChange(values.filter((v) => v !== value))}
                aria-label={removeAriaLabel(value)}
              >
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            if (value.endsWith(",")) {
              const additions = parseChipInput(value).filter((v) => !values.includes(v));
              if (additions.length > 0) onChange([...values, ...additions]);
              setDraft("");
            } else {
              setDraft(value);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitDraft();
            }
          }}
          onBlur={commitDraft}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={commitDraft}>
          {addLabel}
        </Button>
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

  useEffect(() => {
    usersService.listByOrganization().then((users) => setMemberCount(users.length));
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
    region: z.array(z.string()),
    email: z.string().email().or(z.literal("")),
    sector: z.string().nullable(),
    otherSector: z.string(),
    villages: z.array(z.string()),
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
      region: session?.organization.region ?? [],
      email: session?.organization.email ?? "",
      sector: session?.organization.sector ?? null,
      otherSector:
        session?.organization.sector === "other" ? session.organization.purpose : "",
      villages: session?.organization.villages ?? [],
      isActive: session?.organization.isActive ?? true,
    },
  });

  const region = useWatch({ control, name: "region" });
  const villages = useWatch({ control, name: "villages" });
  const isActive = useWatch({ control, name: "isActive" });
  const selectedSector = useWatch({ control, name: "sector" });

  const onSubmit = async (values: Values) => {
    const updated = await organizationsService.update({
      name: values.name,
      region: values.region,
      email: values.email,
      sector: values.sector ?? null,
      purpose: values.sector === "other" ? values.otherSector : null,
      villages: values.villages,
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
                      className="bg-primary text-primary-foreground ring-background absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full ring-2 transition-opacity hover:opacity-90"
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
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("emailLabel")}</Label>
                    <Input id="email" type="email" {...register("email")} />
                  </div>

                  <div className="space-y-2">
                    <Label>{t("regionLabel")}</Label>
                    <ChipListEditor
                      values={region ?? []}
                      onChange={(next) =>
                        setValue("region", next, { shouldValidate: true })
                      }
                      placeholder={t("regionsPlaceholder")}
                      addLabel={t("addVillage")}
                      removeAriaLabel={(value) => t("removeRegion", { region: value })}
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

                  <div className="space-y-2">
                    <Label>{t("villagesLabel")}</Label>
                    <ChipListEditor
                      values={villages ?? []}
                      onChange={(next) =>
                        setValue("villages", next, { shouldValidate: true })
                      }
                      placeholder={t("villagesPlaceholder")}
                      addLabel={t("addVillage")}
                      removeAriaLabel={(value) => t("removeVillage", { village: value })}
                    />
                  </div>

                  <div className="border-border flex items-center justify-between rounded-md border p-3">
                    <p className="text-foreground text-sm font-medium">
                      {t("statusLabel")}
                    </p>
                    <Switch
                      checked={isActive}
                      onCheckedChange={(checked) => setValue("isActive", checked)}
                    />
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
                    label={t("regionLabel")}
                    value={
                      organization.region.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {organization.region.map((region) => (
                            <Badge key={region} variant="secondary">
                              {region}
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
                    icon={<Trees className="size-4" />}
                    label={t("villagesLabel")}
                    value={
                      organization.villages.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {organization.villages.map((village) => (
                            <Badge key={village} variant="secondary">
                              {village}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )
                    }
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
