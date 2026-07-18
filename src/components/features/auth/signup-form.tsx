"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, Copy, ImageUp, MailCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { LoadingButton } from "@/components/common/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { organizationsService } from "@/services/organizations/organizations.service";

interface PendingConfirmation {
  temporaryPasswordEmailed: boolean;
  temporaryPassword?: string;
}

// Client-side allowlist for the organization logo — mirrors the backend's
// evidence-upload allowlist pattern (extension check before anything is
// sent), just for images instead of documents.
const ALLOWED_LOGO_EXTENSIONS = [".png", ".jpg", ".jpeg", ".svg"];

// The logo is stored as a base64 data URI (no object storage yet — see
// organizations.contract.ts on the backend), so this cap isn't arbitrary:
// 2MB raw expands to ~2.7M base64 chars, just under the backend's 2.8M-char
// limit on `logoUrl`. Raising this requires raising that backend limit too.
const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;

function hasAllowedExtension(fileName: string, allowed: string[]): boolean {
  const lower = fileName.toLowerCase();
  return allowed.some((ext) => lower.endsWith(ext));
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
  const sectorOptions = useSectorOptions(false);
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] =
    useState<PendingConfirmation | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFileName, setLogoFileName] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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
    defaultValues: { sector: "", otherSector: "" },
  });

  const selectedSector = useWatch({ control, name: "sector" });

  const onLogoSelected = (file: File) => {
    setLogoError(null);
    if (!hasAllowedExtension(file.name, ALLOWED_LOGO_EXTENSIONS)) {
      setLogoError(t("logoInvalidType"));
      setLogoPreview(null);
      setLogoFileName(null);
      return;
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      setLogoError(t("logoTooLarge"));
      setLogoPreview(null);
      setLogoFileName(null);
      return;
    }
    setLogoFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setLogoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    try {
      const { temporaryPasswordEmailed, temporaryPassword } = await authService.signup({
        organizationName: values.organizationName,
        sector: values.sector,
        purpose: values.sector === "other" ? values.otherSector : undefined,
        registrationNumber: values.registrationNumber,
        email: values.email,
      });
      // The signup response already carries a live session (the backend
      // sets the session cookie on signup) — used only to attach the logo,
      // right here, before the admin has actually "signed in" from the
      // app's point of view. A failed logo upload doesn't fail the whole
      // signup: the organization/account already exist at this point.
      if (logoPreview) {
        try {
          await organizationsService.update({ logoUrl: logoPreview });
        } catch {
          // Non-fatal — the admin can still upload a logo later from
          // Settings > Organization.
        }
      }
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

        <div className="space-y-2">
          <Label htmlFor="logoUpload">{t("logoLabel")}</Label>
          <button
            id="logoUpload"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="border-input hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full cursor-pointer items-center gap-2 rounded-lg border bg-transparent px-2.5 text-sm transition-colors outline-none focus-visible:ring-3"
          >
            <ImageUp className="text-muted-foreground size-4 shrink-0" />
            {logoPreview ? (
              <Avatar size="sm" className="shrink-0">
                <AvatarImage src={logoPreview} alt="" />
              </Avatar>
            ) : null}
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-left">
              {logoFileName ?? t("logoPlaceholder")}
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,.png,.jpg,.jpeg,.svg"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onLogoSelected(file);
              event.target.value = "";
            }}
          />
          {logoError ? <p className="text-destructive text-sm">{logoError}</p> : null}
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
