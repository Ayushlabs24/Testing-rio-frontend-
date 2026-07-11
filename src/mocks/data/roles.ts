import {
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionModule,
} from "@/types/permissions";

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
 * NGO Admin is an entity's account-owner role, but there's no public
 * self-signup in this phase — confirmed by the team lead, System Admin is
 * seeded directly (not created through any UI) and is the only path to a
 * new organization: creating one also creates that org's first NGO Admin
 * in the same action (see `organizationsService.createWithAdmin`).
 *
 * System Admin and Center Supervisor are not scoped to a single
 * organization (System Admin sees every entity's data — also confirmed by
 * the team lead — but its write access stays limited to accounts/orgs/
 * config, not study content; Center Supervisor has cross-entity
 * read/follow). Citizen/Beneficiary Guest is a public,
 * unauthenticated data source, not an account — it's modeled here for
 * completeness of the permission matrix, but isn't wired into the normal
 * login flow or the Users CRUD screen (see users.ts).
 */
export const roles: Role[] = [
  {
    id: "role_ngo_admin",
    key: "ngo_admin",
    name: "NGO Admin",
    description: "Account owner. Full access to every module within its own entity.",
    crossEntity: false,
    permissions: fullAccess(),
  },
  {
    id: "role_ngo_research_officer",
    key: "ngo_research_officer",
    name: "NGO Research Officer",
    description: "Creates studies and surveys from the question bank and enters data.",
    crossEntity: false,
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
      perm("archiveSharingAudit"),
    ],
  },
  {
    id: "role_field_researcher",
    key: "field_researcher",
    name: "Field Researcher",
    description: "Enters needs and documents the source and field notes.",
    crossEntity: false,
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
    ],
  },
  {
    id: "role_human_reviewer",
    key: "human_reviewer",
    name: "Human Reviewer",
    description:
      "Approves or modifies AI classification, priority, and duplicates before publishing.",
    crossEntity: false,
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
      perm("reportsDashboards"),
      perm("archiveSharingAudit"),
    ],
  },
  {
    id: "role_data_analyst",
    key: "data_analyst",
    name: "Data Analyst",
    description: "Processes data, reviews quality, and prepares reports and dashboards.",
    crossEntity: false,
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
    ],
  },
  {
    id: "role_system_admin",
    key: "system_admin",
    name: "System Admin",
    description:
      "Manages accounts, roles, permissions, audit log, and configuration settings.",
    crossEntity: true,
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
    ],
  },
  {
    id: "role_read_only_viewer",
    key: "read_only_viewer",
    name: "Read-only Viewer",
    description: "Views authorized outputs without editing.",
    crossEntity: false,
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
    ],
  },
  {
    id: "role_center_supervisor",
    key: "center_supervisor",
    name: "Center Supervisor",
    description:
      "Cross-entity supervisory authority to follow studies, data, and reports for quality.",
    crossEntity: true,
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
      perm("priorityScoring", READ_ONLY),
      perm("reportsDashboards", { read: true, export: true }),
      perm("archiveSharingAudit", READ_ONLY),
    ],
  },
  {
    id: "role_citizen_guest",
    key: "citizen_guest",
    name: "Citizen / Beneficiary Guest",
    description:
      "Submits a need as a data source via OTP; not added before human review.",
    crossEntity: false,
    permissions: PERMISSION_MODULES.map((module) =>
      module === "citizenChannel" ? perm(module, { create: true }) : perm(module),
    ),
  },
];
