"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/components/providers/auth-provider";
import { AuthShell } from "@/components/layout/auth-shell";
import { PasswordInput } from "@/components/features/auth/password-input";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/services/api/types";
import { authService } from "@/services/auth/auth.service";

/**
 * Blocks the app until a signup-issued temporary password has been
 * replaced. Every self-signup NGO Admin starts with `mustChangePassword:
 * true` (see the backend's `AuthService.signup()`) — this is the one and
 * only way off it, requiring the temp password itself (not just a valid
 * session cookie) before accepting a new one, same identity check as any
 * password change.
 *
 * Uses the same `AuthShell` two-column layout as every other auth screen
 * (login, signup, forgot/reset password, OTP) — this is still an
 * authentication step, not an in-app settings screen, so it should look
 * like one, not like a modal dropped on top of the dashboard.
 *
 * On success, the response's fresh `SessionContext` (with
 * `mustChangePassword: false`) is applied via `setSession` and the caller is
 * sent straight into the dashboard on that same session — no forced
 * re-login, since the session itself is still valid and now reflects the
 * new password.
 */
export function PasswordChangeGuard({ children }: { children: ReactNode }) {
  const { session, setSession } = useAuth();
  const router = useRouter();
  const t = useTranslations("app.passwordChange");
  const tValidation = useTranslations("auth.validation");
  const [formError, setFormError] = useState<string | null>(null);

  const schema = z
    .object({
      currentPassword: z.string().min(1, { message: tValidation("passwordMin") }),
      newPassword: z.string().min(8, { message: tValidation("passwordMin") }),
      confirmPassword: z.string().min(1, { message: tValidation("passwordMin") }),
    })
    .refine((values) => values.newPassword === values.confirmPassword, {
      message: tValidation("passwordsMustMatch"),
      path: ["confirmPassword"],
    });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  if (!session) return null;
  if (!session.mustChangePassword) return <>{children}</>;

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      const updated = await authService.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      });
      setSession(updated);
      router.push("/dashboard");
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : t("genericError"));
    }
  };

  return (
    <AuthShell heroTitle={t("heroTitle")} heroSubtitle={t("heroSubtitle")}>
      <div className="w-full max-w-sm">
        <div className="mb-8 space-y-1.5">
          <h1 className="text-foreground text-2xl font-semibold">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("description")}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="space-y-2.5">
            <Label htmlFor="currentPassword">{t("currentPasswordLabel")}</Label>
            <PasswordInput
              id="currentPassword"
              autoComplete="current-password"
              placeholder={t("currentPasswordPlaceholder")}
              {...register("currentPassword")}
            />
            {errors.currentPassword ? (
              <p className="text-destructive text-sm">{errors.currentPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="newPassword">{t("newPasswordLabel")}</Label>
            <PasswordInput
              id="newPassword"
              autoComplete="new-password"
              placeholder={t("newPasswordPlaceholder")}
              {...register("newPassword")}
            />
            {errors.newPassword ? (
              <p className="text-destructive text-sm">{errors.newPassword.message}</p>
            ) : null}
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="confirmPassword">{t("confirmPasswordLabel")}</Label>
            <PasswordInput
              id="confirmPassword"
              autoComplete="new-password"
              placeholder={t("confirmPasswordPlaceholder")}
              {...register("confirmPassword")}
            />
            {errors.confirmPassword ? (
              <p className="text-destructive text-sm">{errors.confirmPassword.message}</p>
            ) : null}
          </div>

          {formError ? <p className="text-destructive text-sm">{formError}</p> : null}

          <Button
            type="submit"
            className="h-11 w-full gap-2 px-6"
            disabled={isSubmitting}
          >
            {isSubmitting ? t("submitting") : t("submit")}
            {!isSubmitting && <ArrowRight className="size-4" />}
          </Button>
        </form>
      </div>
    </AuthShell>
  );
}
