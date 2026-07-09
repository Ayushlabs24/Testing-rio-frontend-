import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/layout/auth-shell";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth.forgotPassword");

  return (
    <AuthShell heroTitle={t("heroTitle")} heroSubtitle={t("heroSubtitle")}>
      <ForgotPasswordForm />
    </AuthShell>
  );
}
