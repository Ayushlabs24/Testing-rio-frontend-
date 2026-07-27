# Code Review Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Resolve the confirmed code-review findings without changing existing routes,
business workflows, role behavior, API payloads, visual design, or supported user journeys.

**Architecture:** Changes are divided into independently reversible, test-driven tasks.
Existing public component and service interfaces remain stable unless a backward-compatible
optional parameter is introduced. Backend-owned security requirements are explicit
coordination gates rather than being simulated in the frontend.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 5 strict mode, Tailwind CSS 4,
shadcn/Radix UI, React Hook Form, Zod, next-intl, Vitest, Testing Library, and Playwright.

## Global Constraints

- Do not change existing routes, navigation, permissions, translations, page layouts, or
  business terminology.
- Do not change an API endpoint, request body, response body, cookie name, CSRF header, or
  error contract without a separately approved backend contract.
- Add characterization tests before modifying authentication, downloads, browser storage,
  request cancellation, or route-dependent data loading.
- Keep every task independently testable and reversible.
- Do not use `--no-verify`, delete `.next`, format the repository, or remove a lockfile
  without first preserving unrelated user changes and confirming the exact target.
- Do not declare OTP remediation complete until the backend verification, expiry, attempt
  limiting, rate limiting, and HTTP-only session behavior are evidenced.
- Treat Windows Application Control failures as environmental until the same build fails
  in an approved environment.

---

## File and Interface Map

| Area                      | Files                                                                | Responsibility                                                        |
| ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Authentication            | `src/services/auth/auth.service.ts`, `src/config/env.ts`             | Keep mock OTP out of production and consume the real backend contract |
| API transport             | `src/services/api/client.ts`, `src/services/api/types.ts`            | Compose timeout/cancellation and centralize binary downloads          |
| Downloads                 | report, public-survey, and audit service files                       | Preserve current export behavior through the central client           |
| Storage                   | `src/components/providers/auth-provider.tsx`, notification/SLA hooks | Remove only namespaced RIO state during logout                        |
| Data races                | route components and service methods accepting signals               | Prevent obsolete requests from updating current state                 |
| Runtime typing            | API client and endpoint schemas                                      | Validate untrusted responses with Zod                                 |
| Tooling                   | `tsconfig.json`, `package.json`, lockfiles, Vitest config            | Restore reproducible quality gates                                    |
| Accessibility/performance | selected pages and components                                        | Apply measured, workflow-preserving improvements                      |

---

### Task 1: Establish a Clean and Reproducible Baseline

**Files:**

- Modify if necessary: `tsconfig.json`
- Modify if necessary: `.gitignore`
- Create: `docs/code-review/baseline-results.md`
- Test: existing unit and E2E suites

**Interfaces:**

- Consumes: current repository and generated Next.js route types
- Produces: trusted baseline results and a repeatable type-check procedure

- [ ] **Step 1: Record the working tree without changing it**

  Run:

  ```powershell
  git status --short
  git diff --name-status
  git diff --cached --name-status
  ```

  Expected: all user-owned and staged files are identified. Do not include them in
  remediation commits unless a task explicitly owns them.

- [ ] **Step 2: Confirm the stale generated-type failure**

  Run:

  ```powershell
  npm run typecheck
  ```

  Expected before remediation: `TS2307` references the deleted
  `survey-builder/[needId]/review/page.js` route from `.next/dev/types/validator.ts`.

- [ ] **Step 3: Regenerate types without deleting user files**

  Use the project's clean generated-output procedure. If no script exists, move only the
  resolved repository-local `.next` directory to a temporary backup, run `next typegen`,
  then run TypeScript. Never target a workspace root or an unresolved variable.

  ```powershell
  npx next typegen
  npm run typecheck
  ```

  Expected: the deleted route is no longer referenced. If `next typegen` cannot repair
  stale `.next/dev` output, remove `.next/dev/types/**/*.ts` from the explicit
  `tsconfig.json` include and rely on `.next/types/**/*.ts` generated by Next.

