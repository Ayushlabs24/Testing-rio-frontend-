# PR 24 Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PR 24's tenant-scoping, unsaved-summary, permission-gating, and evidence-load error regressions with focused automated coverage.

**Architecture:** Keep the existing service contracts and component structure. Add small exported orchestration helpers only where they make mutation ordering independently testable, while component tests cover permission visibility and error-state rendering.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Vitest 4, Testing Library, next-intl.

## Global Constraints

- No API contract changes.
- No backend authorization assumptions; server enforcement remains mandatory.
- No unrelated component extraction or report-page redesign.
- Existing user changes in the main workspace remain untouched.
- Every production change must be preceded by a regression test that fails for the expected reason.

---

### Task 1: Restore fail-closed organization center scoping

**Files:**

- Create: `src/hooks/use-org-centers-for-governorates.test.ts`
- Modify: `src/hooks/use-org-centers-for-governorates.ts:29-40`

**Interfaces:**

- Consumes: `organizationsService.getCurrent()` and `geographyService.listCenters(governorateId)`.
- Produces: `useOrgCentersForGovernorates(governorateIds)` whose `centers` contains only IDs listed by the current organization.

- [ ] **Step 1: Write the failing tests**

Mock both services, render the hook, and assert that organizations with `centerIds: []` and with an omitted `centerIds` resolve to `centers: []` even when geography returns centers. Add a positive assertion that configured center IDs are retained and foreign IDs are filtered out.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/hooks/use-org-centers-for-governorates.test.ts`

Expected: the empty/missing `centerIds` cases fail because the hook currently returns `lists.flat()`.

- [ ] **Step 3: Implement the minimal fail-closed behavior**

Change the missing/empty branch to return `[]`; retain the existing `Set` filter for configured centers.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/hooks/use-org-centers-for-governorates.test.ts`

Expected: all hook cases pass.

- [ ] **Step 5: Commit the scoped change**

```powershell
git add src/hooks/use-org-centers-for-governorates.ts src/hooks/use-org-centers-for-governorates.test.ts
git commit -m "fix: keep organization center selection tenant scoped"
```

### Task 2: Persist edited combined summaries before report generation

**Files:**

- Create: `src/components/features/priority/combined-summary-tab.test.tsx`
- Modify: `src/components/features/priority/combined-summary-tab.tsx:180-240`

**Interfaces:**

- Consumes: `combinedReportService.updateCombinedSummary`, `confirmCombinedSummary`, and `reportsService.create`.
- Produces: an internal async save/confirm helper used by both explicit save and report generation.

- [ ] **Step 1: Write the failing mutation-order test**

Render the tab with mocked permissions and services, enter edit mode, change the JSON draft, click `Generate Combined Report`, and assert calls occur in this order: update edited JSON, confirm summary, create `RPT16`. Also assert report creation does not run if update or confirmation rejects.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm.cmd test -- src/components/features/priority/combined-summary-tab.test.tsx`

Expected: update is not called and confirmation receives the stale summary path.

- [ ] **Step 3: Implement one save-and-confirm path**

Extract a local async helper that persists `editedJson` when editing, confirms the resulting summary, updates component state, and returns the confirmed summary. Call it from `handleConfirmCombinedSummary` and before `reportsService.create` in `handleGenerateReportPreview`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `npm.cmd test -- src/components/features/priority/combined-summary-tab.test.tsx`

Expected: mutation ordering and failure short-circuit cases pass.

- [ ] **Step 5: Commit the scoped change**

```powershell
git add src/components/features/priority/combined-summary-tab.tsx src/components/features/priority/combined-summary-tab.test.tsx
git commit -m "fix: persist combined summary edits before report generation"
```

### Task 3: Enforce mutation permissions in priority summary tabs

**Files:**

- Modify: `src/components/features/priority/combined-summary-tab.test.tsx`
- Create: `src/components/features/priority/document-based-summary-tab.test.tsx`
- Modify: `src/components/features/priority/combined-summary-tab.tsx:55-65,180-240,420-555`
- Modify: `src/components/features/priority/document-based-summary-tab.tsx:90-100,212-225,300-345,470-510,850-875,1055-1075`

**Interfaces:**

- Consumes: `usePermission("aiReview", "write")`, `usePermission("dataCollection", "write")`, and `usePermission("reportsDashboards", "create")`.
- Produces: mutation controls and handlers that require the matching permission.

- [ ] **Step 1: Write failing read-only component tests**

Mock `usePermission` to return false for mutation actions. Assert combined-summary generation, evidence inclusion switches, summary confirmation, and document-report generation are absent or disabled. Invoke any exported/testable handler path and assert no service mutation occurs.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/components/features/priority/combined-summary-tab.test.tsx src/components/features/priority/document-based-summary-tab.test.tsx`

