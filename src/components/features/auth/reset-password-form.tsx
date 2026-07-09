"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
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
      password: z.string().min(8, { message: tValidation("passwordMin") }),
      confirmPassword: z.string().min(8, { message: tValidation("passwordMin") }),
    })
    .refine((values) => values.password === values.confirmPassword, {
      message: tValidation("passwordsMustMatch"),
      path: ["confirmPassword"],
    });

  type Values = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

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
          <div className="relative">
            <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="password"
              type="password"
              placeholder={t("passwordPlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...register("password")}
            />
          </div>
          {errors.password ? (
            <p className="text-destructive text-sm">{errors.password.message}</p>
          ) : null}
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
          <div className="relative">
            <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="confirmPassword"
              type="password"
              placeholder={t("confirmPasswordPlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...register("confirmPassword")}
            />
          </div>
          {errors.confirmPassword ? (
            <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
          ) : null}
        </div>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <Button
          type="submit"
          className="h-11 w-full gap-2 px-6 text-base"
          disabled={isSubmitting}
        >
          {isSubmitting ? t("submitting") : t("submit")}
          {!isSubmitting && <ArrowRight className="size-4" />}
        </Button>
      </form>
    </div>
  );
}
