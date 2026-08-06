"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { consentService } from "@/services/consent/consent.service";
import type { ActiveConsentPolicies } from "@/services/consent/consent.types";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";

interface PendingConfirmation {
  temporaryPasswordEmailed: boolean;
}

/**
 * Shown once, right after a successful signup. Deliberately never renders
 * the temporary password itself — only whether it was emailed. See the
 * backend's `AuthService.signup()` for why: while the email provider's
 * trial-plan restriction is in place, every signup's temporary password is
 * a fixed, known value rather than a per-account secret, so displaying it
 * on screen would be both pointless and a bad habit to leave in place once
 * that restriction is lifted and passwords go back to being random again.
 */
function SignupConfirmation({
  temporaryPasswordEmailed,
  onGoToSignIn,
}: {
  temporaryPasswordEmailed: boolean;
  onGoToSignIn: () => void;
}) {
  const t = useTranslations("auth.signup");

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">
          {t("temporaryPasswordTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("temporaryPasswordEmailedDescription")}
        </p>
      </div>

      <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-4">
        <MailCheck className="text-muted-foreground size-5 shrink-0" />
        <p className="text-foreground text-sm">
          {temporaryPasswordEmailed
            ? t("temporaryPasswordEmailedNotice")
            : t("temporaryPasswordNotEmailedNotice")}
        </p>
      </div>

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

/**
 * Reading dialog for one consent policy. The Accept button unlocks only once
 * the reader reaches the bottom of the text, which is what makes "I have read
 * this" more than a claim.
 *
 * Scroll position is measured on the scroll container rather than tracked as
 * a percentage: `scrollTop + clientHeight >= scrollHeight - SCROLL_EPSILON`.
 * The epsilon absorbs sub-pixel rounding — browsers report fractional heights
 * at non-integer zoom levels, where an exact `>=` comparison can never be
 * satisfied and would trap the reader at 99.6%.
 */
const SCROLL_EPSILON = 4;

/**
 * The scrollable policy body and its confirm button.
 *
 * Deliberately a separate component rendered *inside* DialogContent, which
 * Radix unmounts on close: that makes "each open starts a fresh read" a
 * consequence of unmounting rather than something an effect has to reset,
 * so reopening an abandoned policy can never inherit a stale `reachedEnd`.
 */
function PolicyReader({
  title,
  policyText,
  scrollHint,
  confirmLabel,
  onConfirm,
}: {
  title: string;
  policyText: string;
  scrollHint: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  const [reachedEnd, setReachedEnd] = useState(false);

  const measure = useCallback((el: HTMLDivElement) => {
    // A policy short enough not to overflow is fully visible the moment it
    // renders — there is no scrolling to do, so requiring a scroll event
    // would leave the reader permanently stuck. Treat it as read.
    const isScrollable = el.scrollHeight > el.clientHeight + SCROLL_EPSILON;
    setReachedEnd(
      !isScrollable || el.scrollTop + el.clientHeight >= el.scrollHeight - SCROLL_EPSILON,
    );
  }, []);

  // Measured from the ref callback rather than an effect: the node is in the
  // DOM by the time this runs, and one frame's delay lets the dialog finish
  // laying out so scrollHeight/clientHeight report real values, not 0.
  const attachScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return;
      const frame = requestAnimationFrame(() => measure(el));
      return () => cancelAnimationFrame(frame);
    },
    [measure],
  );

  return (
    <>
      <div
        ref={attachScrollRef}
        onScroll={(event) => measure(event.currentTarget)}
        // Focusable so the policy can be scrolled by keyboard alone —
        // otherwise a keyboard-only user could never satisfy the
        // read-to-the-end gate.
        tabIndex={0}
        role="region"
        aria-label={title}
        className="border-border text-muted-foreground max-h-[45vh] min-h-24 overflow-y-auto rounded-md border p-4 text-sm leading-relaxed whitespace-pre-line"
      >
        {policyText}
      </div>

      <DialogFooter className="sm:justify-between sm:gap-4">
        <p
          className="text-muted-foreground text-xs"
          // Announced when it changes, so a screen-reader user learns the
          // confirm button has unlocked without hunting for it.
          aria-live="polite"
        >
          {reachedEnd ? "" : scrollHint}
        </p>
        <Button type="button" disabled={!reachedEnd} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogFooter>
    </>
  );
}

function PolicyDialog({
  open,
  onOpenChange,
  title,
  policyText,
  version,
  versionLabel,
  scrollHint,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  policyText: string;
  version: string;
  versionLabel: string;
  scrollHint: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {versionLabel} {version}
          </DialogDescription>
        </DialogHeader>

        <PolicyReader
          title={title}
          policyText={policyText}
          scrollHint={scrollHint}
          confirmLabel={confirmLabel}
          onConfirm={onConfirm}
        />
      </DialogContent>
    </Dialog>
  );
}

/**
 * One consent: a checkbox whose label opens the full policy in a dialog.
 *
 * The checkbox is disabled until the policy has been opened AND read to the
 * end — the registrant cannot tick a box for wording they never saw. Reading
 * only unlocks the checkbox; it never ticks it for them, so the acceptance
 * stays a deliberate act.
 *
 * `policyText` is undefined only while the policies are still loading, which
 * also keeps the label from opening an empty dialog.
 */
function ConsentCheckbox({
  id,
  checked,
  onCheckedChange,
  label,
  linkLabel,
  policyText,
  version,
  versionLabel,
  dialogTitle,
  scrollHint,
  confirmLabel,
  readHint,
  error,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
  linkLabel: string;
  policyText: string | undefined;
  version: string | undefined;
  versionLabel: string;
  dialogTitle: string;
  scrollHint: string;
  confirmLabel: string;
  readHint: string;
  error: string | undefined;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasRead, setHasRead] = useState(false);

  const canTick = hasRead && Boolean(policyText);

  return (
    <div className="space-y-1.5">
      <div className="flex items-start gap-3">
        <Checkbox
          id={id}
          checked={checked}
          disabled={!canTick}
          aria-invalid={Boolean(error)}
          // Explains the disabled state to assistive tech, which otherwise
          // reports only "unavailable" with no reason.
          aria-describedby={canTick ? undefined : `${id}-hint`}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5"
        />
        <Label
          htmlFor={id}
          className="text-muted-foreground text-xs leading-relaxed font-normal"
        >
          {label}{" "}
          {/* The policy opens from this button, not the whole label: clicking
              the label must still toggle the checkbox (that's what a label is
              for), so only this span is the dialog trigger. */}
          <button
            type="button"
            disabled={!policyText}
            onClick={() => setDialogOpen(true)}
            className="text-foreground font-medium underline underline-offset-4 hover:no-underline disabled:no-underline disabled:opacity-60"
          >
            {linkLabel}
          </button>
          <span className="text-destructive ms-0.5">*</span>
          {version ? (
            <span className="text-muted-foreground/70 ms-1">
              ({versionLabel} {version})
            </span>
          ) : null}
        </Label>
      </div>

      {/* Screen-reader only: visually the disabled checkbox and the
          underlined policy link are enough of a cue, but a disabled control
          with no stated reason is opaque to assistive tech — this is what
          `aria-describedby` above points at. */}
      {!canTick ? (
        <p id={`${id}-hint`} className="sr-only">
          {readHint}
        </p>
      ) : null}

      {error ? <p className="text-destructive ms-7 text-sm">{error}</p> : null}

      {policyText && version ? (
        <PolicyDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={dialogTitle}
          policyText={policyText}
          version={version}
          versionLabel={versionLabel}
          scrollHint={scrollHint}
          confirmLabel={confirmLabel}
          onConfirm={() => {
            setHasRead(true);
            setDialogOpen(false);
          }}
        />
      ) : null}
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
  // RIO-DATA-001 — both consents are collected HERE, during registration,
  // rather than by a gate after first login. `null` means the policies
  // haven't loaded yet, which disables submit: without a version to submit
  // there is nothing valid to send, and the backend would reject it anyway.
  const [policies, setPolicies] = useState<ActiveConsentPolicies | null>(null);
  const [policiesError, setPoliciesError] = useState(false);

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
    // Both mandatory — registration cannot complete without accepting each
    // one. `literal(true)` (rather than a boolean with a refine) is what
    // makes an unticked box a field-level validation error shown next to
    // that checkbox, instead of a form-wide one.
    acceptedUsePolicy: z.literal(true, {
      message: tValidation("usePolicyRequired"),
    }),
    acceptedDataSharing: z.literal(true, {
      message: tValidation("dataSharingRequired"),
    }),
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
      // Deliberately unticked: consent must be an action the registrant
      // takes, never a default they fail to notice.
      acceptedUsePolicy: false as true,
      acceptedDataSharing: false as true,
    },
  });

  const selectedSector = useWatch({ control, name: "sector" });
  const regionId = useWatch({ control, name: "regionId" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });

  const acceptedUsePolicy = useWatch({ control, name: "acceptedUsePolicy" });
  const acceptedDataSharing = useWatch({ control, name: "acceptedDataSharing" });

  useEffect(() => {
    geographyService
      .listRegions()
      .then(setRegions)
      .catch(() => setRegions([]));
  }, []);

  // Both consent policies, fetched from the open endpoint (no session exists
  // yet at registration). The submitted version comes from here, so the
  // server can verify the registrant agreed to the text that is actually
  // live — see the backend's CONSENT_VERSION_STALE check.
  useEffect(() => {
    consentService
      .getActive()
      .then((active) => {
        setPolicies(active);
        setPoliciesError(false);
      })
      .catch(() => {
        setPolicies(null);
        setPoliciesError(true);
      });
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
    // Guarded by the disabled submit below, but re-checked here because the
    // versions are what make the acceptance meaningful — never send a
    // registration whose consent can't be pinned to a specific policy.
    if (!policies) {
      setFormError(t("consentUnavailableError"));
      return;
    }
    try {
      const { temporaryPasswordEmailed } = await authService.signup({
        organizationName: values.organizationName,
        sector: values.sector,
        purpose: values.sector === "other" ? values.otherSector : undefined,
        registrationNumber: values.registrationNumber,
        email: values.email,
        regionId: values.regionId,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
        // The exact versions the two checkboxes above were rendered for.
        consent: {
          usePolicyVersion: policies.usePolicy.version,
          dataSharingVersion: policies.dataSharing.version,
        },
      });
      // Signup doesn't sign the admin in automatically — they confirm how
      // they got their password (emailed, or the not-emailed fallback
      // notice — never the password value itself, see
      // SignupConfirmation's own comment), then sign in explicitly with
      // it, same as any returning user would.
      setPendingConfirmation({ temporaryPasswordEmailed });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (pendingConfirmation) {
    return (
      <SignupConfirmation
        temporaryPasswordEmailed={pendingConfirmation.temporaryPasswordEmailed}
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
          <Label htmlFor="organizationName">
            {t("organizationNameLabel")} <span className="text-destructive">*</span>
          </Label>
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
            <Label htmlFor="registrationNumber">
              {t("registrationNumberLabel")} <span className="text-destructive">*</span>
            </Label>
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
            <Label htmlFor="sector">
              {t("sectorLabel")} <span className="text-destructive">*</span>
            </Label>
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
          <Label htmlFor="region">
            {tGeo("administrativeRegionLabel")}{" "}
            <span className="text-destructive">*</span>
          </Label>
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
          <Label>
            {tGeo("governorateLabel")} <span className="text-destructive">*</span>
          </Label>
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
          <Label>
            {tGeo("centerLabel")} <span className="text-destructive">*</span>
          </Label>
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
          <Label htmlFor="email">
            {t("emailLabel")} <span className="text-destructive">*</span>
          </Label>
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

        {/* RIO-DATA-001 — the two consents, accepted as part of registration
            itself. Each opens its live policy in a dialog that must be read
            to the end before its checkbox unlocks, so the acceptance is never
            a tick against unseen wording. */}
        <fieldset className="border-border space-y-4 border-t pt-5">
          <legend className="sr-only">{t("consentLegend")}</legend>

          <ConsentCheckbox
            id="acceptedUsePolicy"
            checked={acceptedUsePolicy === true}
            onCheckedChange={(checked) =>
              setValue("acceptedUsePolicy", checked as true, { shouldValidate: true })
            }
            label={t("usePolicyLabel")}
            linkLabel={t("usePolicyLinkLabel")}
            dialogTitle={t("usePolicyDialogTitle")}
            policyText={policies?.usePolicy.text}
            version={policies?.usePolicy.version}
            versionLabel={t("policyVersion")}
            scrollHint={t("scrollHint")}
            confirmLabel={t("policyReadConfirm")}
            readHint={t("mustReadHint")}
            error={errors.acceptedUsePolicy?.message}
          />

          <ConsentCheckbox
            id="acceptedDataSharing"
            checked={acceptedDataSharing === true}
            onCheckedChange={(checked) =>
              setValue("acceptedDataSharing", checked as true, { shouldValidate: true })
            }
            label={t("dataSharingLabel")}
            linkLabel={t("dataSharingLinkLabel")}
            dialogTitle={t("dataSharingDialogTitle")}
            policyText={policies?.dataSharing.text}
            version={policies?.dataSharing.version}
            versionLabel={t("policyVersion")}
            scrollHint={t("scrollHint")}
            confirmLabel={t("policyReadConfirm")}
            readHint={t("mustReadHint")}
            error={errors.acceptedDataSharing?.message}
          />

          {policiesError ? (
            <p className="text-destructive text-sm">{t("consentUnavailableError")}</p>
          ) : null}
        </fieldset>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <LoadingButton
          type="submit"
          className="h-11 w-full gap-2 px-6"
          isLoading={isSubmitting}
          // Without the policies there is no version to pin the acceptance
          // to, so registration genuinely cannot proceed — disabled rather
          // than allowed-to-fail at the server.
          disabled={!policies}
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
