import {
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionModule,
} from "@/types/permissions";

// NOTE: real sessions now resolve `permissions`/`crossEntity` straight from
// the backend's own login/me response (see auth.service.ts's
// toSessionContextFromApi) — this file is only consulted for `name`
// (product-copy renames the backend doesn't track) and `enabled` (a UI-only
// "is this role live" gate that doesn't exist server-side). The permissions
// arrays below are otherwise unused by real sessions, but are kept in sync
// with Project-RIO-Backend/src/rbac/role-matrix.ts anyway — for the
// mock-only verifyOtp/giveConsent paths, and so this file stays a truthful
// reference rather than a stale, unused copy.

export interface Role {
  id: string;
  key:
    | "ngo_admin"
    | "ngo_research_officer"
    | "field_researcher"
    | "human_reviewer"
    | "data_analyst"
    | "system_admin"
    | "read_only_viewer"
    | "center_supervisor"
    | "citizen_guest"
    | "system_reviewer";
  name: string;
  description: string;
  /** Entity-scoped roles see only their own organization's data; these two don't. */
  crossEntity: boolean;
  /**
   * Whether this role is assignable/visible right now. All 9 roles from
   * `new scope.md` stay fully defined here regardless — nothing is
   * commented out or deleted — this just gates which ones are live for the
   * current demo phase. This is deliberately a UI-only gate, not an
   * authentication one: a disabled role can still log in (session/JWT
   * issued normally), but every module-scoped page/action is hidden
   * (`usePermission`, `PermissionGuard`, nav filtering — see
   * hooks/use-permission.ts) so there's nothing reachable once in. Mixing
   * "is this role live" into login itself would make feature rollout look
   * like an auth failure, and would need undoing the moment a role comes
   * back. Flip to `true` to bring a role back — no other code changes
   * needed.
   */
  enabled: boolean;
  permissions: ModulePermission[];
}

interface AccessGrant {
  read?: boolean;
  write?: boolean;
  create?: boolean;
  approve?: boolean;
  export?: boolean;
  share?: boolean;
}

/** Every flag defaults to `false` — only the ones a role actually has need naming. */
function perm(module: PermissionModule, grant: AccessGrant = {}): ModulePermission {
  return {
    module,
    read: grant.read ?? false,
    write: grant.write ?? false,
    create: grant.create ?? false,
    approve: grant.approve ?? false,
    export: grant.export ?? false,
    share: grant.share ?? false,
  };
}

const READ_ONLY: AccessGrant = { read: true };

/**
 * Fixed, non-editable role set — the 9 roles defined in `new scope.md`
 * §3 "Roles & Permissions", carrying the document's full access criteria
 * (View / Create / Edit / Approve / Export / Share) per module, not just a
 * binary read/write. Nothing in that document describes creating a custom
 * role; this matrix is the whole of what's configurable, and it lives in
 * this one file, not scattered through UI code.
 *
 * `rolesPermissions` itself is never writable by any role, including
 * System Admin — both `new scope.md` and the earlier vendor PRD agree the
 * role set is fixed, with no in-app role-authoring capability this phase.
 *
 * PIVOT (per team lead, superseding the System-Admin-onboards-NGOs model
 * below): all 10 roles are now `enabled` — NGO Admin, NGO Research Officer,
 * Human Reviewer, Field Researcher, Data Analyst, Read-only Viewer, System
 * Admin, Center Supervisor (NCNP Supervisor), System Reviewer, and Citizen /
 * Beneficiary Guest (the last has no login path regardless — see its own
 * note below — so `enabled` on it only affects whether it's listed, not
 * whether anyone can act as it). There is now a public NGO signup (see
 * `authService.signup()`) that creates an organization and its first NGO
 * Admin together — this replaces the System-Admin-only
 * org-creation path described below. Center Supervisor's cross-entity
 * *read* access (Organizations list/detail, Users platform-wide list) is
 * unrelated to this and stays fully real and working.
 *
 * The rest of this comment describes the original (pre-pivot) design,
 * which the `enabled` flag above supersedes for now:
 *
 * NGO Admin is an entity's account-owner role. System Admin and Center
 * Supervisor are not scoped to a single organization (System Admin sees
 * every entity's data — confirmed by the team lead — but its write access
 * stays limited to accounts/orgs/config, not study content; Center
 * Supervisor has cross-entity read/follow). Citizen/Beneficiary Guest is a
 * public, unauthenticated data source, not an account — it's modeled here
 * for completeness of the permission matrix, but isn't wired into the
 * normal login flow or the Users CRUD screen (see users.ts).
 */
