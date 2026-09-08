import type { LucideIcon } from "lucide-react";
import {
  AlarmClock,
  Archive,
  BarChart3,
  Building2,
  ClipboardEdit,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  // ListChecks,
  ListTree,
  Milestone,
  QrCode,
  ScrollText,
  Share2,
  Terminal,
  ShieldCheck,
  Users2,
  // DatabaseBackup, // RIO-NFR-010 nav item hidden — see below
} from "lucide-react";
import type { PermissionAction, PermissionModule } from "@/types/permissions";

export interface NavItem {
  /**
   * Key into the `app.sidebar` namespace of the message files, and the
   * identifier `NAV_ORDER_BY_ROLE` below references to build each role's
   * ordered menu — must be unique across `appNav`.
   */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Omit for items every authenticated user can see (e.g. Dashboard). */
  module?: PermissionModule;
  /** Defaults to "read" — set "write" for items that need edit access, not just visibility. */
  action?: PermissionAction;
  /**
   * "entity" hides the item from cross-entity roles (System Admin, Center
   * Supervisor) — for concepts scoped to a single organization. "crossEntity"
   * is the inverse — for platform-wide screens those roles alone should see.
   * Omit for items every role's scope should see the same way.
   */
  scope?: "entity" | "crossEntity";
}

/** Every nav item the app has, keyed by `labelKey`. Order here is irrelevant —
 * actual display order per role comes from `NAV_ORDER_BY_ROLE` below. */
export const appNav: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard },
  // No `scope`: cross-entity roles read studies too — the Center Supervisor's
  // oversight view (FR-11) is the same list, widened to every organisation.
  { labelKey: "studies", href: "/studies", icon: ClipboardList, module: "studySurvey" },
  {
    labelKey: "publicSurveys",
    href: "/public-surveys",
    icon: QrCode,
    module: "studySurvey",
  },
  {
    labelKey: "methodologyConfig",
    href: "/settings/methodology",
    icon: ListTree,
    module: "methodologyQuestionBank",
  },
  // Question Bank + AI-assisted questionnaire design — its own independent
  // methodology feature, not a Study feature, hence its own module rather
  // than being nested under a Study or gated on studySurvey.
  {
    labelKey: "surveyBuilder",
    href: "/survey-builder",
    icon: ClipboardEdit,
    module: "surveyBuilder",
  },
  {
    labelKey: "priorityDashboard",
    href: "/priority-dashboard",
    icon: Gauge,
    module: "priorityScoring",
  },
  {
    labelKey: "reports",
    href: "/reports",
    icon: BarChart3,
    module: "reportsDashboards",
  },
  {
    labelKey: "archive",
    href: "/archive",
    icon: Archive,
    module: "archiveSharingAudit",
  },
  {
    labelKey: "sharing",
    href: "/sharing",
    icon: Share2,
    module: "archiveSharingAudit",
  },
  {
    // RIO-FR-002. Gated on `dataQuality` rather than `dataImport`: the queue
    // is a reviewer surface, and dataImport is held by the roles that create
    // the data rather than the ones the client put decisions with (Q23).
    labelKey: "dataQuality",
    href: "/data-quality",
    icon: ShieldCheck,
    module: "dataQuality",
  },
  {
    labelKey: "initiatives",
    href: "/initiatives",
    icon: Milestone,
    module: "initiatives",
  },
  {
    labelKey: "reviewerSla",
    href: "/reviewer-sla",
    icon: AlarmClock,
    // Was "aiReview" — a permission several roles hold for unrelated
    // reasons (classification-decision read access), which leaked this
    // nav item to roles that can't act on anything it shows (data_analyst,
    // read_only_viewer, center_supervisor, system_admin all hold
    // aiReview:read). surveyBuilder:read is what the two roles that
    // actually belong here (Research Officer, Reviewer/Approver) hold —
    // see ReviewerSlaService.listAlerts, which branches on which one you
    // are to decide what you actually see.
    module: "surveyBuilder",
  },
  {
    labelKey: "organization",
    href: "/settings/organization",
    icon: Building2,
    module: "entityTeam",
    scope: "entity",
  },
  {
    labelKey: "organizations",
    href: "/settings/organizations",
    icon: Building2,
    module: "entityTeam",
    scope: "crossEntity",
  },
  {
    labelKey: "roles",
    href: "/settings/roles",
    icon: ShieldCheck,
    module: "rolesPermissions",
  },
  {
    labelKey: "users",
    href: "/settings/users",
    icon: Users2,
    module: "entityTeam",
  },
  {
    labelKey: "audit",
    href: "/settings/audit",
    icon: ScrollText,
    module: "archiveSharingAudit",
  },
  // RIO-NFR-016 — operational log. A separate item from "audit" on purpose:
  // different data (system errors vs business events), different permission
  // (systemLogs, held by System Admin alone), different audience. crossEntity
  // because it is a platform-wide screen, not an org one.
  {
    labelKey: "systemLogs",
    href: "/system-admin/system-logs",
    icon: Terminal,
    module: "systemLogs",
    scope: "crossEntity",
  },
  // RIO-NFR-010 — backups. Its own item next to System Logs and for the same
  // reasons: platform infrastructure rather than tenant data, and its own
  // permission module (`backups`, not `systemLogs`, which has no write action
  // for anyone by design).
  // Hidden on request — commented out here rather than in NAV_ORDER_BY_ROLE
  // because the mobile nav (app-topbar.tsx) filters `appNav` by permission
  // alone and never consults the per-role order, so this is the one place that
  // hides the item on every surface. Uncomment to restore.
  // {
  //   labelKey: "backups",
  //   href: "/system-admin/backups",
  //   icon: DatabaseBackup,
  //   module: "backups",
  //   scope: "crossEntity",
  // },
];