- [ ] **Step 4: Run all available baseline gates**

  ```powershell
  npm run lint
  npm run typecheck
  npm test
  npm run format:check
  npm run build
  npm run test:e2e
  ```

  Expected: record each pass, source failure, backend dependency, or environmental block
  in `docs/code-review/baseline-results.md`.

- [ ] **Step 5: Commit only the baseline correction**

  ```powershell
  git add tsconfig.json docs/code-review/baseline-results.md
  git commit -m "chore: restore reproducible type checking"
  ```

  Expected: an independently reversible commit. Omit `tsconfig.json` if regeneration alone
  fixed the issue.

---

### Task 2: Characterize and Isolate the OTP Flow

**Files:**

- Modify: `src/services/auth/auth.service.ts`
- Modify: `src/config/env.ts`
- Modify: `.env.example`
- Test: `src/services/auth/auth.service.test.ts`
- Test: `e2e/auth-flows.spec.ts`

**Interfaces:**

- Consumes: existing authentication service signatures and backend session-cookie behavior
- Produces: environment-gated mock authentication that cannot enter a production flow

- [ ] **Step 1: Add failing production-mode tests**

  Add tests proving that:

  - Production OTP request calls the configured backend endpoint.
  - Production verification calls the backend and never compares against `"123456"`.
  - No OTP or email is logged.
  - Mock OTP is available only when an explicit test/development flag is enabled.

  Run:

  ```powershell
  npm test -- src/services/auth/auth.service.test.ts
  ```

  Expected: new production-mode tests fail against the current fixed OTP code.

- [ ] **Step 2: Add an explicit validated mock-auth flag**

  Add a boolean such as `NEXT_PUBLIC_ENABLE_MOCK_AUTH` to the Zod environment schema and
  `.env.example`, defaulting to `false`. Validate that production builds reject or ignore
  `true` according to the selected deployment policy.

- [ ] **Step 3: Separate mock and real implementations**

  Keep the public `authService.requestOtp()` and `authService.verifyOtp()` signatures
  stable. Select the mock implementation only under the explicit flag. The production
  implementation must use `apiClient` and the backend endpoints.

- [ ] **Step 4: Remove credential logging**

  Remove the OTP/email `console.info` call entirely. Tests may obtain a mock OTP through a
  test-only helper that is never exported by the production module.

- [ ] **Step 5: Verify frontend behavior**

  ```powershell
  npm test -- src/services/auth/auth.service.test.ts
  npm run lint
  npm run typecheck
  npm run test:e2e -- e2e/auth-flows.spec.ts
  ```

  Expected: local mock tests remain possible only through explicit configuration; the
  production path requires the backend.

- [ ] **Step 6: Complete the backend security gate**

  Obtain evidence that the backend:

  - Stores only hashed, expiring OTPs.
  - Enforces attempt and resend limits per account/IP.
  - Does not disclose account existence.
  - Issues the authenticated session through an HTTP-only, Secure, SameSite cookie.
  - Enforces CSRF for authenticated mutations.

  Expected: record evidence in the remediation checklist. If unavailable, mark the item
  blocked rather than complete.

- [ ] **Step 7: Commit the isolated change**

  ```powershell
  git add src/services/auth/auth.service.ts src/services/auth/auth.service.test.ts src/config/env.ts .env.example e2e/auth-flows.spec.ts
  git commit -m "fix: isolate mock OTP from production authentication"
  ```

---

### Task 3: Compose API Timeout and Caller Cancellation

**Files:**

- Modify: `src/services/api/client.ts`
- Modify: `src/services/api/types.ts`
- Create: `src/services/api/client.test.ts`

**Interfaces:**

- Consumes: `RequestOptions.signal?: AbortSignal` and centralized timeout configuration
- Produces: requests that obey both caller cancellation and timeout

