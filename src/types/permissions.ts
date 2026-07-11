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
 * `read`/`write` remain the two fields route- and nav-level gating checks
 * against (`usePermission`, `PermissionGuard`) — `create`/`approve`/
 * `export`/`share` exist for finer-grained UI (e.g. the Roles detail panel)
 * that needs to show more than a binary read/write.
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

export type PermissionAction = "read" | "write";