/**
 * Explicit per-role menu order — the sidebar walks each role's own list
 * top-to-bottom rather than filtering one shared array, so "which order does
 * X role see its menu in" is answered by reading this config, not by
 * reverse-engineering permission side-effects. Permission checks in
 * app-sidebar.tsx still apply on top of this (fail-closed): an item listed
 * here that the role doesn't actually hold the permission for is still
 * hidden, so a stale/wrong entry here can only under-show, never over-show.
 *
 * Deliberately omits items the role has no real reason to land on first.
 */
export const NAV_ORDER_BY_ROLE: Record<string, string[]> = {
  // Client-confirmed order (Aug 13): Dashboard, then Organization, then
  // Users. "roles" is deliberately never listed here — NGO Admin holds no
  // rolesPermissions grant at all per the confirmed matrix, so it would
  // only ever be filtered back out by isPermitted's fail-closed check;
  // listing it anyway was dead weight that muddied the intended order.
  ngo_admin: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
    "dataQuality",
    "initiatives",
    "reviewerSla",
    "audit",
    // Client-confirmed (2026-08-20): Methodology Configuration belongs at
    // NCNP Admin (System Admin) level only — removed from NGO Admin's nav.
  ],
  // Audit fix (Aug 13): every role's list below was cross-checked against
  // its actual role-matrix.ts grants — several roles (most whose grants
  // were widened earlier this session — Field Researcher, Data Analyst,
  // Read-only Viewer, System Reviewer, Center Supervisor, plus System
  // Admin) held real read access to a module with no matching nav entry at
  // all, meaning the permission was real but there was no sidebar path to
  // reach it. isPermitted's fail-closed check only ever protects against
  // *over*-listing (a listed item the role can't actually use gets hidden);
  // it does nothing for *under*-listing, which is exactly this bug class.
  // Rule applied uniformly below: if a role holds real `read` on a
  // module, its nav item is listed — no silent gaps.
  ngo_research_officer: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "dataQuality",
    "initiatives",
    "reviewerSla",
    "methodologyConfig",
  ],
  field_researcher: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "reports",
    "dataQuality",
    "reviewerSla",
    "methodologyConfig",
  ],
  human_reviewer: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "initiatives",
    "reviewerSla",
    "methodologyConfig",
  ],
  data_analyst: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "publicSurveys",
    "surveyBuilder",
    "priorityDashboard",
    // RIO-FR-002 Q23 puts data-quality decisions and threshold tuning with
    // this role, so it sits with the analytical screens rather than last.
    "dataQuality",
    "reports",
    "initiatives",
    "methodologyConfig",
  ],
  system_admin: [
    "dashboard",
    "organizations",
    "users",
    "roles",
    "studies",
    "publicSurveys",
    "surveyBuilder",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
    "dataQuality",
    "initiatives",
    "reviewerSla",
    "audit",
    "systemLogs",
    // RIO-NFR-010 — "backups" hidden from the sidebar on request. The screen,
    // its service and its permission module are untouched; restore the entry
    // here (and in system_reviewer below) to bring it back.
    // "backups",
    "methodologyConfig",
  ],
  read_only_viewer: [
    "dashboard",
    "organization",
    "users",
    "studies",
    "publicSurveys",
    "surveyBuilder",
    "priorityDashboard",
    "reports",
    "initiatives",
    "methodologyConfig",
    "dataQuality",
  ],
  // Center Supervisor (NCNP Supervisor) — RIO-RBAC-001 (client-confirmed):
  // this is now the single combined role for what was previously two
  // separate roles (Program Supervisor / NCNP User). "reports" already
  // covers the NCNP Compiled Report (folded into the unified /reports page,
  // Category: Consolidated) since this role holds real reportsDashboards
  // read+export access — unlike the old ncnp_user role, which had no grant
  // on reportsDashboards at all and so had no way to actually reach it.
  center_supervisor: [
    "dashboard",
    "organizations",
    "users",
    "studies",
    "publicSurveys",
    "surveyBuilder",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
    "initiatives",
    "audit",
    "methodologyConfig",
    "dataQuality",
  ],
  // System Reviewer — reviews the NCNP Compiled Report (approve/reject with
  // mandatory notes) via the unified /reports page (Category: Consolidated),
  // plus read-only access to Organization/Users, Needs, Surveys, and
  // Documents per the client's scope. No dedicated NCNP nav item — reduces
  // sidebar clutter per the client's explicit ask.
  system_reviewer: [
    "dashboard",
    "organizations",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "methodologyConfig",
    "dataQuality",
    // RIO-NFR-010 — hidden from the sidebar; see the note in system_admin.
    // "backups",
  ],
};
