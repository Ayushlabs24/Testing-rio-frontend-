"use client";

import { useTranslations } from "next-intl";
import { Combobox } from "@/components/ui/combobox";
import { useDomainArabicMap } from "@/hooks/use-domain-arabic-map";
import type { QuestionOption } from "@/services/surveys/surveys.service";

const SEPARATOR = "|||";

function toKey(domain: string, subDomain: string): string {
  return `${domain}${SEPARATOR}${subDomain}`;
}

export interface DomainCategoryValue {
  domain: string;
  subDomain: string;
}

/**
 * Domain Category — a single mandatory select for a Need's authoritative
 * domain/sub-domain, sourced from the same Question Bank domain/sub-domain
 * pairs Survey Builder already matches questions against
 * (QuestionsService.getDomainOptions). Presented as one combined dropdown
 * ("Domain / Sub-domain") since the app's Question Bank matching always
 * needs both together — there's no meaningful "domain alone" selection.
 */
export function DomainCategoryPicker({
  value,
  onChange,
  options,
}: {
  value: DomainCategoryValue | null;
  onChange: (value: DomainCategoryValue) => void;
  options: QuestionOption[];
}) {
  const t = useTranslations("app.studies.need");
  const { localizedDomain, localizedSubDomain } = useDomainArabicMap();

  return (
    <Combobox
      items={options.map((option) => ({
        value: toKey(option.domain, option.subDomain),
        label: `${localizedDomain(option.domain)} / ${localizedSubDomain(option.subDomain)}`,
      }))}
      value={value ? toKey(value.domain, value.subDomain) : null}
      onSelect={(key) => {
        const [domain, subDomain] = key.split(SEPARATOR);
        onChange({ domain, subDomain });
      }}
      placeholder={t("domainCategoryPlaceholder")}
      searchPlaceholder={t("domainCategorySearchPlaceholder")}
      emptyText={t("domainCategoryEmpty")}
      aria-label={t("domainCategoryLabel")}
    />
  );
}
