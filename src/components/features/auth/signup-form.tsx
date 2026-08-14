"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CheckCircle2, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  isValidRegistrationNumberShape,
  normalizeRegistrationNumber,
} from "@/lib/registration-number";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";
import { consentService } from "@/services/consent/consent.service";
import {
  consentPolicyTextFor,
  type ActiveConsentPolicies,
  type ConsentLocale,
} from "@/services/consent/consent.types";
import { geographyService } from "@/services/geography/geography.service";
import type { Center, Governorate, Region } from "@/services/geography/geography.types";

interface PendingConfirmation {
  organizationName: string;
}

/**
 * Backend error codes that are really "the registration number is wrong",
 * mapped to their key under `auth.validation`. Both come from the NIC-registry
 * gate in AuthService.signup: NOT_RECOGNISED is a well-formed number that
 * isn't in the published entity register, INVALID is one that isn't a
 * 10-digit unified national number at all (the client's own shape check
 * normally catches that one first).
 */
const REGISTRATION_NUMBER_ERRORS: Record<string, string> = {
  REGISTRATION_NUMBER_NOT_RECOGNISED: "registrationNumberUnknown",
  REGISTRATION_NUMBER_INVALID: "registrationNumberFormat",
};

/**
 * Shown once, right after a successful signup. RIO-FR-010 (client-confirmed):
 * self-registration requires Center (System Admin) approval before
 * activation — there's no temporary password to reveal yet, since one isn't
 * issued until a System Admin approves the entity (see
 * `OrganizationsService.approve` on the backend). This screen just confirms
 * the registration was received and explains what happens next.
 */
