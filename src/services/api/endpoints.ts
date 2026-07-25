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
  geography: {
    regions: "/regions",
    governorates: "/governorates",
    centers: "/centers",
  },
  studies: {
    list: "/studies",
    create: "/studies",
    byId: (id: string) => `/studies/${id}`,
  },
  questionBank: {
    domainOptions: "/question-bank/domain-options",
    kpiOptions: "/question-bank/kpi-options",
    questions: "/question-bank/questions",
  },
  surveys: {
    // Each Need runs its own independent survey now — routes are
    // needId-scoped, not studyId-scoped.
    forNeed: (needId: string) => `/needs/${needId}/survey`,
    recommendQuestions: (needId: string) => `/needs/${needId}/recommend-questions`,
    updateQuestions: (id: string) => `/surveys/${id}/questions`,
    setMethodologyVersion: (id: string) => `/surveys/${id}/methodology-version`,
    // Approval workflow — Researcher submits, Approver approves/rejects.
    // See SurveysService's state machine on the backend.
    submit: (id: string) => `/surveys/${id}/submit`,
    approve: (id: string) => `/surveys/${id}/approve`,
    reject: (id: string) => `/surveys/${id}/reject`,
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
    // POST (create) and GET (list) both hit the need-scoped collection;
    // submit and delete are their own routes (see the backend's
    // EvidenceController/EvidenceDeleteController).
    forNeed: (needId: string) => `/needs/${needId}/evidence`,
    submit: (needId: string) => `/needs/${needId}/evidence/submit`,
    byId: (id: string) => `/evidence/${id}`,
  },
  needs: {
    // A Study can hold many Needs — create/list hit the study-scoped
    // collection, get/update hit the Need directly by its own id.
    forStudy: (studyId: string) => `/studies/${studyId}/needs`,
    import: (studyId: string) => `/studies/${studyId}/needs/import`,
    byId: (needId: string) => `/needs/${needId}`,
  },
  aiDecisions: {
    // Now the Retry action for a Need whose automatic classification
    // failed — classification itself runs automatically at Need creation.
    classify: (needId: string) => `/needs/${needId}/ai-decisions/classify`,
    forNeed: (needId: string) => `/needs/${needId}/ai-decisions`,
    review: (id: string) => `/ai-decisions/${id}/review`,
  },
  aiReview: {
    approve: (needId: string) => `/needs/${needId}/ai-review/approve`,
    reject: (needId: string) => `/needs/${needId}/ai-review/reject`,
    overrideDomain: (needId: string) => `/needs/${needId}/ai-review/override-domain`,
    retry: (needId: string) => `/needs/${needId}/ai-review/retry-classification`,
    manualClassify: (needId: string) => `/needs/${needId}/ai-review/manual-classify`,
  },
  domains: {
    public: "/domains/public",
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
    // Admin/authenticated side (Publish Survey + Generate QR) — each Need
    // runs its own independent set of survey links now.
    links: (needId: string) => `/needs/${needId}/survey-links`,
    deactivateLink: (needId: string, linkId: string) =>
      `/needs/${needId}/survey-links/${linkId}/deactivate`,
    responses: (needId: string) => `/needs/${needId}/survey-responses`,
    // Same rows as `responses`, with each one's answers already joined in.
    responsesWithAnswers: (needId: string) => `/needs/${needId}/survey-responses-full`,
    response: (needId: string, responseId: string) =>
      `/needs/${needId}/survey-responses/${responseId}`,
    questionResponses: (needId: string, questionId: string) =>
      `/needs/${needId}/survey-responses/questions/${questionId}`,
    exportResponses: (needId: string, format: "csv" | "excel") =>
      `/needs/${needId}/survey-responses/export?format=${format}`,
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
    assess: (needId: string) => `/needs/${needId}/response-quality/assess`,
    list: (needId: string) => `/needs/${needId}/response-quality`,
    generateSummary: (needId: string) => `/needs/${needId}/ai-summary/generate`,
    getSummary: (needId: string) => `/needs/${needId}/ai-summary`,
  },
  priority: {
    score: (needId: string) => `/needs/${needId}/priority-score`,
    dashboard: "/priority-scores",
    approve: (id: string) => `/priority-scores/${id}/approve`,
  },
  reports: {
    list: "/reports",
    create: "/reports",
    byId: (id: string) => `/reports/${id}`,
    confirm: (id: string) => `/reports/${id}/confirm`,
    approve: (id: string) => `/reports/${id}/approve`,
    reject: (id: string) => `/reports/${id}/reject`,
    archive: (id: string) => `/reports/${id}/archive`,
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
  reportSharing: {
    list: "/report-sharing-requests",
    create: "/report-sharing-requests",
    byId: (id: string) => `/report-sharing-requests/${id}`,
    approve: (id: string) => `/report-sharing-requests/${id}/approve`,
    reject: (id: string) => `/report-sharing-requests/${id}/reject`,
    sharedReport: (id: string) => `/report-sharing-requests/${id}/shared-report`,
    lookupOrganizations: (query: string) =>
      `/report-sharing-requests/lookup/organizations?query=${encodeURIComponent(query)}`,
    lookupReportsForOrg: (orgId: string) =>
      `/report-sharing-requests/lookup/organizations/${orgId}/reports`,
  },
  reviewerSla: {
    config: "/reviewer-sla/config",
    alerts: "/reviewer-sla/alerts",
  },
  sharingAlerts: {
    list: "/sharing-alerts",
  },
  collectiveDashboard: "/collective-dashboard",
  methodologyConfig: {
    get: "/methodology-config",
    publish: "/methodology-config/publish",
    // TEMPORARY — see the MethodologyVersionOption model comment on the
    // backend. Backs the Survey workflow's Methodology Version selector.
    versions: "/methodology-config/versions",
  },
} as const;
