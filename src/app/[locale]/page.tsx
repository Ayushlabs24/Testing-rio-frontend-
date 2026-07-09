import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/layout/auth-shell";
import { LoginForm } from "@/components/features/auth/login-form";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const heroBullets = t.raw("heroBullets") as string[];

  return (
    <AuthShell
      heroTitle={t("heroTitle")}
      heroSubtitle={t("heroSubtitle")}
      heroBullets={heroBullets}
    >
      <LoginForm />
    </AuthShell>
  );
}
