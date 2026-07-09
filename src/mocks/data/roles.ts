import {
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionModule,
} from "@/types/permissions";

export interface Role {
  id: string;
  key: "org_admin" | "research_officer" | "reviewer_approver" | "program_supervisor";
  name: string;
  description: string;
  permissions: ModulePermission[];
}

function perm(module: PermissionModule, read: boolean, write: boolean): ModulePermission {
  return { module, read, write };
}

/**
 * Fixed, non-editable role set. Org Admin is not part of scope.md's three
 * operational roles — it exists purely for the account-owner/org-creator
 * use case (whoever signs up and creates the organization).
 *
 * Research Officer / Reviewer-Approver / Program Supervisor default
 * read/write per module follows scope.md's governed-AI-loop design (AD-2):
 * officers draft, reviewers approve, supervisors get cross-org read-only
 * oversight (AD-15). This matrix is a seed — adjust the cells below if the
 * team wants different defaults, nothing else in the app needs to change.
 */
export const roles: Role[] = [
  {
    id: "role_org_admin",
    key: "org_admin",
    name: "Org Admin",
    description: "Account owner. Full access to every module in the organization.",
    permissions: PERMISSION_MODULES.map((module) => perm(module, true, true)),
  },
  {
    id: "role_research_officer",
    key: "research_officer",
    name: "Research Officer",
    description: "Field researcher. Drafts needs, surveys and evidence.",
    permissions: [
      perm("organization", false, false),
      perm("usersRoles", false, false),
      perm("onboarding", true, true),
      perm("needs", true, true),
      perm("surveys", true, true),
      perm("collection", true, false),
      perm("evidence", true, true),
      perm("aiReview", true, false),
      perm("reports", true, false),
      perm("sharing", false, false),
      perm("supervisorOversight", false, false),
      perm("audit", false, false),
    ],
  },
  {
    id: "role_reviewer_approver",
    key: "reviewer_approver",
    name: "Reviewer / Approver",
    description: "Reviews AI suggestions and approves work before release.",
    permissions: [
      perm("organization", true, false),
      perm("usersRoles", true, false),
      perm("onboarding", true, false),
      perm("needs", true, true),
      perm("surveys", true, true),
      perm("collection", true, false),
      perm("evidence", true, false),
      perm("aiReview", true, true),
      perm("reports", true, true),
      perm("sharing", true, true),
      perm("supervisorOversight", false, false),
      perm("audit", true, false),
    ],
  },
  {
    id: "role_program_supervisor",
    key: "program_supervisor",
    name: "Program Supervisor",
    description: "Cross-org, read-only oversight (scope.md AD-15).",
    permissions: [
      perm("organization", true, false),
      perm("usersRoles", true, false),
      perm("onboarding", false, false),
      perm("needs", true, false),
      perm("surveys", true, false),
      perm("collection", true, false),
      perm("evidence", true, false),
      perm("aiReview", true, false),
      perm("reports", true, false),
      perm("sharing", true, false),
      perm("supervisorOversight", true, true),
      perm("audit", true, true),
    ],
  },
];
