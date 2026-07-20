"use client";

import { Check, Circle, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { PASSWORD_RULES } from "@/lib/password-policy";
import { cn } from "@/lib/utils";

/**
 * Live checklist of the set-password rules, shown under a new-password
 * field. Rules stay neutral until the user types — showing four red
 * failures against an empty box reads as an error the user hasn't made
 * yet. Once there's input, each rule turns green when satisfied and red
 * while it isn't.
 *
 * The rules come from `PASSWORD_RULES`, the same source the zod schema is
 * built from, so the checklist can't drift from what's actually enforced.
 */
export function PasswordRequirements({ value }: { value: string }) {
  const t = useTranslations("auth.validation");
  const touched = value.length > 0;

  return (
    <ul className="space-y-1.5" aria-live="polite">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        const Icon = !touched ? Circle : met ? Check : X;
        return (
          <li
            key={rule.key}
            className={cn(
              "flex items-center gap-2 text-xs transition-colors",
              !touched
                ? "text-muted-foreground"
                : met
                  ? "text-success"
                  : "text-destructive",
            )}
          >
            <Icon
              className={cn("size-3.5 shrink-0", !touched && "size-2 fill-current")}
              aria-hidden
            />
            {t(rule.messageKey)}
          </li>
        );
      })}
    </ul>
  );
}