- [ ] **Step 1: Add failing transport tests**

  Test these cases with fake timers and mocked `fetch`:

  - No caller signal: configured timeout aborts the request.
  - Caller signal present: timeout still aborts the request.
  - Caller abort: request stops without being reported as a timeout.
  - Completed request: timer and signal listeners are cleaned up.

  ```powershell
  npm test -- src/services/api/client.test.ts
  ```

  Expected: the caller-signal-plus-timeout test fails.

- [ ] **Step 2: Introduce a typed cancellation error**

  Extend `ApiError` or its details with a stable cancellation distinction while preserving
  the existing timeout status `408` and network status `0`.

- [ ] **Step 3: Compose signals**

  Prefer `AbortSignal.any([callerSignal, timeoutSignal])` when supported by the browser
  targets. Otherwise, forward both signals into one controller and remove event listeners
  in `finally`.

- [ ] **Step 4: Run focused and full verification**

  ```powershell
  npm test -- src/services/api/client.test.ts
  npm test
  npm run lint
  npm run typecheck
  ```

  Expected: every transport test passes and existing service behavior is unchanged.

- [ ] **Step 5: Commit**

  ```powershell
  git add src/services/api/client.ts src/services/api/types.ts src/services/api/client.test.ts
  git commit -m "fix: preserve API timeout with caller cancellation"
  ```

---

### Task 4: Centralize Binary Downloads

**Files:**

- Modify: `src/services/api/client.ts`
- Modify: `src/services/reports/reports.service.ts`
- Modify: `src/services/public-surveys/public-surveys.service.ts`
- Modify: `src/services/audit/audit.service.ts`
- Test: service tests adjacent to the three download services

**Interfaces:**

- Consumes: API base URL, credentials, CSRF/error policy, timeout, and optional signal
- Produces: `apiClient.download(path, options): Promise<Blob>` or an equivalent typed API

- [ ] **Step 1: Characterize all three downloads**

  Test successful blob handling, filename/format preservation, query filters, JSON error
  envelopes, non-JSON errors, network failures, timeout, and cancellation.

  Expected: direct-fetch tests expose inconsistent timeout and network error behavior.

- [ ] **Step 2: Add the central download operation**

  Reuse the central URL builder, credentials, timeout, composed signal, and `ApiError`
  conversion. Do not set JSON `Content-Type` on a bodyless download.

- [ ] **Step 3: Migrate one service at a time**

  Migrate reports, then public-survey responses, then audit CSV. After each migration run
  that service's tests and manually compare generated filenames and filters.

- [ ] **Step 4: Verify no service bypass remains**

  ```powershell
  rg -n "fetch\\(" src/services --glob "*.ts"
  ```

  Expected: only the central API client contains `fetch`, with the documented upload XHR
  exception.

- [ ] **Step 5: Run complete verification**

  ```powershell
  npm test
  npm run lint
  npm run typecheck
  npm run build
  ```

- [ ] **Step 6: Commit**

  ```powershell
  git add src/services/api/client.ts src/services/reports/reports.service.ts src/services/public-surveys/public-surveys.service.ts src/services/audit/audit.service.ts
  git commit -m "refactor: centralize binary API downloads"
  ```

---

### Task 5: Remove Origin-Wide Storage Clearing

**Files:**

- Modify: `src/components/providers/auth-provider.tsx`
- Modify: `src/hooks/use-reviewer-sla-badge.ts`
- Modify: `src/hooks/use-sharing-notifications.ts`
- Create: `src/lib/client-storage.ts`
- Create: `src/lib/client-storage.test.ts`

**Interfaces:**

- Consumes: current SLA/sharing seen-key formats
- Produces: `clearRioSessionStorage(userId?: string): void`

- [ ] **Step 1: Add failing storage-isolation tests**

  Seed RIO-owned keys and an unrelated key. Verify logout removes only RIO-owned keys and
  leaves the unrelated key intact.

