"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ModulePermission } from "@/types/permissions";

const EXTRA_ACTIONS = ["approve", "export", "share"] as const;

function levelKey(permission: ModulePermission): "full" | "read" | "none" {
  if (permission.read && permission.write) return "full";
  if (permission.read) return "read";
  return "none";
}

const LEVEL_STYLE: Record<ReturnType<typeof levelKey>, string> = {
  full: "bg-primary/10 text-primary border-transparent",
  read: "bg-secondary text-secondary-foreground border-transparent",
  none: "text-muted-foreground",
};

/**
 * Full per-module breakdown for a role's permission set — used in both the
 * Roles and Users detail panels. One access-level badge per module (Full /
 * Read only / No access, the same wording as the card-level summary), with
 * elevated actions (Approve/Export/Share) called out only where they
 * actually apply. Deliberately not a module × action grid of repeated
 * checkmarks — that reads as noise once there are 12 rows.
 */
export function ModuleAccessList({ permissions }: { permissions: ModulePermission[] }) {
  const t = useTranslations("app.settings.roles");
  const tModules = useTranslations("app.settings.roles.modules");

  return (
    <div className="divide-border/70 divide-y">
      {permissions.map((permission) => {
        const level = levelKey(permission);
        const extras = EXTRA_ACTIONS.filter((action) => permission[action]);

        return (
          <div
            key={permission.module}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm">
                {tModules(permission.module)}
              </p>
              {extras.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {extras.map((action) => t(`actions.${action}`)).join(" · ")}
                </p>
              ) : null}
            </div>
            <Badge variant="outline" className={LEVEL_STYLE[level]}>
              {t(`access.${level}`)}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
