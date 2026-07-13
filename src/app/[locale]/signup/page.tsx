import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/layout/auth-shell";
import { SignupForm } from "@/components/features/auth/signup-form";

export default function SignupPage() {
  const t = useTranslations("auth.signup");

  return (
    <AuthShell heroTitle={t("heroTitle")} heroSubtitle={t("heroSubtitle")}>
      <SignupForm />
    </AuthShell>
  );
}
