"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** A password field with a left lock icon and a right eye toggle to reveal
 * the value — shared by every auth screen (login, reset, change password)
 * so the toggle behaves identically everywhere. */
export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const t = useTranslations("auth.common");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Lock className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
      <Input
        type={visible ? "text" : "password"}
        className={cn("h-11 pr-10 pl-10 text-base", className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3.5 -translate-y-1/2 cursor-pointer"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
