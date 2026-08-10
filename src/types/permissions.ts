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
  // Survey Builder (Question Bank + AI-assisted questionnaire design) is its
  // own independent methodology feature, not a Study feature — deliberately
  // its own module rather than reusing studySurvey. Publish Survey/QR and
  // the Citizen public flow are unrelated and keep their existing modules.
  "surveyBuilder",
  // The NCNP Compiled Report's own review workflow — deliberately not a
  // reuse of reportsDashboards (see the backend role-matrix.ts comment):
  // granting reportsDashboards:approve to System Reviewer would also grant
  // approve rights over the unrelated RPT01-14 Reports feature. `approve` =
  // System Reviewer's approve/reject decision; `write` = System Admin's
  // generate/publish actions.
  "ncnpReport",
  // RIO-NFR-016 — the persisted operational log (errors, failed
  // integrations, slow requests, job outcomes). Deliberately not folded into
  // archiveSharingAudit: that module is held read-only by ngo_admin,
  // center_supervisor and data_analyst, and these rows carry stack traces,
  // internal paths and cross-tenant detail. System Admin only.
  "systemLogs",
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
