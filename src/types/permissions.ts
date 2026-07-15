/**
 * The 12 functional modules from `new scope.md`: every capability the
 * platform offers groups into one of these. Every permission check in the
 * app references one of these keys, never a free-form string.
 */
export const PERMISSION_MODULES = [
  "entityTeam",
  "rolesPermissions",
  "onboardingConsent",
  "methodologyQuestionBank",
  "studySurvey",
  "dataCollection",
  "dataImport",
  "citizenChannel",
  "aiReview",
  "priorityScoring",
  "reportsDashboards",
  "archiveSharingAudit",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/**
 * The full access-criteria set from `new scope.md` §3 "Roles & Permissions"
 * (View / Create / Edit / Approve / Export / Share), applied per module.
 * Route- and nav-level gating typically checks `read`/`write`, but in-page
 * actions gate on the specific grant they perform — e.g. a "New study"
 * button checks `create`, not `write`, because the role matrix grants those
 * separately (system_admin has read on `studySurvey` but no create).
 */
export interface ModulePermission {
  module: PermissionModule;
  read: boolean;
  write: boolean;
  create: boolean;
  approve: boolean;
  export: boolean;
  share: boolean;
}

/**
 * Every grant in ModulePermission is checkable. Derived from the interface
 * rather than hand-listed so the two can never drift apart.
 */
export type PermissionAction = Exclude<keyof ModulePermission, "module">;
