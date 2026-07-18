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
  questionBank: {
    domainOptions: "/question-bank/domain-options",
    questions: "/question-bank/questions",
  },
  surveys: {
    forStudy: (studyId: string) => `/studies/${studyId}/survey`,
    recommendQuestions: (studyId: string) => `/studies/${studyId}/recommend-questions`,
    updateQuestions: (id: string) => `/surveys/${id}/questions`,
    saveDraft: (id: string) => `/surveys/${id}/save-draft`,
    public: (id: string) => `/surveys/public/${id}`,
    submitAnswers: (id: string) => `/surveys/public/${id}/submit`,
    responses: (id: string) => `/surveys/${id}/responses`,
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
    export: "/audit/export",
  },
  consentPolicy: {
    active: "/consent-policy/active",
    organizationStatus: "/consent-policy/organization-status",
  },
  contact: {
    // Public enquiry form on the auth pages — unauthenticated on the backend.
    organizations: "/contact/organizations",
    submit: "/contact",
  },
  evidence: {
    // POST (create) and GET (list) both hit the study-scoped collection;
    // submit and delete are their own routes (see the backend's
    // EvidenceController/EvidenceDeleteController).
    forStudy: (studyId: string) => `/studies/${studyId}/evidence`,
    submit: (studyId: string) => `/studies/${studyId}/evidence/submit`,
    byId: (id: string) => `/evidence/${id}`,
  },
  needs: {
    // One Need per study — create/read/update all hit the same URL.
    forStudy: (studyId: string) => `/studies/${studyId}/need`,
  },
  aiDecisions: {
    classify: (studyId: string) => `/studies/${studyId}/ai-decisions/classify`,
    forStudy: (studyId: string) => `/studies/${studyId}/ai-decisions`,
    review: (id: string) => `/ai-decisions/${id}/review`,
  },
  domains: {
    list: "/domains",
    tree: "/domains/tree",
    create: "/domains",
    byId: (id: string) => `/domains/${id}`,
    activate: (id: string) => `/domains/${id}/activate`,
    deactivate: (id: string) => `/domains/${id}/deactivate`,
    subDomains: (domainId: string) => `/domains/${domainId}/subdomains`,
    subDomainById: (domainId: string, subId: string) =>
      `/domains/${domainId}/subdomains/${subId}`,
    activateSubDomain: (domainId: string, subId: string) =>
      `/domains/${domainId}/subdomains/${subId}/activate`,
    deactivateSubDomain: (domainId: string, subId: string) =>
      `/domains/${domainId}/subdomains/${subId}/deactivate`,
  },
  publicSurveys: {
    // Admin/authenticated side (Publish Survey + Generate QR).
    links: (studyId: string) => `/studies/${studyId}/survey-links`,
    deactivateLink: (studyId: string, linkId: string) =>
      `/studies/${studyId}/survey-links/${linkId}/deactivate`,
  },
  citizen: {
    // Fully unauthenticated (Citizen public flow) — token identifies the
    // survey, never a study id or org id directly.
    resolve: (token: string) => `/public/surveys/${token}`,
    checkDuplicate: (token: string) => `/public/surveys/${token}/check-duplicate`,
    requestOtp: (token: string) => `/public/surveys/${token}/otp/request`,
    verifyOtp: (token: string) => `/public/surveys/${token}/otp/verify`,
    submitResponse: (token: string) => `/public/surveys/${token}/responses`,
  },
  responseQuality: {
    assess: (studyId: string) => `/studies/${studyId}/response-quality/assess`,
    list: (studyId: string) => `/studies/${studyId}/response-quality`,
    generateSummary: (studyId: string) => `/studies/${studyId}/ai-summary/generate`,
    getSummary: (studyId: string) => `/studies/${studyId}/ai-summary`,
  },
  priority: {
    score: (studyId: string) => `/studies/${studyId}/priority-score`,
    dashboard: "/priority-scores",
  },
  reports: {
    list: "/reports",
    create: "/reports",
    byId: (id: string) => `/reports/${id}`,
    approve: (id: string) => `/reports/${id}/approve`,
    reject: (id: string) => `/reports/${id}/reject`,
    export: (id: string, format: "pdf" | "excel") =>
      `/reports/${id}/export?format=${format}`,
  },
  archive: {
    list: "/archive",
  },
  sharing: {
    list: "/sharing-requests",
    create: "/sharing-requests",
    byId: (id: string) => `/sharing-requests/${id}`,
    approve: (id: string) => `/sharing-requests/${id}/approve`,
    reject: (id: string) => `/sharing-requests/${id}/reject`,
    sharedStudy: (id: string) => `/sharing-requests/${id}/shared-study`,
    lookupOrganizations: (query: string) =>
      `/sharing-requests/lookup/organizations?query=${encodeURIComponent(query)}`,
    lookupStudiesForOrg: (orgId: string) =>
      `/sharing-requests/lookup/organizations/${orgId}/studies`,
  },
  reviewerSla: {
    config: "/reviewer-sla/config",
    alerts: "/reviewer-sla/alerts",
  },
  methodologyConfig: {
    get: "/methodology-config",
    publish: "/methodology-config/publish",
  },
} as const;
