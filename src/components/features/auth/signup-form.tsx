"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Copy, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { LoadingButton } from "@/components/common/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSectorOptions } from "@/hooks/use-sector-options";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";

interface PendingConfirmation {
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
}

/**
 * Shown once, right after a successful signup. Two variants: if the
 * backend's mailer is configured, it already emailed the temporary
 * password — this just confirms that. Otherwise (mailer not configured,
 * or the send failed — dev/test only, see the backend's
 * `AuthService.signup()`) the password is revealed here instead, since
 * the admin needs it to log in and there's nowhere else to get it.
 */
function SignupConfirmation({
  temporaryPasswordEmailed,
  temporaryPassword,
  onGoToSignIn,
}: {
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
  onGoToSignIn: () => void;
}) {
  const t = useTranslations("auth.signup");
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!temporaryPassword) return;
    await navigator.clipboard.writeText(temporaryPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">
          {t("temporaryPasswordTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {temporaryPasswordEmailed
            ? t("temporaryPasswordEmailedDescription")
            : t("temporaryPasswordDescription")}
        </p>
      </div>

      {temporaryPasswordEmailed ? (
        <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-4">
          <MailCheck className="text-muted-foreground size-5 shrink-0" />
          <p className="text-foreground text-sm">{t("temporaryPasswordEmailedNotice")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="temporaryPassword">{t("temporaryPasswordLabel")}</Label>
          <div className="flex gap-2">
            <Input
              id="temporaryPassword"
              readOnly
              value={temporaryPassword}
              className="font-mono"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="shrink-0"
              aria-label={t("copyButton")}
              onClick={handleCopy}
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </Button>
          </div>
        </div>
      )}

      <Button
        type="button"
        className="mt-6 h-11 w-full gap-2 px-6 text-base"
        onClick={onGoToSignIn}
      >
        {t("goToSignInButton")}
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tValidation = useTranslations("auth.validation");
  // "Other" is the one fixed label left — every other option is a live
  // Methodology Configuration domain name, displayed as-is (see
  // useSectorOptions).
  const tSectors = useTranslations("app.settings.organization.sectors");
  // Reused rather than duplicated — Settings > Organization already has the
  // exact Region/Governorate/Center picker copy this form needs.
  const tGeo = useTranslations("app.settings.organization");
  const sectorOptions = useSectorOptions(false);
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [governorates, setGovernorates] = useState<Governorate[]>([]);
  const [centers, setCenters] = useState<Center[]>([]);

  const signupSchema = z.object({
    organizationName: z
      .string()
      .min(1, { message: tValidation("organizationNameRequired") }),
    sector: z.string().min(1, { message: tValidation("sectorRequired") }),
    otherSector: z.string(),
    registrationNumber: z
      .string()
      .min(1, { message: tValidation("registrationNumberRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    regionId: z.string().min(1, { message: tValidation("regionRequired") }),
    governorateIds: z
      .array(z.string())
      .min(1, { message: tValidation("governorateIdsRequired") }),
    centerIds: z.array(z.string()).min(1, { message: tValidation("centerIdsRequired") }),
  });

  type SignupValues = z.infer<typeof signupSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      sector: "",
      otherSector: "",
      regionId: "",
      governorateIds: [],
      centerIds: [],
    },
  });

  const selectedSector = useWatch({ control, name: "sector" });
  const regionId = useWatch({ control, name: "regionId" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });

  useEffect(() => {
    geographyService
      .listRegions()
      .then(setRegions)
      .catch(() => setRegions([]));
  }, []);

  // Governorate options are scoped to the single selected Region — there's
  // no org yet to further scope against (this creates the org), unlike
  // Settings > Organization's own cascade. A previously-selected Governorate
  // no longer applies once the Region changes, so it's pruned once the new
  // option list lands.
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
          { shouldValidate: false },
        );
      })
      .catch(() => setGovernorates([]));
    // governorateIds is read fresh via closure, not tracked as a dependency —
    // this effect should only re-run when the Region selection itself
    // changes, not on every Governorate toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regionId]);

  // Center options are scoped to the union of all selected Governorates —
  // same prune-stale-selection pattern as above.
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
          { shouldValidate: false },
        );
      })
      .catch(() => setCenters([]));
    // centerIds is read fresh via closure, not tracked as a dependency —
    // this effect should only re-run when the Governorate selection itself
    // changes, not on every Center toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [governorateIds]);

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    try {
      const { temporaryPasswordEmailed, temporaryPassword } = await authService.signup({
        organizationName: values.organizationName,
        sector: values.sector,
        purpose: values.sector === "other" ? values.otherSector : undefined,
        registrationNumber: values.registrationNumber,
        email: values.email,
        regionId: values.regionId,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
      });
      // Signup doesn't sign the admin in automatically — they confirm
      // either how they got their password (emailed) or the password
      // itself (fallback), then sign in explicitly with it, same as any
      // returning user would.
      setPendingConfirmation({ temporaryPasswordEmailed, temporaryPassword });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (pendingConfirmation) {
    return (
      <SignupConfirmation
        temporaryPasswordEmailed={pendingConfirmation.temporaryPasswordEmailed}
        temporaryPassword={pendingConfirmation.temporaryPassword}
        onGoToSignIn={() => router.push("/")}
      />
    );
  }

  return (
    <div className="w-full max-w-lg">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="organizationName">{t("organizationNameLabel")}</Label>
          <Input
            id="organizationName"
            placeholder={t("organizationNamePlaceholder")}
            {...register("organizationName")}
          />
          {errors.organizationName ? (
            <p className="text-destructive text-sm">{errors.organizationName.message}</p>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="registrationNumber">{t("registrationNumberLabel")}</Label>
            <Input
              id="registrationNumber"
              placeholder={t("registrationNumberPlaceholder")}
              {...register("registrationNumber")}
            />
            {errors.registrationNumber ? (
              <p className="text-destructive text-sm">
                {errors.registrationNumber.message}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor="sector">{t("sectorLabel")}</Label>
            <Select
              value={selectedSector}
              onValueChange={(value) =>
                setValue("sector", value, { shouldValidate: true })
              }
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
            {errors.sector ? (
              <p className="text-destructive text-sm">{errors.sector.message}</p>
            ) : null}
          </div>
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

        {/* Stacked full-width, not a side-by-side grid — Governorate/Center
            chip lists can wrap to several rows once many are selected. */}
        <div className="space-y-2">
          <Label htmlFor="region">{tGeo("administrativeRegionLabel")}</Label>
          <Combobox
            aria-label={tGeo("administrativeRegionLabel")}
            items={regions.map((r) => ({ value: r.id, label: r.name }))}
            value={regionId || null}
            onSelect={(value) => setValue("regionId", value, { shouldValidate: true })}
            placeholder={tGeo("administrativeRegionPlaceholder")}
            searchPlaceholder={tGeo("administrativeRegionSearchPlaceholder")}
            emptyText={tGeo("administrativeRegionEmpty")}
          />
          {errors.regionId ? (
            <p className="text-destructive text-sm">{errors.regionId.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{tGeo("governorateLabel")}</Label>
          <MultiSelect
            options={governorates.map((g) => ({ value: g.id, label: g.name }))}
            values={governorateIds}
            onChange={(next) =>
              setValue("governorateIds", next, { shouldValidate: true })
            }
            placeholder={
              regionId ? tGeo("governoratePlaceholder") : tGeo("selectRegionFirst")
            }
            searchPlaceholder={tGeo("governorateSearchPlaceholder")}
            emptyText={tGeo("governorateEmpty")}
            removeAriaLabel={(governorate) =>
              tGeo("removeGovernorateSelection", { governorate })
            }
            disabled={!regionId}
          />
          {errors.governorateIds ? (
            <p className="text-destructive text-sm">{errors.governorateIds.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label>{tGeo("centerLabel")}</Label>
          <MultiSelect
            options={centers.map((c) => ({ value: c.id, label: c.name }))}
            values={centerIds}
            onChange={(next) => setValue("centerIds", next, { shouldValidate: true })}
            placeholder={
              governorateIds.length > 0
                ? tGeo("centerPlaceholder")
                : tGeo("selectGovernorateFirst")
            }
            searchPlaceholder={tGeo("centerSearchPlaceholder")}
            emptyText={tGeo("centerEmpty")}
            removeAriaLabel={(center) => tGeo("removeCenterSelection", { center })}
            disabled={governorateIds.length === 0}
          />
          {errors.centerIds ? (
            <p className="text-destructive text-sm">{errors.centerIds.message}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-destructive text-sm">{errors.email.message}</p>
          ) : null}
        </div>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <LoadingButton
          type="submit"
          className="h-11 w-full gap-2 px-6"
          isLoading={isSubmitting}
          text={isSubmitting ? t("submitting") : t("submit")}
          endIcon={<ArrowRight className="size-4" />}
        />
      </form>

      <p className="text-muted-foreground mt-8 text-center text-sm">
        {t("haveAccount")}{" "}
        <Link
          href="/"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
