import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/layout/auth-shell";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";

export default function ResetPasswordPage() {
  const t = useTranslations("auth.resetPassword");

  return (
    <AuthShell heroTitle={t("heroTitle")} heroSubtitle={t("heroSubtitle")}>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
