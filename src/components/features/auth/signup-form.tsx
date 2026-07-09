"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Building2, Lock, Mail, User } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tValidation = useTranslations("auth.validation");
  const router = useRouter();
  const { setSession } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const signupSchema = z.object({
    organizationName: z
      .string()
      .min(1, { message: tValidation("organizationNameRequired") }),
    name: z.string().min(1, { message: tValidation("nameRequired") }),
    email: z.string().email({ message: tValidation("emailInvalid") }),
    password: z.string().min(8, { message: tValidation("passwordMin") }),
    consent: z
      .boolean()
      .refine((value) => value === true, { message: tValidation("consentRequired") }),
  });

  type SignupValues = z.infer<typeof signupSchema>;

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { consent: false },
  });

  const onSubmit = async (values: SignupValues) => {
    setFormError(null);
    try {
      const session = await authService.signup(values);
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
          <Label htmlFor="organizationName">{t("organizationNameLabel")}</Label>
          <div className="relative">
            <Building2 className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="organizationName"
              placeholder={t("organizationNamePlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...register("organizationName")}
            />
          </div>
          {errors.organizationName ? (
            <p className="text-destructive text-sm">{errors.organizationName.message}</p>
          ) : null}
        </div>

        <div className="space-y-2.5">
          <Label htmlFor="name">{t("nameLabel")}</Label>
          <div className="relative">
            <User className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
            <Input
              id="name"
              placeholder={t("namePlaceholder")}
              className="h-11 pr-4 pl-10 text-base"
              {...register("name")}
            />
          </div>
          {errors.name ? (
            <p className="text-destructive text-sm">{errors.name.message}</p>
          ) : null}
        </div>

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
        </div>

        <div className="mt-1 space-y-2.5">
          <div className="flex items-start gap-3">
            <Checkbox
              id="consent"
              className="mt-0.5"
              onCheckedChange={(checked) => setValue("consent", checked === true)}
            />
            <Label
              htmlFor="consent"
              className="text-muted-foreground text-xs leading-relaxed font-normal"
            >
              {t("consentLabel")}
            </Label>
          </div>
          {errors.consent ? (
            <p className="text-destructive text-sm">{errors.consent.message}</p>
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

      <p className="text-muted-foreground mt-6 text-center text-sm">
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
