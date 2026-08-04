# PR 24 Review Remediation Design

## Goal

Resolve the five actionable findings from the PR 24 review without broadening the feature or refactoring unrelated report code.

## Design

### Organization center scoping

`useOrgCentersForGovernorates` remains fail-closed. If the current organization has no `centerIds`, the hook returns an empty list. It never substitutes every center in the selected governorates.

### Combined report generation

Report generation uses the same draft-persistence path as explicit summary saving. When an officer has edited a draft, generation first persists `editedJson`, then confirms the updated summary, then creates the RPT16 report. The mutation handler also checks the required permission, independently of whether its button is visible.

### Permission enforcement in the UI

Evidence inclusion requires `dataCollection.write`. AI-summary editing and confirmation require `aiReview.write`. Report-generation controls require the existing report creation permission used elsewhere in the application. Controls are hidden or disabled for readers, and their handlers return without issuing requests when permission is absent.

### Error states

Evidence-document loading distinguishes three states: loading, failed, and successfully empty. A failed load renders the service error with a retry action. Empty-state copy is shown only after a successful response containing no documents.

## Testing

Regression tests are written before production changes and cover:

- an organization with missing or empty `centerIds` receives no centers;
- edited combined-summary JSON is persisted before confirmation and report creation;
- read-only users cannot trigger or see mutation controls;
- failed evidence loads render an error and retry action instead of empty-state copy.

After focused tests pass, run the complete unit suite, TypeScript checking, ESLint, and a production build where the environment permits it.

## Scope constraints

- No API contract changes.
- No backend authorization assumptions; server enforcement remains mandatory.
- No unrelated component extraction or report-page redesign.
- Existing user changes in the main workspace remain untouched.
