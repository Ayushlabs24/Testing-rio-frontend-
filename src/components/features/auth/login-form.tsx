"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Lock, Mail } from "lucide-react";
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

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tValidation = useTranslations("auth.validation");
  const router = useRouter();
  const { setSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const loginSchema = z.object({
    email: z.string().email({ message: tValidation("emailInvalid") }),
    password: z.string().min(8, { message: tValidation("passwordMin") }),
  });

  type LoginValues = z.infer<typeof loginSchema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    try {
      const session = await authService.login(values);
      setSession(session);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

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
          <Link
            href="/forgot-password"
            className="text-muted-foreground hover:text-foreground block text-right text-sm underline-offset-4 hover:underline"
          >
            {t("forgotPassword")}
          </Link>
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

      <Link
        href="/otp"
        className="text-muted-foreground hover:text-foreground mt-5 block w-full text-center text-sm underline-offset-4 hover:underline"
      >
        {t("otp")}
      </Link>

      <p className="text-muted-foreground mt-5 text-center text-sm">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="text-foreground font-medium underline-offset-4 hover:underline"
        >
          {t("signUp")}
        </Link>
      </p>
    </div>
  );
}