- [ ] **Step 2: Centralize namespaced key creation**

  Define a single RIO prefix and helpers for user-specific SLA and sharing keys. Preserve
  compatibility with existing stored keys or migrate them once.

- [ ] **Step 3: Replace `.clear()` calls**

  Capture the current user ID before logout, invoke the namespaced cleanup helper, and
  leave unrelated local/session storage untouched.

- [ ] **Step 4: Verify login/logout workflows**

  ```powershell
  npm test -- src/lib/client-storage.test.ts
  npm test
  npm run test:e2e -- e2e/auth-flows.spec.ts
  ```

  Manually confirm a second user does not inherit the first user's seen-alert state.

- [ ] **Step 5: Commit**

  ```powershell
  git add src/components/providers/auth-provider.tsx src/hooks/use-reviewer-sla-badge.ts src/hooks/use-sharing-notifications.ts src/lib/client-storage.ts src/lib/client-storage.test.ts
  git commit -m "fix: clear only RIO-owned browser storage"
  ```

---

### Task 6: Prevent Route and Filter Stale-Response Races

**Files:**

- Modify first: `src/app/[locale]/(app)/priority-dashboard/[needId]/page.tsx`
- Modify: service methods invoked by the page
- Review and modify only where confirmed: other parameter/filter-dependent effects
- Test: focused page tests using deferred promises

**Interfaces:**

- Consumes: route/filter parameters and optional service `AbortSignal`
- Produces: only the latest request generation may update UI state

- [ ] **Step 1: Reproduce the race**

  Use deferred promises: start request A, change the parameter, start request B, resolve B,
  then resolve A. Assert the UI retains B.

- [ ] **Step 2: Add cancellation**

  Create one controller per effect execution, pass its signal through service methods, and
  abort it in effect cleanup. Ignore only the typed cancellation result.

- [ ] **Step 3: Preserve error semantics**

  Keep current loading and empty states. Surface or log through the established error UI
  any genuine error that was previously silently swallowed.

- [ ] **Step 4: Audit equivalent effects**

  Apply the tested pattern only to effects whose dependencies can change while a request
  is active. Do not mechanically modify every `useEffect`.

- [ ] **Step 5: Verify**

  ```powershell
  npm test
  npm run lint
  npm run typecheck
  npm run test:e2e
  ```

  Manually switch route IDs and filters rapidly and confirm no obsolete state appears.

- [ ] **Step 6: Commit**

  ```powershell
  git add src/app src/services
  git commit -m "fix: ignore obsolete route data responses"
  ```

  Before committing, inspect the staged file list and unstage any file unrelated to this
  task.

---

### Task 7: Validate API Responses and Remove Confirmed Unsafe Types

**Files:**

- Modify: `src/services/api/client.ts`
- Create: `src/services/api/schemas.ts` or endpoint-local schema files
- Modify: `src/components/features/insights/supporting-evidence-panel.tsx`
- Modify: `src/components/features/insights/ai-priority-summary-panel.tsx`
- Modify: service/type files providing their data
- Test: schema and service tests

**Interfaces:**

- Consumes: untrusted JSON
- Produces: schema-validated DTOs inferred with `z.infer`

- [ ] **Step 1: Test malformed responses**

  Add cases for missing required fields, incorrect primitive types, invalid enums, empty
  successful responses, and valid responses with optional fields.

- [ ] **Step 2: Add incremental schema support**

  Let service methods parse their responses or allow the client to accept a Zod schema.
  Keep existing call-site return types stable.

- [ ] **Step 3: Replace the reviewed `any` sites**

  Type evidence list items and priority-summary scope filters through validated DTOs.
  Remove the associated ESLint suppression.

- [ ] **Step 4: Remove unsafe assertions in the touched paths**

  Replace non-null assertions with guards or defaults that match existing UI behavior. Do
  not broaden the task into repository-wide refactoring.

