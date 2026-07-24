"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { PasswordInput } from "@/components/features/auth/password-input";
import { PasswordRequirements } from "@/components/features/auth/password-requirements";
import { LoadingButton } from "@/components/common/loading-button";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { newPasswordSchema } from "@/lib/password-policy";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const tValidation = useTranslations("auth.validation");
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      password: newPasswordSchema(tValidation),
      confirmPassword: z.string().min(1, { message: tValidation("passwordMin") }),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: tValidation("passwordsMustMatch"),
      path: ["confirmPassword"],
    });

  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  // Drives the live rule checklist under the field.
  const password = useWatch({ control, name: "password" }) ?? "";

  const onSubmit = async (values: Values) => {
    setFormError(null);
    try {
      await authService.resetPassword({ token, password: values.password });
      setDone(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (done) {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="text-foreground text-2xl font-semibold">{t("doneTitle")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("doneDescription")}</p>
        <Link
          href="/"
          className="text-foreground mt-6 inline-block text-sm font-medium underline-offset-4 hover:underline"
        >
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 space-y-1.5">
        <h1 className="text-foreground text-2xl font-semibold">{t("title")}</h1>
        <p className="text-muted-foreground text-sm">{t("description")}</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2.5">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <PasswordInput
            id="password"
            placeholder={t("passwordPlaceholder")}
            {...register("password")}
          />
          {/* The checklist already names every unmet rule, so repeating
              the resolver's message here would just duplicate it. */}
          <PasswordRequirements value={password} />
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
          <PasswordInput
            id="confirmPassword"
            placeholder={t("confirmPasswordPlaceholder")}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword ? (
            <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
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
    </div>
  );
}
