# Plan: Unit Tests — Report Sharing (org-to-org) & Report Export (PDF/Excel)

**Date:** 2026-07-28
**Scope:** `src/services/report-sharing/*`, `src/components/features/sharing/*`,
`src/app/[locale]/(app)/sharing/**`, `src/services/reports/reports.service.ts`,
`src/components/features/reports/report-actions.tsx`
**Convention:** follows this repo's existing style (see `audit.service.test.ts`,
`signup-form.test.tsx`) — vitest, `vi.mock("@/services/api/client", ...)` for API calls,
`vi.stubGlobal("fetch", ...)` + `URL.createObjectURL`/`document.createElement` spies for
file-download flows, React Testing Library for components, `next-intl` mocked via a `lookup()`
helper reading real `messages/en.json`.

**Neither feature has any existing test coverage** (`report-sharing.service.ts`,
`report-sharing-panel.tsx`, `reports.service.ts`, `report-actions.tsx` — no `.test.ts(x)` files
found for any of them). This plan starts from zero for these files.

---

## 1. `services/report-sharing/report-sharing.service.test.ts` (new file)

| #   | Method                       | Case                                                                                                                              |
| --- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `create()`                   | calls the correct endpoint with the payload, returns parsed `ReportSharingRequest`; propagates `ApiError` on failure              |
| 2   | `list()`                     | returns array; empty array on no requests                                                                                         |
| 3   | `getById()`                  | returns single request; not-found error propagates                                                                                |
| 4   | `approve(id, payload?)`      | called with and without an optional payload; returns updated request                                                              |
| 5   | `reject(id, payload?)`       | same as approve, plus: reason-required is a **UI-layer** concern (see panel tests below), service itself just forwards payload    |
| 6   | `getSharedReport(id)`        | returns `SharedReportSnapshot`; confirms no export/download-capable field is exposed (view-only contract noted in source comment) |
| 7   | `lookupOrganizations(query)` | forwards query string; empty query still returns a valid call                                                                     |
| 8   | `lookupReportsForOrg(orgId)` | forwards orgId; empty result array handled                                                                                        |

## 2. `components/features/sharing/report-sharing-panel.test.tsx` (new file)

| #   | Area                      | Case                                                                                                                                                             |
| --- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Load                      | initial load shows skeleton rows (`requests === null`) then renders rows                                                                                         |
| 2   | Load failure              | `list()` rejects → error message shown (`loadError`/`loadFailed`), empty rows, no crash                                                                          |
| 3   | Tabs                      | incoming/outgoing split correctly by `ownerOrgId === myOrgId` vs `requestingOrgId === myOrgId`; `sharedReports`/`approved`/`rejected` tabs filter by status      |
| 4   | Create dialog             | submit disabled until both `ownerOrgId` and `reportId` are set; org combobox selection resets/enables report combobox; report combobox disabled until org chosen |
| 5   | Create dialog             | empty/whitespace-only `note` shows `noteError`, blocks submit; valid note + org + report submits and calls `create()`                                            |
| 6   | Approve/Reject visibility | decision buttons render only when `showDecision && isOwnerView && canApprove` — test both a permitted owner and a non-owner/no-permission actor                  |
| 7   | Reject flow               | uses `reject-reason-dialog.tsx`; empty reason blocks confirm; valid reason calls `reject(id, { reason })`                                                        |
| 8   | Approve flow              | calls `approve(id)`, list refreshes/updates row status                                                                                                           |
| 9   | Error surfacing           | `approve`/`reject`/`create` rejecting with `ApiError` shows `error.message`; non-`ApiError` rejection shows generic fallback text                                |
| 10  | View action               | "view" button appears only on `sharedReports` tab and navigates/links to the shared-report route                                                                 |
| 11  | Pagination                | `pageCount` math correct at boundary counts (0, 1, exactly one page, N+1 items); changing page size resets `currentPage` to 1                                    |

## 3. `app/[locale]/(app)/sharing/reports/[requestId]/page.test.tsx` (new file)

| #   | Case                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `getSharedReport(requestId)` success → `toReport()` adapter output rendered via `ReportContentView`                                                                                                     |
| 2   | Fetch error → error state rendered, not a crash                                                                                                                                                         |
| 3   | Loading → skeleton rendered before resolution                                                                                                                                                           |
| 4   | Stale-fetch guard: if `requestId` changes before the first fetch resolves, the stale response is discarded (the `cancelled` flag) — simulate two overlapping fetches and assert only the latest renders |
| 5   | `PermissionGuard module="archiveSharingAudit" action="read"` — actor without permission is blocked from rendering report content                                                                        |

## 4. `services/reports/reports.service.test.ts` (new file)

| #   | Case                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `download(id, "pdf")` success — `fetch` called with `credentials: "include"`, correct URL; blob → `createObjectURL` → anchor `download` attribute set from `content-disposition` filename → `click()` called → `revokeObjectURL` called |
| 2   | `download(id, "excel")` — same flow, `.xlsx` path                                                                                                                                                                                       |
| 3   | Missing `content-disposition` header → falls back to default filename (`report.pdf` / `report.xlsx` per format)                                                                                                                         |
| 4   | Non-ok response with parseable JSON error body → thrown `ApiError` carries that message                                                                                                                                                 |
| 5   | Non-ok response with non-JSON body → thrown `ApiError` falls back to `response.statusText`                                                                                                                                              |

## 5. `components/features/reports/report-actions.test.tsx` (new file)

| #   | Case                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PDF/Excel export buttons render only when all three gates pass: `canExport` permission, `EXPORTABLE_STATUSES.includes(report.status)`, and `report.exportFormats.includes(format)` |
| 2   | Excel-only report type (e.g. RPT08/RPT10) shows Excel button, hides PDF button                                                                                                     |
| 3   | No-export report type (RPT11) shows neither button                                                                                                                                 |
| 4   | Non-exportable status (e.g. draft/in-review) hides both buttons even if formats/permission allow                                                                                   |
| 5   | Clicking export button calls `reportsService.download(report.id, format)`                                                                                                          |
| 6   | `run()` wrapper: on success calls `onChanged`; on `ApiError` calls `onError(error.message)`; on generic error calls `onError(t("detail.exportError"))`                             |
| 7   | Confirm/approve/reject/archive buttons — same `run()` error-handling contract, one representative case each (these currently have zero coverage alongside export)                  |

---

## Sequencing

1. `reports.service.test.ts` (download/export) and `report-sharing.service.test.ts` — pure
   service-layer tests, no rendering, fastest to land and de-risk the API contract.
2. `report-actions.test.tsx` — the three-way gate (permission × status × format) is the most
   likely source of a silent bug (wrong button shown/hidden) and is cheap to test once the
   service layer is mocked.
3. `report-sharing-panel.test.tsx` — largest surface area (tabs, create dialog, approve/reject,
   pagination); break into multiple `describe` blocks per the table above rather than one file.
4. `[requestId]/page.test.tsx` — depends on patterns established in step 3 for mocking the
   service and permission guard.

## Out of scope

- E2E coverage — `e2e/auth-flows.spec.ts`-style Playwright specs for sharing/export are a
  separate effort; this plan is component/unit-level (Vitest + RTL) only.
- Visual regression of the exported PDF/Excel file contents — that's covered on the backend
  side (`export.spec.ts`); the frontend only needs to verify it triggers the right request and
  handles the response, not the file's internal structure.
