import { useTranslations } from "next-intl";
import { AuthShell } from "@/components/layout/auth-shell";
import { OtpForm } from "@/components/features/auth/otp-form";

export default function OtpPage() {
  const t = useTranslations("auth.otp");

  return (
    <AuthShell heroTitle={t("heroTitle")} heroSubtitle={t("heroSubtitle")}>
      <OtpForm />
    </AuthShell>
  );
}