- [ ] **Step 5: Verify**

  ```powershell
  npm test
  npm run lint
  npm run typecheck
  ```

- [ ] **Step 6: Commit**

  ```powershell
  git add src/services/api src/services/evidence src/services/reports src/components/features/insights
  git commit -m "fix: validate reviewed API response boundaries"
  ```

---

### Task 8: Remove Temporary Diagnostics and Review Image Exceptions

**Files:**

- Modify: `src/app/[locale]/(app)/survey-builder/[needId]/page.tsx`
- Modify if justified: `src/components/common/logo.tsx`
- Modify if justified: `src/components/common/org-brand-mark.tsx`
- Modify if needed: `next.config.ts`
- Test: relevant component tests and browser compatibility specs

**Interfaces:**

- Consumes: existing brand assets and organization logo URLs
- Produces: unchanged visual output without sensitive production diagnostics

- [ ] **Step 1: Remove temporary survey-builder logging**

  Delete the `[QB-DEBUG]` logs and their temporary comments. Retain the data-loading logic.

- [ ] **Step 2: Characterize logo rendering**

  Assert correct source, alt behavior, dark/light variant visibility, dimensions, and link
  target before replacing an image implementation.

- [ ] **Step 3: Decide each image independently**

  Keep static SVG `<img>` only as a documented accepted exception. For organization URLs,
  use `next/image` only after defining safe allowed origins and stable dimensions. Do not
  introduce a wildcard remote host.

- [ ] **Step 4: Verify**

  ```powershell
  rg -n "console\\.(log|debug|info)" src
  npm test
  npm run lint
  npm run test:e2e -- e2e/browser-compat.spec.ts
  ```

- [ ] **Step 5: Commit**

  ```powershell
  git add src/app/[locale]/(app)/survey-builder/[needId]/page.tsx src/components/common/logo.tsx src/components/common/org-brand-mark.tsx next.config.ts
  git commit -m "chore: remove diagnostics and document image policy"
  ```

  Quote or use literal paths in PowerShell because route paths contain brackets and
  parentheses.

---

### Task 9: Select One Package Manager and Normalize Formatting

**Files:**

- Modify: `package.json`
- Keep one: `package-lock.json` or `pnpm-lock.yaml`
- Remove one: the unused lockfile
- Create or modify: `.gitattributes`
- Modify mechanically: files reported by Prettier

**Interfaces:**

- Consumes: the selected package manager and Prettier version
- Produces: reproducible clean installs and stable line endings

- [ ] **Step 1: Confirm package-manager ownership**

  Use repository/CI history and team policy. Current evidence favors npm because scripts
  and `package-lock.json` are established, while `pnpm-lock.yaml` is untracked. Obtain team
  confirmation before deleting either lockfile.

- [ ] **Step 2: Pin the package manager**

  Add an exact `packageManager` field, for example the approved npm version. Regenerate only
  the selected lockfile using the matching tool.

- [ ] **Step 3: Stabilize line endings**

  Add a reviewed `.gitattributes` policy. Run Prettier as a formatting-only change and
  verify `git diff --word-diff=porcelain` contains no semantic edits.

- [ ] **Step 4: Verify clean installation**

  In a disposable worktree or CI environment:

  ```powershell
  npm ci
  npm run lint
  npm run typecheck
  npm test
  npm run format:check
  npm run build
  ```

  Substitute the approved pnpm frozen-lockfile commands if pnpm is selected.

- [ ] **Step 5: Commit separately**

  ```powershell
  git add package.json package-lock.json .gitattributes
  git commit -m "chore: standardize package management"
  git add -u
  git commit -m "style: normalize repository formatting"
  ```

  Adapt the lockfile path to the approved package manager. Never combine formatting with
  functional remediation.

---

### Task 10: Remove Redundant Vitest Path Plugin

**Files:**

- Modify: `vitest.config.ts`
- Modify: `package.json`
- Modify: selected lockfile

