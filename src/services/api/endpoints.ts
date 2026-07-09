/**
 * Single source of truth for every backend route the app calls.
 * Services must reference these instead of inlining path strings.
 *
 * NOTE: while `src/services/*` run on mock data (see `src/mocks/`), these
 * paths aren't called yet — they document the routes each service method
 * should call once a real backend exists.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    signup: "/auth/signup",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    requestOtp: "/auth/otp/request",
    verifyOtp: "/auth/otp/verify",
    me: "/auth/me",
    logout: "/auth/logout",
  },
  organizations: {
    current: "/organizations/current",
  },
  roles: {
    list: "/roles",
  },
  users: {
    list: "/users",
    create: "/users",
  },
  audit: {
    list: "/audit",
  },
} as const;
