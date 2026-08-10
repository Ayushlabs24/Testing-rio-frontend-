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
  QrCode,
  ScrollText,
  Share2,
  Terminal,
  ShieldCheck,
  Users2,
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
  ngo_admin: [
    "dashboard",
    "organization",
    "roles",
    "users",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
    "reviewerSla",
    "audit",
    "methodologyConfig",
  ],
  ngo_research_officer: [
    "dashboard",
    "studies",
    "surveyBuilder",
    "publicSurveys",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
  ],
  field_researcher: ["dashboard", "studies", "publicSurveys"],
  human_reviewer: [
    "dashboard",
    "studies",
    "reviewerSla",
    "publicSurveys",
    "reports",
    "archive",
  ],
  data_analyst: [
    "dashboard",
    "studies",
    "priorityDashboard",
    "reports",
    "archive",
    "sharing",
    "methodologyConfig",
  ],
  system_admin: [
    "dashboard",
    "organizations",
    "users",
    "roles",
    "studies",
    "publicSurveys",
    "reports",
    "archive",
    "reviewerSla",
    "audit",
    "systemLogs",
    "methodologyConfig",
  ],
  read_only_viewer: ["dashboard", "studies", "priorityDashboard", "reports", "archive"],
  // Program Supervisor.
  center_supervisor: [
    "dashboard",
    "organizations",
    "priorityDashboard",
    "reports",
    "sharing",
    "audit",
  ],
  // National Council for NGO Partnerships — sees the NCNP Compiled Report,
  // now folded into the unified /reports page (Category: Consolidated).
  // NOTE: this role otherwise holds no module permissions at all (see
  // role-matrix.ts) — it currently has no grant on `reportsDashboards`
  // either, so it has no way to actually reach /reports post-consolidation.
  // Flagged for the team to confirm: either grant read-only
  // `reportsDashboards` (which would also expose RPT01-14 NGO reports to
  // this role, not just the Consolidated ones), or add a role-specific
  // filter on the reports page. Left as-is until that's decided.
  ncnp_user: ["dashboard"],
  // System Reviewer — reviews the NCNP Compiled Report (approve/reject with
  // mandatory notes) via the unified /reports page (Category: Consolidated),
  // plus read-only access to Needs, Surveys, and Documents per the client's
  // scope. No dedicated NCNP nav item — reduces sidebar clutter per the
  // client's explicit ask.
  system_reviewer: ["dashboard", "studies", "surveyBuilder", "reports"],
};