export const roles: Role[] = [
  // RIO-RBAC-001 module-permission matrix (client-confirmed, Aug 11): NGO
  // Admin is no longer "full access to every module in its own entity" —
  // Roles & Permissions and the Audit Log are System-Admin-exclusive now,
  // and Approve on Studies/Needs/Surveys/Reports moved to Human Reviewer
  // alone. Mirrors Project-RIO-Backend/src/rbac/role-matrix.ts exactly.
  {
    id: "role_ngo_admin",
    key: "ngo_admin",
    name: "NGO Admin",
    description:
      "Account owner — manages its own entity, teams, and studies, with approval/report-authoring held by other roles.",
    crossEntity: false,
    enabled: true,
    permissions: [
      // Organization (view+edit, no create) and Users (view+create+edit)
      // share the same entityTeam module in code — union of the two columns.
      perm("entityTeam", { read: true, write: true, create: true }),
      perm("rolesPermissions"),
      perm("onboardingConsent", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", {
        read: true,
        write: true,
        create: true,
        export: true,
        share: true,
      }),
      perm("dataCollection", { read: true, write: true, create: true, export: true }),
      perm("dataImport", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("citizenChannel", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("aiReview", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("priorityScoring", { read: true, export: true }),
      perm("reportsDashboards", { read: true, export: true, share: true }),
      // Module-conflict note (see backend role-matrix.ts for the full
      // explanation): the matrix gives NGO Admin Share on Studies/Reports
      // but no Audit/System Logs access — both Sharing decisions and the
      // Audit Log share this exact module and the exact `read` action in
      // code. Sharing (pre-existing, tested FR-014) took priority; `export`
      // (the audit CSV download) stays off.
      perm("archiveSharingAudit", { read: true, create: true, approve: true }),
      perm("surveyBuilder", { read: true, write: true, create: true, export: true }),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_ngo_research_officer",
    key: "ngo_research_officer",
    name: "NGO Research Officer",
    description: "Creates studies and surveys from the question bank and enters data.",
    crossEntity: false,
    enabled: true,
    permissions: [
      // RIO-RBAC-001 matrix: view-only on Organization/Users now (was none).
      perm("entityTeam", READ_ONLY),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      // No `export` on Studies per the confirmed matrix (Researcher: V/C/E).
      perm("studySurvey", { read: true, write: true, create: true }),
      perm("dataCollection", { read: true, write: true, create: true }),
      perm("dataImport", { read: true, write: true, create: true }),
      perm("citizenChannel"),
      perm("aiReview", { read: true, write: true }),
      perm("priorityScoring", READ_ONLY),
      // RIO-RBAC-001 matrix, refined (Aug 12, client-confirmed): Researcher
      // holds View/Create/Edit on Reports — restores "create and confirm
      // your own draft" as one role's job, with Human Reviewer as the
      // independent approver. See backend role-matrix.ts's comment on this
      // exact grant for the full reasoning.
      perm("reportsDashboards", { read: true, create: true, write: true }),
      // Matrix: no Audit/System Logs access at all for this role — this
      // previously doubled as "can request cross-org Sharing," which is
      // removed as a side effect (see backend role-matrix.ts's flag).
      perm("archiveSharingAudit"),
      // `create` added per the confirmed matrix (Researcher: V/C/E).
      perm("surveyBuilder", { read: true, write: true, create: true }),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_field_researcher",
    key: "field_researcher",
    name: "Field Researcher",
    description: "Enters needs and documents the source and field notes.",
    crossEntity: false,
    enabled: true,
    permissions: [
      perm("entityTeam"),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", { read: true, write: true, create: true }),
      perm("dataImport"),
      perm("citizenChannel"),
      perm("aiReview"),
      perm("priorityScoring"),
      perm("reportsDashboards"),
      perm("archiveSharingAudit"),
      perm("surveyBuilder"),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_human_reviewer",
    key: "human_reviewer",
    name: "Human Reviewer",
    description:
      "Approves or modifies AI classification, priority, and duplicates before publishing.",
    crossEntity: false,
    enabled: true,
    permissions: [
      // RIO-RBAC-001 matrix: view-only on Organization/Users now (was none).
      perm("entityTeam", READ_ONLY),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      // Matrix: Studies = View + Approve only now — the `create` grant that
      // let this role generate public links itself is removed.
      perm("studySurvey", { read: true, approve: true }),
      // Matrix: Needs = View + Approve (was view-only).
      perm("dataCollection", { read: true, approve: true }),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel", READ_ONLY),
      perm("aiReview", { read: true, approve: true }),
      perm("priorityScoring", READ_ONLY),
      // Reviewer's work starts at Studies/Reviewer-SLA, not an executive
      // dashboard, but still needs read access to Reports once a study's
      // classification/review work is done. Matrix: Reports = V/Ap/Ex.
      perm("reportsDashboards", { read: true, approve: true, export: true }),
      // Matrix: no Audit/System Logs access for this role (was read-only).
      perm("archiveSharingAudit"),
      // RIO-RBAC-001 matrix (Aug 11, client-confirmed): Surveys = View +
      // Approve only — `write` (question curation) is REMOVED here,
      // reversing an earlier product decision that this role also curates
      // questions alongside the Researcher. See the flagged comment on the
      // matching line in the backend's role-matrix.ts.
      perm("surveyBuilder", { read: true, approve: true }),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_data_analyst",
    key: "data_analyst",
    name: "Data Analyst",
    description: "Processes data, reviews quality, and prepares reports and dashboards.",
    crossEntity: false,
    enabled: true,
    permissions: [
      perm("entityTeam"),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      // RIO-DATA-003 (client-requested widening): Data Analyst can create
      // Needs directly, alongside NGO Research Officer/Field Researcher —
      // a temporary widening, not a permanent role-scope decision.
      perm("dataCollection", { read: true, write: true, create: true }),
      perm("dataImport", { read: true, write: true, create: true }),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
      }),
      perm("reportsDashboards", { read: true, write: true, create: true, export: true }),
      perm("archiveSharingAudit", READ_ONLY),
      perm("surveyBuilder"),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_system_admin",
    key: "system_admin",
    name: "System Admin",
    description:
      "Manages accounts, roles, permissions, audit log, and configuration settings.",
    crossEntity: true,
    enabled: true,
    permissions: [
      perm("entityTeam", { read: true, write: true, create: true, export: true }),
      // RIO-RBAC-001 matrix (Aug 11): System Admin gets real write/create on
      // Roles & Permissions, Studies, Needs, Survey Builder, Question Bank
      // and Reports now — this role was previously read-only on almost
      // everything outside its own Administration/Audit scope.
      perm("rolesPermissions", { read: true, write: true, create: true }),
      perm("onboardingConsent", READ_ONLY),
      perm("methodologyQuestionBank", { read: true, write: true, create: true }),
      perm("studySurvey", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("dataCollection", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel", READ_ONLY),
      perm("aiReview", READ_ONLY),
      // `export` added per the confirmed matrix (System Admin/Dashboard: V/Ex).
      perm("priorityScoring", { read: true, export: true }),
      perm("reportsDashboards", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      // RIO-FR-007 — read + export, mirroring the backend role matrix: the
      // role the BRD names as managing the audit log must be able to download
      // it, not just view it. Export is the only action added; Archive stays
      // view-only and Sharing's create/approve are still withheld.
      perm("archiveSharingAudit", { read: true, export: true }),
      perm("surveyBuilder", {
        read: true,
        write: true,
        create: true,
        approve: true,
        export: true,
        share: true,
      }),
      // Generate a new NCNP Compiled Report snapshot for review, and publish
      // one a System Reviewer has already approved — `write` covers both;
      // this role never Approves/Rejects itself (that's system_reviewer's
      // `approve` bit).
      perm("ncnpReport", { read: true, write: true }),
    ],
  },
  {
    id: "role_read_only_viewer",
    key: "read_only_viewer",
    name: "Read-only Viewer",
    description: "Views authorized outputs without editing.",
    crossEntity: false,
    enabled: true,
    permissions: [
      perm("entityTeam"),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", READ_ONLY),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", READ_ONLY),
      // "Export — per availability" in the doc: modeled as granted by default.
      perm("reportsDashboards", { read: true, export: true }),
      perm("archiveSharingAudit", READ_ONLY),
      perm("surveyBuilder"),
      perm("ncnpReport"),
    ],
  },
  // RIO-RBAC-001 (client-confirmed): "Center supervisor / NCNP supervisor"
  // is one combined role, not two — the old separate "NCNP User" role
  // (role_ncnp_user) is retired here too, matching the backend consolidation.
  // Client's answer: cross-entity view/follow authority only, no edit rights
  // on entity data — the old studySurvey write grant below is removed to
  // match ("Edit — Per approved permission only" from an earlier scope.md
  // note no longer applies now that the client has confirmed read-only).
  {
    id: "role_center_supervisor",
    key: "center_supervisor",
    name: "Center Supervisor (NCNP Supervisor)",
    description:
      "Cross-entity view/follow authority to monitor studies, data, reports and the NCNP Compiled Report — no edit rights on entity data.",
    crossEntity: true,
    enabled: true,
    permissions: [
      perm("entityTeam", READ_ONLY),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", READ_ONLY),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      // `export` added per the confirmed matrix (Center Supervisor/Dashboard: V/Ex).
      perm("priorityScoring", { read: true, export: true }),
      perm("reportsDashboards", { read: true, export: true }),
      // `export` added per the confirmed matrix (Center Supervisor/Audit: V/Ex).
      perm("archiveSharingAudit", { read: true, export: true }),
      // `read` added per the confirmed matrix (Center Supervisor/Surveys: V) —
      // this role previously had zero access to Survey Builder, not even view.
      perm("surveyBuilder", READ_ONLY),
      perm("ncnpReport"),
    ],
  },
  {
    id: "role_system_reviewer",
    key: "system_reviewer",
    name: "System Reviewer",
    description:
      "Reviews the NCNP Compiled Report — approves or rejects (with mandatory notes) before System Admin publishes it. Read-only everywhere else.",
    crossEntity: true,
    enabled: true,
    permissions: [
      // RIO-RBAC-001 matrix: view-only on Organization/Users now (was none).
      perm("entityTeam", READ_ONLY),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", READ_ONLY),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", READ_ONLY),
      // ⚠️ Deliberately NOT literally matching the confirmed matrix here —
      // it lists Reports = V/Ap/Ex, but `approve` is withheld: this module
      // (reportsDashboards) is the general RPT01-14 Reports feature, not the
      // NCNP Compiled Report (that's the separate `ncnpReport` module below,
      // which already grants this role `approve`). Granting reportsDashboards
      // approve has no additional crossEntity scoping on the backend, so it
      // would let a System Reviewer approve/reject/archive any org's general
      // reports — see the matching flagged comment in the backend's
      // role-matrix.ts. Recommend confirming with the client whether
      // "Reports: Approve" meant the NCNP report specifically before
      // granting this literally.
      perm("reportsDashboards", { read: true, export: true }),
      perm("archiveSharingAudit"),
      perm("surveyBuilder", READ_ONLY),
      perm("ncnpReport", { read: true, approve: true }),
    ],
  },
  {
    // Last by design, not just array order — it's not an internal
    // application role (no login path, see LOGIN_ROLE_KEYS on the backend),
    // so it's kept after every real staff role rather than interleaved
    // among them. The Roles page also hides its "View Details" button for
    // the same reason — with only citizenChannel granted below and every
    // other module empty, the detail sheet would be almost entirely "None"
    // rows for a role that never actually logs in to see them.
    id: "role_citizen_guest",
    key: "citizen_guest",
    name: "Citizen / Beneficiary Guest",
    description:
      "Responds to surveys through OTP verification; no internal application access.",
    crossEntity: false,
    enabled: true,
    permissions: PERMISSION_MODULES.map((module) =>
      module === "citizenChannel" ? perm(module, { create: true }) : perm(module),
    ),
  },
];
