import { z } from "zod";
import { PERMISSION_MODULES } from "@/types/permissions";

/**
 * Runtime validation for the backend's session/signup responses — these
 * drive the frontend's own permission checks (`usePermission`, sidebar nav,
 * every `PermissionGuard`), so a malformed or unexpectedly-shaped response
 * here is a security-relevant failure mode, not just a rendering glitch.
 * `z.infer` derives the TypeScript types from these schemas (not the other
 * way around) specifically so the two can never drift apart.
 */
const modulePermissionSchema = z.object({
  module: z.enum(PERMISSION_MODULES),
  read: z.boolean(),
  write: z.boolean(),
  create: z.boolean(),
  approve: z.boolean(),
  export: z.boolean(),
  share: z.boolean(),
});

export const apiSessionViewSchema = z.object({
  token: z.string().min(1),
  user: z.object({
    id: z.string().min(1),
    name: z.string(),
    email: z.string(),
    consentedAt: z.string().nullable(),
    consentedPolicyVersion: z.string().nullable(),
    // RIO-DATA-001's data-sharing consent. Defaulted rather than required so
    // a session minted by an older backend still parses — the nulls then put
    // the user through the consent gate, which is the correct outcome.
    sharingConsentedAt: z.string().nullable().default(null),
    sharingConsentedPolicyVersion: z.string().nullable().default(null),
  }),
  organization: z.object({
    id: z.string().min(1),
    name: z.string(),
    // The backend's own SessionOrg type (session.types.ts) declares both of
    // these nullable — null whenever the org didn't pick "other" as its
    // sector / hasn't set a registration number yet. Coalesced to "" in
    // toSessionContextFromApi, same as `email` below.
    purpose: z.string().nullable(),
    registrationNumber: z.string().nullable(),
    logoUrl: z.string().nullable(),
    region: z.array(z.string()),
    email: z.string().nullable(),
    sector: z.string().nullable(),
    villages: z.array(z.string()),
    regionId: z.string().nullable(),
    governorateIds: z.array(z.string()),
    centerIds: z.array(z.string()),
    isActive: z.boolean(),
    createdAt: z.string(),
  }),
  // `crossEntity`/`permissions` are the real, server-enforced authorization
  // data (see auth.service.ts's own comment on why `name`/`enabled` are
  // deliberately NOT read from here) — these two fields in particular must
  // never silently pass through malformed.
  role: z.object({
    key: z.string().min(1),
    crossEntity: z.boolean(),
    permissions: z.array(modulePermissionSchema),
  }),
  mustChangePassword: z.boolean(),
});

export type ApiSessionView = z.infer<typeof apiSessionViewSchema>;

// RIO-FR-010 (client-confirmed): signup no longer returns a session — see
// SignupResult's own comment in auth.types.ts.
export const apiSignupViewSchema = z.object({
  status: z.literal("pending_approval"),
  organizationName: z.string(),
  email: z.string(),
});

export type ApiSignupView = z.infer<typeof apiSignupViewSchema>;

export const apiRegistrationNumberVerificationSchema = z.object({
  verified: z.boolean(),
  reason: z.enum(["INVALID_FORMAT", "NOT_FOUND"]).optional(),
});

export type ApiRegistrationNumberVerification = z.infer<
  typeof apiRegistrationNumberVerificationSchema
>;
