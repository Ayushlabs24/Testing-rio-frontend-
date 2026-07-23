# Test Coverage Report — Audit Log CSV Export & Signup Sector Field

**Branch:** `feat/need-workflow`
**Date:** 2026-07-23
**Scope:** Test-only — no application code changed

## Summary

| Metric         | Value                   |
| -------------- | ----------------------- |
| New test cases | 11                      |
| Files touched  | 3                       |
| Vitest suite   | 43/43 passing (8 files) |
| e2e specs      | 2 fixed, 1 added        |

Both workstreams closed a coverage gap; neither required changing the
underlying application code.

## 1. Audit log CSV export

`auditService.downloadCsv()` in `src/services/audit/audit.service.ts`
streams the audit log to a browser download and had **no test coverage at
all** — `record()` and `list()` in the same file were already tested.

**Gap found:** nothing exercised the fetch call, the filename parsed from
`content-disposition`, the anchor-click download trigger, or the two error
paths (a parseable JSON error body vs. an unparsable one).

**File modified:** `src/services/audit/audit.service.test.ts`

| Test case                                                                      | Verifies                                                                                                 | Result  |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ------- |
| downloads the CSV and triggers a browser save via an anchor click              | Correct request URL, filename from `content-disposition`, anchor `click()`, object-URL created & revoked | ✅ Pass |
| falls back to a default filename when no content-disposition header is present | Filename defaults to `audit-log.csv`                                                                     | ✅ Pass |
| mirrors the active filters into the export query string                        | `action`, `dateFrom`, `dateTo`, `search` all reach the request                                           | ✅ Pass |
| omits empty filters rather than sending blank params                           | `undefined`/`""` filters never appear in the query string                                                | ✅ Pass |
| throws with the server's error message when the export request fails           | A parseable JSON error body surfaces its `message`                                                       | ✅ Pass |
| falls back to the response status text when the error body can't be parsed     | Unparsable body falls back to `response.statusText`                                                      | ✅ Pass |

## 2. Signup — sector field

Signup's old free-text "Area of work" field was replaced with a `Sector`
dropdown sourced live from Methodology Configuration's domains, plus a
fixed "Other" option that reveals a "Please specify" free-text field.
Neither the new logic nor the stale e2e coverage had been touched since.

**Gap found:** `e2e/auth-flows.spec.ts` still called
`page.getByLabel("Area of work")` — a label that no longer exists —
breaking both signup specs. There was also no unit coverage at all for the
sector dropdown's own behavior.

### Unit tests — `src/components/features/auth/signup-form.test.tsx` (new)

| Test case                                                          | Verifies                                                         | Result  |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | ------- |
| lists every live domain plus a fixed Other option                  | Dropdown renders seeded domain names + the static "Other" entry  | ✅ Pass |
| reveals the free-text field only when Other is selected            | "Please specify" shows for Other, hides for any real sector      | ✅ Pass |
| blocks submission with a validation error until a sector is chosen | `Please select a sector.` shown; `authService.signup` not called | ✅ Pass |
| submits the selected sector with no purpose for a non-Other sector | Payload: `{ sector: "Health", purpose: undefined }`              | ✅ Pass |
| submits the typed description as purpose when Other is selected    | Payload: `{ sector: "other", purpose: "Community Health" }`      | ✅ Pass |

### e2e — `e2e/auth-flows.spec.ts`

| Spec                                                                  | Change                                                                                                      | Status |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------ |
| public signup creates an organization and its first NGO Admin…        | Replaced the dead "Area of work" fill with: open the Sector combobox → pick "Other" → fill "Please specify" | Fixed  |
| signing up with an already-registered registration number is blocked  | Same fix — same dead label was blocking this spec too                                                       | Fixed  |
| signup requires a sector and only shows the free-text field for Other | New spec: submit with no sector → validation error; toggling sectors shows/hides "Please specify" correctly | Added  |

## Verification

- ✅ Full vitest suite green — 8 test files, 43 tests, 0 failures (`npx vitest run`)
- ✅ Lint clean — all three touched/added files pass `eslint` with no warnings
- ✅ Type-check clean — `tsc --noEmit` reports no errors against any touched file
- ⚠️ e2e specs not executed in this session — they require a running backend (`E2E_BACKEND=1`) with seeded data, unavailable here; verified by compilation and lint only

**Note:** both workstreams are test-only. No production code changed —
`downloadCsv()` and the sector dropdown's behavior were already correct;
the gap was exclusively in coverage (and, for the e2e specs, coverage that
had gone stale against a UI change).
