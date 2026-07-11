import type { Sector } from "@/config/sectors";
import type { ModulePermission } from "@/types/permissions";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  consentedAt: string | null;
}

export interface AuthOrganization {
  id: string;
  name: string;
  logoUrl: string | null;
  region: string;
  email: string;
  sector: Sector | null;
  villages: string[];
  isActive: boolean;
  createdAt: string;
}

export interface AuthRole {
  id: string;
  key: string;
  name: string;
  crossEntity: boolean;
  permissions: ModulePermission[];
}

/** Everything a signed-in client needs — user, their org, their role/permissions. */
export interface SessionContext {
  token: string;
  user: AuthUser;
  organization: AuthOrganization;
  role: AuthRole;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ForgotPasswordPayload {
  email: string;
}

export interface ResetPasswordPayload {
  token: string;
  password: string;
}

export interface RequestOtpPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  code: string;
}
