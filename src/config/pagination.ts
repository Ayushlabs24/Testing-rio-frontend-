/** Single source of truth for list page sizes — never inline a page-size number in a component. */
export const USERS_PAGE_SIZE = 8;
export const AUDIT_PAGE_SIZE = 10;
export const STUDIES_PAGE_SIZE = 10;
export const SURVEY_RESPONSES_PAGE_SIZE = 10;
// User-selectable rows-per-page for the (potentially very large) public
// survey response tables — see the "View All Responses" and per-question
// responses pages.
export const SURVEY_RESPONSES_PAGE_SIZE_OPTIONS = [10, 15, 20, 50, 100] as const;
