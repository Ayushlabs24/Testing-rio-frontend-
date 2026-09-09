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
    verifyRegistrationNumber: "/auth/verify-registration-number",
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
    create: "/organizations",
    byId: (id: string) => `/organizations/${id}`,
    status: (id: string) => `/organizations/${id}/status`,
    approve: (id: string) => `/organizations/${id}/approve`,
    usersForOrg: (id: string) => `/organizations/${id}/users`,
    ngoAdminsForOrg: (id: string) => `/organizations/${id}/ngoadmins`,
    assignNgoAdmin: (id: string) => `/organizations/${id}/ngoadmins/assign`,
    updateUserRoleForOrg: (id: string, userId: string) =>
      `/organizations/${id}/users/${userId}/role`,
    updateUserStatusForOrg: (id: string, userId: string) =>
      `/organizations/${id}/users/${userId}/status`,
    resendInviteForOrg: (id: string, userId: string) =>
      `/organizations/${id}/users/${userId}/resend-invite`,
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
    targetRespondentOptions: "/question-bank/target-respondent-options",
    questions: "/question-bank/questions",
    // RIO-FR-012 — admin management (includes deactivated questions).
    manage: "/question-bank/questions/manage",
    byId: (id: string) => `/question-bank/questions/${id}`,
    deactivate: (id: string) => `/question-bank/questions/${id}/deactivate`,
    reactivate: (id: string) => `/question-bank/questions/${id}/reactivate`,
    // RIO-FR-012 (Q31) — Human Reviewer's approval queue and decisions.
    pendingApprovals: "/question-bank/questions/pending-approvals",
    approve: (id: string) => `/question-bank/questions/${id}/approve`,
    reject: (id: string) => `/question-bank/questions/${id}/reject`,
  },
  surveys: {
    // Each Need runs its own independent survey now — routes are
    // needId-scoped, not studyId-scoped.
    forNeed: (needId: string) => `/needs/${needId}/survey`,
    // RIO-FR-011: the currently PUBLISHED version, not "latest" — use this
    // (not `forNeed`) anywhere that must keep showing v1 correctly while a
    // newer draft is being edited.
    publishedForNeed: (needId: string) => `/needs/${needId}/survey/published`,
    versionsForNeed: (needId: string) => `/needs/${needId}/survey/versions`,
    recommendQuestions: (needId: string) => `/needs/${needId}/recommend-questions`,
    updateQuestions: (id: string) => `/surveys/${id}/questions`,
    setMethodologyVersion: (id: string) => `/surveys/${id}/methodology-version`,
    setSampleDescription: (id: string) => `/surveys/${id}/sample-description`,
    // Approval workflow — Researcher submits, Approver approves/rejects.
    // See SurveysService's state machine on the backend.
    submit: (id: string) => `/surveys/${id}/submit`,
    // RIO-FR-011: the only way to change a PUBLISHED survey — creates a new
    // DRAFT version instead of editing in place.
    newVersion: (id: string) => `/surveys/${id}/new-version`,
    approve: (id: string) => `/surveys/${id}/approve`,
    reject: (id: string) => `/surveys/${id}/reject`,
    // Client-confirmed (Aug 13 call): the Researcher's own separate
    // go-live step, once the Approver has already approved.
    publish: (id: string) => `/surveys/${id}/publish`,
    public: (id: string) => `/surveys/public/${id}`,
    submitAnswers: (id: string) => `/surveys/public/${id}/submit`,
    responses: (id: string) => `/surveys/${id}/responses`,
    // Org-wide, not needId-scoped — a reusable custom question can have
    // come from any survey (see SurveysController.listReusableCustomQuestions).
    reusableCustomQuestions: "/custom-questions",
    // Filterable survey list (?studyId=&status=) — feeds the survey picker on
    // the Generate Report dialog for the survey-scoped types (RPT01/RPT15).
    list: "/surveys",
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
  // RIO-NFR-016 — operational log. Separate from `audit` above: that is the
  // business-event governance trail (RIO-FR-007); these are system
  // diagnostics (errors, failed integrations, slow requests, job outcomes),
  // gated on the System-Admin-only `systemLogs` permission.
  // RIO-NFR-010 — backup administration. Platform-scoped: a dump spans every
  // entity, so nothing here takes an org.
  backups: {
    list: "/backups",
    summary: "/backups/summary",
    run: "/backups/run",
    prune: "/backups/prune",
    verify: (runId: string) => `/backups/${runId}/verify`,
    // Deeper than verify: opens the artefact and checks it parses as something
    // a restore could consume. See BackupController.checkRecoverability.
    recoverability: (runId: string) => `/backups/${runId}/recoverability`,
  },
  systemLogs: {
    list: "/system-logs",
    summary: "/system-logs/summary",
    export: "/system-logs/export",
    byRequest: (requestId: string) => `/system-logs/request/${requestId}`,
    byId: (id: string) => `/system-logs/${id}`,
  },
  consentPolicy: {
    active: "/consent-policy/active",
    organizationStatus: "/consent-policy/organization-status",
    // Public — the citizen survey notice (RIO-NFR-002).
    citizen: "/consent-policy/citizen",
    // Client-confirmed (2026-08-27) — consent text is versioned and managed
    // through the app in V2 rather than hardcoded per release. System Admin
    // drafts/edits/submits/publishes; System Reviewer approves or rejects.
    versions: "/consent-policy/versions",
    version: (id: string) => `/consent-policy/versions/${id}`,
    submitVersion: (id: string) => `/consent-policy/versions/${id}/submit`,
    approveVersion: (id: string) => `/consent-policy/versions/${id}/approve`,
    rejectVersion: (id: string) => `/consent-policy/versions/${id}/reject`,
    publishVersion: (id: string) => `/consent-policy/versions/${id}/publish`,
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
    previewPdf: (studyId: string) => `/studies/${studyId}/needs/preview-pdf`,
    previewSurveyResults: (studyId: string) =>
      `/studies/${studyId}/needs/preview-survey-results`,
    importBulk: (studyId: string) => `/studies/${studyId}/needs/import-bulk`,
    byId: (needId: string) => `/needs/${needId}`,
    gapType: (needId: string) => `/needs/${needId}/gap-type`,
    // RIO-FR-003 AC 1 — the human-assigned urgency level.
    urgency: (needId: string) => `/needs/${needId}/urgency`,
    // RIO-FR-003 AC 6 — recurring themes, and the counts that back the
    // group-by-theme view.
    extractThemes: (needId: string) => `/needs/${needId}/themes/extract`,
    themeCounts: "/need-themes/counts",
  },
  // RIO-AI-003 — the suggested summary of a long need description. There is
  // deliberately no `generate` route: the AC says the summary is suggested
  // automatically when a need is written, so generation is a server-side
  // trigger, not something the UI calls. Only `regenerate` is user-initiated.
  needSummaries: {
    forNeed: (needId: string) => `/needs/${needId}/summary`,
    regenerate: (needId: string) => `/needs/${needId}/summary/regenerate`,
    pending: "/need-summaries/pending",
    byId: (summaryId: string) => `/need-summaries/${summaryId}`,
    confirm: (summaryId: string) => `/need-summaries/${summaryId}/confirm`,
    confirmBatch: "/need-summaries/confirm-batch",
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
    publicTree: "/domains/public/tree",
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
  needDecisions: {
    list: (needId: string) => `/needs/${needId}/decisions`,
    create: (needId: string) => `/needs/${needId}/decisions`,
    updateStatus: (needId: string, decisionId: string) =>
      `/needs/${needId}/decisions/${decisionId}/status`,
  },
  studyConfig: {
    studyTypes: "/study-config/study-types",
    studyTypeById: (id: string) => `/study-config/study-types/${id}`,
    activateStudyType: (id: string) => `/study-config/study-types/${id}/activate`,
    deactivateStudyType: (id: string) => `/study-config/study-types/${id}/deactivate`,
    targetSectors: "/study-config/target-sectors",
    targetSectorById: (id: string) => `/study-config/target-sectors/${id}`,
    activateTargetSector: (id: string) => `/study-config/target-sectors/${id}/activate`,
    deactivateTargetSector: (id: string) =>
      `/study-config/target-sectors/${id}/deactivate`,
    decisionTypes: "/study-config/decision-types",
    decisionTypeById: (id: string) => `/study-config/decision-types/${id}`,
    activateDecisionType: (id: string) => `/study-config/decision-types/${id}/activate`,
    deactivateDecisionType: (id: string) =>
      `/study-config/decision-types/${id}/deactivate`,
    gapTypes: "/study-config/gap-types",
    gapTypeById: (id: string) => `/study-config/gap-types/${id}`,
    activateGapType: (id: string) => `/study-config/gap-types/${id}/activate`,
    deactivateGapType: (id: string) => `/study-config/gap-types/${id}/deactivate`,
    // RIO-FR-003 AC 6 — the theme vocabulary.
    needThemes: "/study-config/need-themes",
    needThemeById: (id: string) => `/study-config/need-themes/${id}`,
    activateNeedTheme: (id: string) => `/study-config/need-themes/${id}/activate`,
    deactivateNeedTheme: (id: string) => `/study-config/need-themes/${id}/deactivate`,
  },
  publicSurveys: {
    // Admin/authenticated side (Publish Survey + Generate QR) — each Need
    // runs its own independent set of survey links now.
    links: (needId: string) => `/needs/${needId}/survey-links`,
    deactivateLink: (needId: string, linkId: string) =>
      `/needs/${needId}/survey-links/${linkId}/deactivate`,
    shareLinkByEmail: (needId: string, linkId: string) =>
      `/needs/${needId}/survey-links/${linkId}/share-email`,
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
    // Abandonment tracking (RPT10 Q-2). Session metadata only — see the
    // backend's RecordSessionEventBody, which has no field that could carry
    // an answer.
    startSession: (token: string) => `/public/surveys/${token}/sessions`,
    sessionEvent: (token: string, sessionId: string) =>
      `/public/surveys/${token}/sessions/${sessionId}/events`,
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
    // RIO-FR-003 AC 5 — a reviewer replacing the computed number, with a
    // mandatory reason. The computed value stays on the record.
    override: (id: string) => `/priority-scores/${id}/override`,
    villageComparison: "/priority-scores/village-comparison",
  },
  reports: {
    list: "/reports",
    create: "/reports",
    byId: (id: string) => `/reports/${id}`,
    confirm: (id: string) => `/reports/${id}/confirm`,
    approve: (id: string) => `/reports/${id}/approve`,
    reject: (id: string) => `/reports/${id}/reject`,
    archive: (id: string) => `/reports/${id}/archive`,
    // `locale` is the language the user is viewing the app in, so the exported
    // PDF/Excel reads the same as the screen it was requested from. Omitted for
    // English — the API defaults to it, so the URL stays unchanged for the
    // locale that was the only one before this.
    export: (id: string, format: "pdf" | "excel", locale?: "en" | "ar") =>
      `/reports/${id}/export?format=${format}${locale === "ar" ? "&locale=ar" : ""}`,
  },
  archive: {
    list: "/archive",
    byId: (id: string) => `/archive/${id}`,
  },
  // RIO-FR-013 pre-platform study uploads, and RIO-DATA-002 importing one
  // of them into the unified dashboard as real Need rows.
  historicalStudies: {
    list: "/historical-studies",
    create: "/historical-studies",
    file: (id: string) => `/historical-studies/${id}/file`,
    import: (id: string) => `/historical-studies/${id}/import`,
  },
  sharing: {
    list: "/sharing-requests",
    create: "/sharing-requests",
    byId: (id: string) => `/sharing-requests/${id}`,
    approve: (id: string) => `/sharing-requests/${id}/approve`,
    reject: (id: string) => `/sharing-requests/${id}/reject`,
    withdraw: (id: string) => `/sharing-requests/${id}/withdraw`,
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
    withdraw: (id: string) => `/report-sharing-requests/${id}/withdraw`,
    sharedReport: (id: string) => `/report-sharing-requests/${id}/shared-report`,
    lookupOrganizations: (query: string) =>
      `/report-sharing-requests/lookup/organizations?query=${encodeURIComponent(query)}`,
    lookupReportsForOrg: (orgId: string) =>
      `/report-sharing-requests/lookup/organizations/${orgId}/reports`,
  },
  // RIO-FR-002 — the Data Quality reviewer queue.
  dataQuality: {
    flags: "/data-quality/flags",
    summary: "/data-quality/summary",
    review: (flagId: string) => `/data-quality/flags/${flagId}/review`,
    bulkAccept: "/data-quality/flags/bulk-accept",
    duplicates: "/data-quality/duplicates",
    decideDuplicate: (candidateId: string) =>
      `/data-quality/duplicates/${candidateId}/decide`,
    // RIO-AI-004 / Q9 — Center/NCNP only. Returns an empty page for anyone
    // else, so an entity reviewer never learns the queue exists.
    crossEntityDuplicates: "/data-quality/duplicates/cross-entity",
    scanCrossEntity: "/data-quality/duplicates/cross-entity/scan",
    scanSemantic: "/data-quality/duplicates/semantic/scan",
    // RIO-AI-004 — merge. `merges` is both the history (GET) and the act
    // (POST); the backend gates them on read and approve respectively.
    merges: "/data-quality/merges",
    mergePreview: "/data-quality/merges/preview",
    settings: "/data-quality/settings",
    undoMerge: (mergeId: string) => `/data-quality/merges/${mergeId}/undo`,
  },
  initiatives: {
    list: "/initiatives",
    create: "/initiatives",
    byId: (id: string) => `/initiatives/${id}`,
    update: (id: string) => `/initiatives/${id}`,
    linkedByNeed: (needId: string) => `/needs/${needId}/initiatives`,
    linkNeed: (needId: string, initiativeId: string) =>
      `/needs/${needId}/initiatives/${initiativeId}`,
    unlinkNeed: (needId: string, initiativeId: string) =>
      `/needs/${needId}/initiatives/${initiativeId}/unlink`,
    statusHistory: (needId: string) => `/needs/${needId}/initiatives/status-history`,
  },
  reviewerSla: {
    config: "/reviewer-sla/config",
    alerts: "/reviewer-sla/alerts",
  },
  ai: {
    status: "/ai/status",
  },
  sharingAlerts: {
    list: "/sharing-alerts",
  },
  questionBankAlerts: {
    list: "/question-bank-alerts",
  },
  collectiveDashboard: "/collective-dashboard",
  ncnpReport: {
    get: "/ncnp-report",
    export: (format: "pdf" | "excel") => `/ncnp-report/export?format=${format}`,
  },
  ncnpReportReview: {
    list: (status?: string) =>
      status ? `/ncnp-report-reviews?status=${status}` : "/ncnp-report-reviews",
    generate: "/ncnp-report-reviews",
    byId: (id: string) => `/ncnp-report-reviews/${id}`,
    approve: (id: string) => `/ncnp-report-reviews/${id}/approve`,
    reject: (id: string) => `/ncnp-report-reviews/${id}/reject`,
    publish: (id: string) => `/ncnp-report-reviews/${id}/publish`,
    alerts: "/ncnp-report-reviews/alerts",
    export: (id: string, format: "pdf" | "excel") =>
      `/ncnp-report-reviews/${id}/export?format=${format}`,
  },
  permissionGrants: {
    list: "/permission-grants",
    revoke: (id: string) => `/permission-grants/${id}/revoke`,
  },
  // RIO Arabic Localization — Approach 3 (Hybrid). Dynamic/user-typed
  // content only — fixed master data uses its own name/nameAr columns
  // instead (see @/lib/bilingual), never this endpoint.
  translation: {
    translate: "/translation",
  },
  methodologyConfig: {
    get: "/methodology-config",
    approve: "/methodology-config/approve",
    reject: "/methodology-config/reject",
    publish: "/methodology-config/publish",
    versions: "/methodology-config/versions",
    history: "/methodology-config/history",
  },
} as const;
