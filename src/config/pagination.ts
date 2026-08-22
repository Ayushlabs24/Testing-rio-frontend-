/** Single source of truth for list page sizes — never inline a page-size number in a component. */
export const USERS_PAGE_SIZE = 8;
export const AUDIT_PAGE_SIZE = 10;
export const STUDIES_PAGE_SIZE = 10;
export const STUDIES_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const SURVEY_RESPONSES_PAGE_SIZE = 10;
// User-selectable rows-per-page for the (potentially very large) public
// survey response tables — see the "View All Responses" and per-question
// responses pages.
export const SURVEY_RESPONSES_PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100] as const;
export const SHARING_PAGE_SIZE = 10;
export const SHARING_ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100] as const;
export const SHARED_REPORT_TABLE_PAGE_SIZE = 10;
export const REPORTS_PAGE_SIZE = 10;
export const REPORTS_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const SURVEY_BUILDER_PAGE_SIZE = 10;
export const SURVEY_BUILDER_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const NCNP_REPORT_REVIEW_PAGE_SIZE = 10;
export const NCNP_REPORT_REVIEW_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export const ORGANIZATIONS_PAGE_SIZE = 10;
export const PRIORITY_DASHBOARD_PAGE_SIZE = 10;
export const SYSTEM_ADMIN_ORGANIZATIONS_PAGE_SIZE = 10;
export const ARCHIVE_PAGE_SIZE = 10;
export const REVIEWER_SLA_PAGE_SIZE = 10;
export const PUBLIC_SURVEYS_PAGE_SIZE = 10;
export const SYSTEM_LOGS_PAGE_SIZE = 15;
export const QUESTION_BANK_PAGE_SIZE = 10;
export const QUESTION_BANK_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
