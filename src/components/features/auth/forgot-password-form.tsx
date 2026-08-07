"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Mail } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { LoadingButton } from "@/components/common/loading-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tValidation = useTranslations("auth.validation");
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const schema = z.object({
    email: z.string().email({ message: tValidation("emailInvalid") }),
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
      await authService.forgotPassword(values);
      setSent(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  if (sent) {
    return (
      <div className="w-full max-w-sm text-center">
        <h1 className="text-foreground text-2xl font-semibold">{t("sentTitle")}</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t("sentDescription")}</p>
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
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <div className="relative">
            <Mail className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="email"
              type="email"
              placeholder={t("emailPlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...register("email")}
            />
          </div>
          {errors.email ? (
            <p className="text-destructive text-sm">{errors.email.message}</p>
          ) : null}
        </div>

        {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

        <LoadingButton
          type="submit"
          className="h-11 w-full gap-2 px-6 text-base"
          isLoading={isSubmitting}
          text={isSubmitting ? t("submitting") : t("submit")}
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
