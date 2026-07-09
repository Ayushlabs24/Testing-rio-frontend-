"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, KeyRound, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";

export function OtpForm() {
  const t = useTranslations("auth.otp");
  const tValidation = useTranslations("auth.validation");
  const router = useRouter();
  const { setSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  const requestSchema = z.object({
    email: z.string().email({ message: tValidation("emailInvalid") }),
  });
  type RequestValues = z.infer<typeof requestSchema>;

  const requestForm = useForm<RequestValues>({ resolver: zodResolver(requestSchema) });

  const onRequestSubmit = async (values: RequestValues) => {
    setFormError(null);
    try {
      await authService.requestOtp(values);
      setEmail(values.email);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  const verifySchema = z.object({
    code: z.string().length(6, { message: tValidation("otpLength") }),
  });
  type VerifyValues = z.infer<typeof verifySchema>;

  const verifyForm = useForm<VerifyValues>({ resolver: zodResolver(verifySchema) });

  const onVerifySubmit = async (values: VerifyValues) => {
    setFormError(null);
    if (!email) return;
    try {
      const session = await authService.verifyOtp({ email, code: values.code });
      setSession(session);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (email) {
    return (
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-foreground text-2xl font-semibold">{t("verifyTitle")}</h1>
          <p className="text-muted-foreground text-sm">
            {t("verifyDescription", { email })}
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
                placeholder={t("codePlaceholder")}
                className="h-11 pr-4 pl-10 text-base tracking-widest"
                {...verifyForm.register("code")}
              />
            </div>
            {verifyForm.formState.errors.code ? (
              <p className="text-destructive text-sm">
                {verifyForm.formState.errors.code.message}
              </p>
            ) : null}
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <Button
            type="submit"
            className="h-11 w-full gap-2 px-6 text-base"
            disabled={verifyForm.formState.isSubmitting}
          >
            {verifyForm.formState.isSubmitting ? t("verifying") : t("verify")}
            {!verifyForm.formState.isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setEmail(null)}
          className="text-muted-foreground hover:text-foreground mt-5 w-full cursor-pointer text-center text-sm underline-offset-4 hover:underline"
        >
          {t("useDifferentEmail")}
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
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...requestForm.register("email")}
            />
          </div>
          {requestForm.formState.errors.email ? (
            <p className="text-destructive text-sm">
              {requestForm.formState.errors.email.message}
            </p>
          ) : null}
        </div>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <Button
          type="submit"
          className="h-11 w-full gap-2 px-6 text-base"
          disabled={requestForm.formState.isSubmitting}
        >
          {requestForm.formState.isSubmitting ? t("sending") : t("sendCode")}
          {!requestForm.formState.isSubmitting && <ArrowRight className="size-4" />}
        </Button>
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
