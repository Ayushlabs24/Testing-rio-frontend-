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
    | "citizen_guest";
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

function fullAccess(): ModulePermission[] {
  return PERMISSION_MODULES.map((module) =>
    perm(module, {
      read: true,
      write: true,
      create: true,
      approve: true,
      export: true,
      share: true,
    }),
  );
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
 * below): nobody has finalized how most of the 9 roles actually behave yet,
 * so only 4 are `enabled` for the current demo — NGO Admin, Research
 * Officer, Reviewer / Approver, and Program Supervisor. The other 5 (System
 * Admin, Field Researcher, Data Analyst, Read-only Viewer, Citizen Guest) stay fully
 * defined below with `enabled: false` — permissions exist, workflow
 * doesn't, so there's nothing to build for them yet, but nothing is
 * deleted either. There is now a public NGO signup (see
 * `authService.signup()`) that creates an organization and its first NGO
 * Admin together — this replaces the System-Admin-only
 * org-creation path described below. Since System Admin is disabled
 * (`enabled: false`) and has no other reachable entry point, the write-only
 * code that path used (`organizationsService.createWithAdmin`/`updateById`,
 * `usersService.createForOrganization`/`updateAny`/`removeAny`, and the
 * System Admin-only UI in the Organizations/Users settings pages) has been
 * removed outright rather than just gated off. Center Supervisor's
 * cross-entity *read* access (Organizations list/detail, Users platform-wide
 * list) is unrelated to this and stays fully real and working.
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
  {
    id: "role_ngo_admin",
    key: "ngo_admin",
    name: "NGO Admin",
    description: "Account owner. Full access to every module within its own entity.",
    crossEntity: false,
    enabled: true,
    permissions: fullAccess(),
  },
  {
    id: "role_ngo_research_officer",
    key: "ngo_research_officer",
    name: "Research Officer",
    description: "Creates studies and surveys from the question bank and enters data.",
    crossEntity: false,
    enabled: true,
    permissions: [
      perm("entityTeam"),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", { read: true, write: true, create: true, export: true }),
      perm("dataCollection", { read: true, write: true, create: true }),
      perm("dataImport", { read: true, write: true, create: true }),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", READ_ONLY),
      perm("reportsDashboards", { read: true, export: true }),
      // Read-only Archive + able to request cross-org Sharing access (the
      // owning org's admin still has to approve).
      perm("archiveSharingAudit", { read: true, create: true }),
      // The role responsible for creating and managing questionnaires.
      perm("surveyBuilder", { read: true, write: true, create: true }),
    ],
  },
  {
    id: "role_field_researcher",
    key: "field_researcher",
    name: "Field Researcher",
    description: "Enters needs and documents the source and field notes.",
    crossEntity: false,
    enabled: false,
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
    ],
  },
  {
    id: "role_human_reviewer",
    key: "human_reviewer",
    name: "Reviewer / Approver",
    description:
      "Approves or modifies AI classification, priority, and duplicates before publishing.",
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
      perm("citizenChannel", READ_ONLY),
      perm("aiReview", { read: true, write: true, approve: true }),
      perm("priorityScoring", READ_ONLY),
      // Reviewer's work starts at Studies/Reviewer-SLA, not an executive
      // dashboard, but still needs read access to Reports/Archive/Sharing
      // once a study's classification/review work is done.
      perm("reportsDashboards", READ_ONLY),
      perm("archiveSharingAudit", READ_ONLY),
      perm("surveyBuilder"),
    ],
  },
  {
    id: "role_data_analyst",
    key: "data_analyst",
    name: "Data Analyst",
    description: "Processes data, reviews quality, and prepares reports and dashboards.",
    crossEntity: false,
    enabled: false,
    permissions: [
      perm("entityTeam"),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", READ_ONLY),
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
    ],
  },
  {
    id: "role_system_admin",
    key: "system_admin",
    name: "System Admin",
    description:
      "Manages accounts, roles, permissions, audit log, and configuration settings.",
    crossEntity: true,
    enabled: false,
    permissions: [
      // Write is deliberately narrow — confirmed directly by the team lead:
      // System Admin can create a user and create a new organization, full
      // stop. Every other module (including this one, beyond that) is
      // view-only, not general admin write access.
      perm("entityTeam", { read: true, write: true, create: true, export: true }),
      // Fixed role set — System Admin can view the matrix, not edit it.
      perm("rolesPermissions", READ_ONLY),
      perm("onboardingConsent", READ_ONLY),
      // Seeded once from a buyer-supplied dataset; read-only in this phase.
      perm("methodologyQuestionBank", READ_ONLY),
      // Sees every entity's data (confirmed by the team lead) but doesn't
      // edit it directly — write stays scoped to accounts/orgs/config, not
      // study content itself.
      perm("studySurvey", READ_ONLY),
      perm("dataCollection", READ_ONLY),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel", READ_ONLY),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", READ_ONLY),
      perm("reportsDashboards", READ_ONLY),
      perm("archiveSharingAudit", READ_ONLY),
      perm("surveyBuilder"),
    ],
  },
  {
    id: "role_read_only_viewer",
    key: "read_only_viewer",
    name: "Read-only Viewer",
    description: "Views authorized outputs without editing.",
    crossEntity: false,
    enabled: false,
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
    ],
  },
  {
    id: "role_center_supervisor",
    key: "center_supervisor",
    name: "Program Supervisor",
    description:
      "Cross-entity supervisory authority to follow studies, data, and reports for quality.",
    crossEntity: true,
    enabled: true,
    permissions: [
      perm("entityTeam", READ_ONLY),
      perm("rolesPermissions"),
      perm("onboardingConsent"),
      perm("methodologyQuestionBank", READ_ONLY),
      // "Edit — Per approved permission only" per new scope.md §3: not full
      // CRUD (no create), but a real, limited edit capability — modeled as
      // write without create, same as the Reviewer's aiReview permission.
      perm("studySurvey", { read: true, write: true, export: true }),
      perm("dataCollection", READ_ONLY),
      perm("dataImport", READ_ONLY),
      perm("citizenChannel"),
      perm("aiReview", READ_ONLY),
      perm("priorityScoring", READ_ONLY),
      perm("reportsDashboards", { read: true, export: true }),
      perm("archiveSharingAudit", READ_ONLY),
      perm("surveyBuilder"),
    ],
  },
  {
    id: "role_citizen_guest",
    key: "citizen_guest",
    name: "Citizen / Beneficiary Guest",
    description:
      "Submits a need as a data source via OTP; not added before human review.",
    crossEntity: false,
    enabled: false,
    permissions: PERMISSION_MODULES.map((module) =>
      module === "citizenChannel" ? perm(module, { create: true }) : perm(module),
    ),
  },
];