Expected: currently ungated controls remain visible.

- [ ] **Step 3: Add report-create permission and defensive handler guards**

Read `reportsDashboards.create` in each component. Wrap report-generation controls with `canCreateReport`, wrap inclusion with `canWrite`, retain `canAi` around AI editing/confirmation, and return early inside each mutating handler when its permission is false.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm.cmd test -- src/components/features/priority/combined-summary-tab.test.tsx src/components/features/priority/document-based-summary-tab.test.tsx`

Expected: read-only and authorized cases pass.

- [ ] **Step 5: Commit the scoped change**

```powershell
git add src/components/features/priority/combined-summary-tab.tsx src/components/features/priority/combined-summary-tab.test.tsx src/components/features/priority/document-based-summary-tab.tsx src/components/features/priority/document-based-summary-tab.test.tsx
git commit -m "fix: gate priority report mutations by permission"
```

### Task 4: Distinguish evidence loading errors from empty results

**Files:**

- Modify: `src/components/features/priority/document-based-summary-tab.test.tsx`
- Create: `src/app/[locale]/(app)/studies/[id]/evidence-documents/page.test.tsx`
- Modify: `src/components/features/priority/document-based-summary-tab.tsx:96-160,350-410`
- Modify: `src/app/[locale]/(app)/studies/[id]/evidence-documents/page.tsx:79-145,330-395`
- Modify: `messages/en.json`

**Interfaces:**

- Consumes: the existing `loadData` callbacks and `EvidenceDocuments` translation namespace.
- Produces: a visible error alert with retry button; empty copy only follows a successful empty response.

- [ ] **Step 1: Write failing error-state tests**

Reject the evidence list request, render each UI, and assert an alert contains the failure message and a `Retry` button while empty-state text is absent. Click retry and assert the list request is called again.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `npm.cmd test -- src/components/features/priority/document-based-summary-tab.test.tsx "src/app/[locale]/(app)/studies/[id]/evidence-documents/page.test.tsx"`

Expected: neither UI renders `_error`, so alert and retry assertions fail.

- [ ] **Step 3: Render explicit localized error states**

Rename `_error` to `error`; add `loadErrorTitle` and `retry` translations; render an accessible alert and retry button before the document empty/table branch. Ensure a successful retry clears the error through the existing `setError(null)` call.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run: `npm.cmd test -- src/components/features/priority/document-based-summary-tab.test.tsx "src/app/[locale]/(app)/studies/[id]/evidence-documents/page.test.tsx"`

Expected: error, retry, and successful-empty cases pass.

- [ ] **Step 5: Commit the scoped change**

```powershell
git add messages/en.json src/components/features/priority/document-based-summary-tab.tsx src/components/features/priority/document-based-summary-tab.test.tsx "src/app/[locale]/(app)/studies/[id]/evidence-documents/page.tsx" "src/app/[locale]/(app)/studies/[id]/evidence-documents/page.test.tsx"
git commit -m "fix: surface evidence document loading failures"
```

### Task 5: Full verification

**Files:**

- Verify all files changed in Tasks 1-4.

**Interfaces:**

- Consumes: completed remediation changes.
- Produces: fresh evidence that the branch is review-ready.

- [ ] **Step 1: Run all unit tests**

Run: `npm.cmd test`

Expected: all tests pass. If the two pre-existing report-download tests still fail, verify the same failures reproduce at PR head before classifying them as baseline.

- [ ] **Step 2: Run static verification**

Run: `npm.cmd run typecheck`

Run: `npm.cmd run lint`

Run: `npm.cmd run format:check`

Expected: every command exits 0.

- [ ] **Step 3: Run the production build**

Run: `npm.cmd run build`

Expected: exit 0, or report any environment-only external-resource failure verbatim.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff origin/pr/24...HEAD --check`

Run: `git diff --stat origin/pr/24...HEAD`

Expected: only the approved design, plan, regression tests, translations, and targeted source fixes are present; `package-lock.json` remains excluded.

- [ ] **Step 5: Commit any verification-only corrections**

Stage only intended files and use a narrowly scoped `fix:` or `test:` commit message. Do not stage the install-generated `package-lock.json`.
