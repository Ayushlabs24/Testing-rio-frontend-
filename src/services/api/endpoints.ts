/**
 * Single source of truth for every backend route the app calls.
 * Services must reference these instead of inlining path strings.
 *
 * NOTE: some `src/services/*` methods still run on mock data (see
 * `src/mocks/`) — each gets swapped to its real route independently, per
 * the project's incremental-swap convention. Paths listed here that a
 * service doesn't call yet document where it should point once swapped.
 */
export const endpoints = {
  auth: {
    login: "/auth/login",
    signup: "/auth/signup",
    changePassword: "/auth/change-password",
    consent: "/auth/consent",
    forgotPassword: "/auth/forgot-password",
    resetPassword: "/auth/reset-password",
    requestOtp: "/auth/otp/request",
    verifyOtp: "/auth/otp/verify",
    me: "/auth/me",
    logout: "/auth/logout",
  },
  organizations: {
    current: "/organizations/current",
    list: "/organizations",
    byId: (id: string) => `/organizations/${id}`,
  },
  studies: {
    list: "/studies",
    create: "/studies",
    byId: (id: string) => `/studies/${id}`,
  },
  roles: {
    list: "/roles",
  },
  users: {
    list: "/users",
    create: "/users",
    byId: (id: string) => `/users/${id}`,
  },
  audit: {
    list: "/audit",
  },
} as const;
