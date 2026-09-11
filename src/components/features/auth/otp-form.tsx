"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ChangeEvent } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { LoadingButton } from "@/components/common/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { AUTH_API_ERROR_CODES, getApiErrorMessage } from "@/lib/api-error-message";
import { authService } from "@/services/auth/auth.service";

export function OtpForm() {
  const t = useTranslations("auth.otp");
  const tValidation = useTranslations("auth.validation");
  const tErrors = useTranslations("auth.apiErrors");
  const router = useRouter();
  const { setSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState<string | null>(null);

  // RIO MFA — accepts either an email or a mobile number, whichever the
  // account has on file (see AuthService.requestLoginOtp on the backend).
  // Loosely bounded rather than a strict email/E.164 union: the backend is
  // the source of truth for whether it actually matches an eligible
  // account, and a generic "at least 3 non-space characters" catches empty
  // submits without rejecting a validly-formatted value on the client only
  // to disagree with the server about what's valid.
  const requestSchema = z.object({
    identifier: z
      .string()
      .trim()
      .min(3, { message: tValidation("identifierRequired") }),
  });
  type RequestValues = z.infer<typeof requestSchema>;

  const requestForm = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  const onRequestSubmit = async (values: RequestValues) => {
    setFormError(null);
    try {
      await authService.requestOtp(values);
      setIdentifier(values.identifier);
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, AUTH_API_ERROR_CODES, tErrors, t("genericError")),
      );
    }
  };

  const verifySchema = z.object({
    code: z.string().length(6, { message: tValidation("otpLength") }),
  });
  type VerifyValues = z.infer<typeof verifySchema>;

  const verifyForm = useForm<VerifyValues>({ resolver: zodResolver(verifySchema) });

  const onVerifySubmit = async (values: VerifyValues) => {
    setFormError(null);
    if (!identifier) return;
    try {
      const session = await authService.verifyOtp({ identifier, code: values.code });
      setSession(session);
      router.push("/dashboard");
    } catch (error) {
      setFormError(
        getApiErrorMessage(error, AUTH_API_ERROR_CODES, tErrors, t("genericError")),
      );
    }
  };

  if (identifier) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-foreground text-2xl font-semibold">{t("verifyTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("verifyDescription", { identifier })}
          </p>
        </div>

        <form onSubmit={verifyForm.handleSubmit(onVerifySubmit)} className="space-y-6">
          <div className="space-y-2.5">
            <Label htmlFor="code">{t("codeLabel")}</Label>
            <div className="relative">
              <KeyRound className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                // No placeholder — an empty 6-digit box reads clearly enough
                // on its own.
                //
                // autoComplete="off" rather than "one-time-code": Chrome (at
                // least as of this writing) still offers its own saved
                // phone-number suggestions on a short numeric field
                // regardless of the "one-time-code" token, and can autofill
                // a value longer than `maxLength` — confirmed by an actual
                // user hitting this. "off" is the blunter instruction but
                // the one that's actually respected here; it costs us the
                // nice-to-have SMS auto-read some browsers offer for
                // "one-time-code", which isn't wired up on the backend yet
                // anyway.
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                // data-1p-ignore / data-lpignore: opt out of 1Password's and
                // LastPass's autofill too — password managers routinely
                // ignore autoComplete="off" on their own.
                data-1p-ignore="true"
                data-lpignore="true"
                className="h-11 pr-4 pl-10 text-base tracking-widest"
                {...verifyForm.register("code", {
                  // Belt-and-suspenders for the "bypasses maxLength" case
                  // above: whatever lands in the field (typed or
                  // autofilled), only digits and only the first 6 of them
                  // ever reach form state.
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    const sanitized = event.target.value.replace(/\D/g, "").slice(0, 6);
                    if (sanitized !== event.target.value) event.target.value = sanitized;
                  },
                })}
              />
            </div>
            {verifyForm.formState.errors.code ? (
              <p className="text-destructive text-sm">
                {verifyForm.formState.errors.code.message}
              </p>
            ) : null}
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <LoadingButton
            type="submit"
            className="h-11 w-full gap-2 px-6 text-base"
            isLoading={verifyForm.formState.isSubmitting}
            text={verifyForm.formState.isSubmitting ? t("verifying") : t("verify")}
            endIcon={<ArrowRight className="size-4 rtl:rotate-180" />}
          />
        </form>

        <button
          type="button"
          onClick={() => setIdentifier(null)}
          className="text-muted-foreground hover:text-foreground mt-5 w-full cursor-pointer text-center text-sm underline-offset-4 hover:underline"
        >
          {t("useDifferentIdentifier")}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <form onSubmit={requestForm.handleSubmit(onRequestSubmit)} className="space-y-6">
        <div className="space-y-2.5">
          <Label htmlFor="identifier">{t("identifierLabel")}</Label>
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="identifier"
              type="text"
              placeholder={t("identifierPlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...requestForm.register("identifier")}
            />
          </div>
          {requestForm.formState.errors.identifier ? (
            <p className="text-destructive text-sm">
              {requestForm.formState.errors.identifier.message}
            </p>
          ) : (
            // Persistent hint rather than packing this into the placeholder
            // — a placeholder that long just gets clipped at this card's
            // width (no room for it to wrap), while a normal paragraph
            // wraps onto a second line and stays visible once the field is
            // focused/filled, which is exactly when it's most useful.
            <p className="text-muted-foreground text-xs">{t("identifierHint")}</p>
          )}
        </div>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <LoadingButton
          type="submit"
          className="h-11 w-full gap-2 px-6 text-base"
          isLoading={requestForm.formState.isSubmitting}
          text={requestForm.formState.isSubmitting ? t("sending") : t("sendCode")}
          endIcon={<ArrowRight className="size-4 rtl:rotate-180" />}
        />
      </form>

      <Link
        href="/"
        className="text-muted-foreground hover:text-foreground mt-6 block text-center text-sm underline-offset-4 hover:underline"
      >
        {t("backToLogin")}
      </Link>
    </div>
  );
}