**Interfaces:**

- Consumes: TypeScript `@/*` path mapping
- Produces: native Vite path resolution with unchanged test imports

- [ ] **Step 1: Switch to native resolution**

  Configure `resolve.tsconfigPaths: true`, remove the plugin import and invocation, then
  remove `vite-tsconfig-paths`.

- [ ] **Step 2: Verify every test**

  ```powershell
  npm test
  npm run typecheck
  npm run lint
  ```

  Expected: all aliases resolve and the deprecation warning disappears.

- [ ] **Step 3: Commit**

  ```powershell
  git add vitest.config.ts package.json package-lock.json
  git commit -m "chore: use native Vite tsconfig paths"
  ```

---

### Task 11: Perform Focused Accessibility and RSC/Performance Review

**Files:**

- Modify only verified failures in `src/app` and `src/components`
- Add: focused component/Playwright accessibility tests
- Update: `docs/code-review/remediation-checklist.md`

**Interfaces:**

- Consumes: current visual design and workflows
- Produces: accessible behavior and measured performance improvements

- [ ] **Step 1: Audit high-use workflows manually**

  Test login/signup, dashboard navigation, studies, needs, survey builder, public surveys,
  reports, settings, dialogs, downloads, theme switching, and responsive navigation using
  keyboard-only operation and a screen reader.

- [ ] **Step 2: Fix confirmed accessibility defects**

  Address missing accessible names, label/error association, focus restoration, heading
  order, landmarks, image alternatives, and contrast one defect at a time with regression
  tests.

- [ ] **Step 3: Measure client boundaries**

  Use build output and bundle analysis to identify genuinely large Client Components. Move
  initial read-only fetching to Server Components only when the session-cookie and backend
  deployment topology supports server access without changing behavior.

- [ ] **Step 4: Add loading boundaries selectively**

  Add `loading.tsx` only to routes with measured or observed latency. Match the existing
  page structure to prevent layout shift.

- [ ] **Step 5: Evaluate QR dynamic loading**

  Dynamically import `qrcode.react` only if bundle measurement shows meaningful savings
  and the loading state does not disrupt its workflow.

- [ ] **Step 6: Verify**

  ```powershell
  npm run lint
  npm run typecheck
  npm test
  npm run build
  npm run test:e2e
  ```

  Record manual WCAG checks in the separate checklist.

- [ ] **Step 7: Commit each independently reviewed correction**

  Use one commit per accessibility or performance concern; do not create a catch-all
  refactor commit.

---

### Task 12: Final Regression and Security Sign-Off

**Files:**

- Update: `docs/code-review/remediation-checklist.md`
- Update: `docs/code-review/baseline-results.md`

**Interfaces:**

- Consumes: all completed remediation tasks
- Produces: auditable sign-off evidence

- [ ] **Step 1: Verify a clean checkout**

  Install using the single selected lockfile and run every automated gate.

- [ ] **Step 2: Run workflow regression testing**

  Verify:

  - Login, OTP, logout, password reset, and session restoration.
  - Each role's navigation and authorization responses.
  - Study/need creation and editing.
  - Classification and survey-builder workflows.
  - Public-survey response and insight workflows.
  - Reports, audit, and all download formats.
  - Theme, locale routing, mobile navigation, and supported browsers.

- [ ] **Step 3: Verify security evidence**

  Confirm the production bundle contains no fixed OTP, mock session creation, or sensitive
  logging. Attach backend evidence for OTP, authorization, rate limiting, validation,
  cookie flags, and CSRF.

- [ ] **Step 4: Compare against the baseline**

  Confirm no intended behavior, API contract, translation, route, role permission, or
  visual workflow changed unexpectedly.

- [ ] **Step 5: Complete the checklist**

  Every item must be marked complete, blocked with an owner and reason, or explicitly not
  applicable with evidence. No ambiguous unchecked items remain at release sign-off.
