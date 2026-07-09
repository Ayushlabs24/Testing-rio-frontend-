import { useTranslations } from "next-intl";
import { siteConfig } from "@/config/site";

export function AppFooter() {
  const t = useTranslations("app.footer");

  return (
    <footer className="border-border text-muted-foreground flex shrink-0 flex-col items-center justify-between gap-1 border-t px-4 py-3 text-xs sm:flex-row sm:px-6">
      <span>
        &copy; {new Date().getFullYear()} {siteConfig.name}. {t("rightsReserved")}
      </span>
      <span>{t("version", { version: "0.1.0" })}</span>
    </footer>
  );
}
