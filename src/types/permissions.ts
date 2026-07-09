/**
 * The 12 permission modules, mapped 1:1 to the NestJS feature modules in
 * scope.md (§2 "Layered container view"): tenancy · auth/rbac · onboarding ·
 * needs · survey · collection · evidence · ai-review · reports · sharing ·
 * supervisor · audit. Every permission check in the app references one of
 * these keys, never a free-form string.
 */
export const PERMISSION_MODULES = [
  "organization",
  "usersRoles",
  "onboarding",
  "needs",
  "surveys",
  "collection",
  "evidence",
  "aiReview",
  "reports",
  "sharing",
  "supervisorOversight",
  "audit",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];

export interface ModulePermission {
  module: PermissionModule;
  read: boolean;
  write: boolean;
}

export type PermissionAction = "read" | "write";
