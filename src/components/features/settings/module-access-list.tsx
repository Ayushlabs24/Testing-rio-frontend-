"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ModulePermission } from "@/types/permissions";

const EXTRA_ACTIONS = ["approve", "export", "share"] as const;

/**
 * Three access tiers, not a binary full/read-only — a role with, say, view +
 * edit + approve but no create isn't "Full Access" (it plainly can't
 * create), and calling it that would misrepresent what the role can
 * actually do. So:
 * - `full`: view + create + edit — the only combination "Full Access"
 *   honestly describes.
 * - `read`: view only, nothing else.
 * - `custom`: anything in between (e.g. view + edit + approve but no
 *   create, or view + edit + export but no create) — shown with its full
 *   capability list underneath rather than a name that overstates or
 *   understates it.
 */
function levelKey(permission: ModulePermission): "full" | "read" | "custom" | "none" {
  if (!permission.read) return "none";
  if (permission.create && permission.write) return "full";
  if (!permission.create && !permission.write) return "read";
  return "custom";
}

// `none`-level permissions are filtered out before this is ever indexed
// (see `accessible` below) — included here only so `level`'s full return
// type indexes cleanly without a cast.
const LEVEL_STYLE: Record<ReturnType<typeof levelKey>, string> = {
  full: "bg-primary/10 text-primary border-transparent",
  read: "bg-secondary text-secondary-foreground border-transparent",
  custom: "bg-warning/10 text-warning border-transparent",
  none: "",
};

/**
 * Per-module breakdown for a role's permission set — used in both the
 * Roles and Users detail panels. Modules with no access at all are omitted
 * entirely (per the team lead: only show what a role *can* reach), leaving
 * one access-level badge per remaining module (Full Access / Read Only /
 * Custom Access).
 *
 * `full`/`read` already state the whole story in their name, so only the
 * elevated extras (Approve/Export/Share) are called out beneath them.
 * `custom` doesn't imply anything on its own, so its full capability list
 * (View, and whichever of Create/Edit/Approve/Export/Share actually apply)
 * is spelled out instead — the client specifically asked to see what
 * access a role currently has, not a label that papers over the gaps.
 */
export function ModuleAccessList({ permissions }: { permissions: ModulePermission[] }) {
  const t = useTranslations("app.settings.roles");
  const tModules = useTranslations("app.settings.roles.modules");
  const accessible = permissions.filter((permission) => levelKey(permission) !== "none");

  if (accessible.length === 0) {
    return (
      <p className="text-muted-foreground py-2.5 text-sm">{t("access.summaryNone")}</p>
    );
  }

  return (
    <div className="divide-border/70 divide-y">
      {accessible.map((permission) => {
        const level = levelKey(permission);
        const extras = EXTRA_ACTIONS.filter((action) => permission[action]);
        const capabilities =
          level === "custom"
            ? [
                t("actions.view"),
                ...(permission.create ? [t("actions.create")] : []),
                ...(permission.write ? [t("actions.edit")] : []),
                ...extras.map((action) => t(`actions.${action}`)),
              ]
            : extras.map((action) => t(`actions.${action}`));

        return (
          <div
            key={permission.module}
            className="flex items-center justify-between gap-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="text-foreground truncate text-sm">
                {tModules(permission.module)}
              </p>
              {capabilities.length > 0 ? (
                <p className="text-muted-foreground text-xs">
                  {capabilities.join(" · ")}
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