function SignupConfirmation({
  organizationName,
  onGoToSignIn,
}: {
  organizationName: string;
  onGoToSignIn: () => void;
}) {
  const t = useTranslations("auth.signup");

  return (
    <div className="w-full max-w-lg">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">
          {t("pendingApprovalTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("pendingApprovalDescription", { organizationName })}
        </p>
      </div>

      <div className="border-border bg-muted/30 flex items-center gap-3 rounded-lg border p-4">
        <MailCheck className="text-muted-foreground size-5 shrink-0" />
        <p className="text-foreground text-sm">{t("pendingApprovalNotice")}</p>
      </div>

      <Button
        type="button"
        className="mt-6 h-11 w-full gap-2 px-6 text-base"
        onClick={onGoToSignIn}
      >
        {t("goToSignInButton")}
        <ArrowRight className="size-4 rtl:rotate-180" />
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
        // `dir="auto"` rather than inheriting the page direction: this block
        // is policy copy from the database, and the two can disagree — an
        // untranslated policy still renders its English text on an Arabic
        // (RTL) page, where inherited direction would mangle its punctuation.
        // Same convention the app uses everywhere it renders stored text.
        dir="auto"
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

      {/* Visible, not sr-only: a disabled checkbox with no stated reason is
          opaque to everyone, not just assistive tech — a sighted user sees a
          box that will not tick and no explanation of why. Shown until the
          policy has been read, and doubles as the `aria-describedby` target.
          Suppressed once a validation error is showing, so the two messages
          never stack. */}
      {!canTick && !error ? (
        <p id={`${id}-hint`} className="text-muted-foreground ms-7 text-xs">
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
  // Which language the consents get rendered in — and, submitted alongside
  // the versions, which wording the acceptance is recorded against. Narrowed
  // exhaustively rather than cast: `useLocale()` widens to string, and only
  // these two have policy copy behind them.
  const consentLocale: ConsentLocale = useLocale() === "ar" ? "ar" : "en";
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
    // The registration number is the entity's 10-digit unified national
    // number, checked server-side against the NIC entity registry. The shape
    // check here is UX only — it catches a typo without a round trip; the
    // server re-normalizes and re-checks, and is the actual gate.
    registrationNumber: z
      .string()
      .min(1, { message: tValidation("registrationNumberRequired") })
      .refine(isValidRegistrationNumberShape, {
        message: tValidation("registrationNumberFormat"),
      }),
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
    setError,
    clearErrors,
    control,
    formState: { errors, isSubmitting, isDirty },
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
  const registrationNumber = useWatch({ control, name: "registrationNumber" });
  const regionId = useWatch({ control, name: "regionId" });
  const governorateIds = useWatch({ control, name: "governorateIds" });
  const centerIds = useWatch({ control, name: "centerIds" });

  // The number the Verify button last confirmed, normalized. Held as the
  // value rather than a boolean so editing the field silently drops the tick
  // — a green check next to a number nobody checked would be a lie.
  const [verifiedNumber, setVerifiedNumber] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  const normalizedRegistrationNumber = normalizeRegistrationNumber(
    registrationNumber ?? "",
  );
  const isRegistrationNumberVerified =
    verifiedNumber !== null && verifiedNumber === normalizedRegistrationNumber;
  const isRegistrationNumberVerifiable =
    !isVerifying &&
    normalizedRegistrationNumber.length > 0 &&
    !isRegistrationNumberVerified;

  const onVerifyRegistrationNumber = async () => {
    const value = registrationNumber ?? "";
    clearErrors("registrationNumber");

    // Checked here too, not just on submit: the server would answer
    // INVALID_FORMAT anyway, and spending a rate-limited request to be told
    // what the client already knows is wasteful.
    if (!isValidRegistrationNumberShape(value)) {
      setError("registrationNumber", {
        type: "validate",
        message: tValidation("registrationNumberFormat"),
      });
      return;
    }

    setIsVerifying(true);
    try {
      const { verified, reason } = await authService.verifyRegistrationNumber(value);
      if (verified) {
        setVerifiedNumber(normalizeRegistrationNumber(value));
        return;
      }
      setVerifiedNumber(null);
      setError("registrationNumber", {
        type: "validate",
        message: tValidation(
          reason === "INVALID_FORMAT"
            ? "registrationNumberFormat"
            : "registrationNumberUnknown",
        ),
      });
    } catch {
      // A transport failure or the endpoint's own rate limit — neither is a
      // verdict on the number, so don't clear or set a verified state.
      setVerifiedNumber(null);
      setError("registrationNumber", {
        type: "server",
        message: tValidation("registrationNumberVerifyFailed"),
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const organizationName = useWatch({ control, name: "organizationName" });
  const email = useWatch({ control, name: "email" });
  const acceptedUsePolicy = useWatch({ control, name: "acceptedUsePolicy" });
  const acceptedDataSharing = useWatch({ control, name: "acceptedDataSharing" });

  const otherSector = useWatch({ control, name: "otherSector" });

  /**
   * Every required field answered, both consents accepted, and the
   * registration number confirmed against the registry — the submit button
   * stays disabled until all of it holds.
   *
   * Presence only, not validity: an email that's filled but malformed still
   * enables the button, so submitting surfaces zod's own "enter a valid email"
   * on the field. A button that silently refuses to enable, with nothing
   * saying why, is worse than one that enables and explains.
   *
   * `otherSector` is included only when "Other" is selected — the backend
   * accepts an empty `purpose` for non-Other sectors, but if the user picks
   * Other and leaves the free-text blank the signup will fail server-side.
   */
  const isFormComplete =
    Boolean(organizationName?.trim()) &&
    Boolean(selectedSector) &&
    (selectedSector !== "other" || Boolean(otherSector?.trim())) &&
    Boolean(email?.trim()) &&
    Boolean(regionId) &&
    governorateIds.length > 0 &&
    centerIds.length > 0 &&
    acceptedUsePolicy === true &&
    acceptedDataSharing === true &&
    // Implies the field is filled, and that what's in it was actually checked.
    isRegistrationNumberVerified;

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

  // The wording each consent dialog shows, in the reader's own language —
  // falling back to English per policy when a translation is outstanding, so
  // one untranslated consent never blanks the other. `undefined` while the
  // policies are still loading, which is what keeps the checkboxes locked.
  const usePolicyText = policies
    ? consentPolicyTextFor(policies.usePolicy, consentLocale)
    : undefined;
  const dataSharingText = policies
    ? consentPolicyTextFor(policies.dataSharing, consentLocale)
    : undefined;

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
      const result = await authService.signup({
        organizationName: values.organizationName,
        sector: values.sector,
        purpose: values.sector === "other" ? values.otherSector : undefined,
        registrationNumber: values.registrationNumber,
        email: values.email,
        regionId: values.regionId,
        governorateIds: values.governorateIds,
        centerIds: values.centerIds,
        // The exact versions the two checkboxes above were rendered for,
        // plus the language they were rendered in — together they identify
        // the wording that was actually read, which is what the server
        // snapshots onto the immutable acceptance records.
        consent: {
          usePolicyVersion: policies.usePolicy.version,
          dataSharingVersion: policies.dataSharing.version,
          locale: consentLocale,
        },
      });
      // No session is issued — registration now requires Center (System
      // Admin) approval before activation. See SignupConfirmation's comment.
      setPendingConfirmation({ organizationName: result.organizationName });
    } catch (error) {
      // The NIC-registry gate rejects the registration number itself, so it
      // belongs on that field rather than in the form-wide banner at the
      // bottom of a long form. Mapped off the server's error code — the
      // backend has no i18n, and its English sentence must not reach an
      // Arabic registrant.
      if (
        error instanceof ApiError &&
        error.code &&
        error.code in REGISTRATION_NUMBER_ERRORS
      ) {
        setError(
          "registrationNumber",
          {
            type: "server",
            message: tValidation(REGISTRATION_NUMBER_ERRORS[error.code]),
          },
          { shouldFocus: true },
        );
        return;
      }
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (pendingConfirmation) {
    return (
      <SignupConfirmation
        organizationName={pendingConfirmation.organizationName}
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

        {/* Full-width rather than sharing a row with Sector: the field now
            carries a Verify button and its own status line, and a half-width
            column wrapped that message across four lines. */}
        <div className="space-y-2">
          <Label htmlFor="registrationNumber">
            {t("registrationNumberLabel")} <span className="text-destructive">*</span>
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="registrationNumber"
              className="flex-1"
              placeholder={t("registrationNumberPlaceholder")}
              aria-describedby="registrationNumberStatus"
              aria-invalid={errors.registrationNumber ? true : undefined}
              {...register("registrationNumber")}
            />
            <LoadingButton
              type="button"
              variant="outline"
              text={t("verifyRegistrationNumber")}
              // Verifying an empty field can only ever say "wrong shape",
              // which the field itself already says on submit.
              disabled={!isRegistrationNumberVerifiable}
              isLoading={isVerifying}
              onClick={onVerifyRegistrationNumber}
            />
            {isRegistrationNumberVerified ? (
              <CheckCircle2
                className="size-6 shrink-0 text-emerald-600"
                aria-hidden="true"
              />
            ) : null}
          </div>
          {/* One line at a time, and one element: the field error and the
              "verified" confirmation are mutually exclusive states, so they
              share a slot instead of stacking. aria-live announces the
              outcome of a Verify click, which is otherwise only visual. */}
          <p
            id="registrationNumberStatus"
            aria-live="polite"
            className={
              errors.registrationNumber
                ? "text-destructive text-sm"
                : "text-sm text-emerald-600"
            }
          >
            {errors.registrationNumber?.message ??
              (isRegistrationNumberVerified ? t("registrationNumberVerified") : null)}
          </p>
        </div>

        {/* Everything past the registration number is locked until that
            number is confirmed against the registry. A native disabled
            fieldset does it in one place — every descendant control, custom
            components included, reports :disabled and drops out of the tab
            order — rather than threading a `disabled` prop through six
            different widgets. The point is to stop anyone filling in a long
            form on behalf of an entity that can't register at all. */}
        <fieldset disabled={!isRegistrationNumberVerified} className="space-y-4">
          <legend className="sr-only">{t("entityDetailsLegend")}</legend>

          {!isRegistrationNumberVerified ? (
            <p className="text-muted-foreground text-sm" aria-live="polite">
              {t("verifyToUnlockHint")}
            </p>
          ) : null}

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
              policyText={usePolicyText}
              version={policies?.usePolicy.version}
              versionLabel={t("policyVersion")}
              scrollHint={t("scrollHint")}
              confirmLabel={t("policyReadConfirm")}
              readHint={t("mustReadHint", { policy: t("usePolicyLinkLabel") })}
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
              policyText={dataSharingText}
              version={policies?.dataSharing.version}
              versionLabel={t("policyVersion")}
              scrollHint={t("scrollHint")}
              confirmLabel={t("policyReadConfirm")}
              readHint={t("mustReadHint", { policy: t("dataSharingLinkLabel") })}
              error={errors.acceptedDataSharing?.message}
            />

            {policiesError ? (
              <p className="text-destructive text-sm">{t("consentUnavailableError")}</p>
            ) : null}
          </fieldset>
        </fieldset>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        {/* Says why the button is dead. A disabled control with no stated
            reason strands anyone who can't spot the one thing they missed —
            most often the Verify step, which no other form here has.
            Only shown once the user has started filling the form so it
            doesn't read as a pre-emptive error on first load. */}
        {policies && isDirty && !isFormComplete ? (
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {t("completeAllFieldsHint")}
          </p>
        ) : null}

        <LoadingButton
          type="submit"
          className="h-11 w-full gap-2 px-6"
          isLoading={isSubmitting}
          // Two reasons to be disabled: without the policies there is no
          // version to pin the acceptance to, and an incomplete form (or an
          // unverified registration number) can only fail — neither is worth
          // a round trip to the server to find out.
          disabled={!policies || !isFormComplete}
          text={isSubmitting ? t("submitting") : t("submit")}
          endIcon={<ArrowRight className="size-4 rtl:rotate-180" />}
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
