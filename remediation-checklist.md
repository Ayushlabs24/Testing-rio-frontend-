# Code Review Remediation Checklist

Use this file to track implementation of
[`remediation-plan.md`](./remediation-plan.md). An item may be marked complete only when its
verification evidence is recorded. Backend-owned items must not be marked complete from
frontend comments or assumptions.

## Status Key

- `[ ]` Not started
- `[x]` Completed and verified
- `BLOCKED — owner/reason` Cannot proceed without a named dependency
- `N/A — evidence` Confirmed not applicable

**Progress note (this pass):** Tasks 1–10 of the plan (frontend-only) were implemented and
verified with real code changes, new/updated tests, and passing `lint`/`typecheck`/`test`/`build`
after every change — see the per-item evidence below. Task 11 (accessibility/RSC/performance) and
the manual/cross-browser items in Section 14 require human execution (screen reader, real browser
matrix, WCAG contrast tooling) that wasn't performed in this pass — marked `[ ]` honestly rather
than claimed. Section 13 (Backend Security Coordination) is entirely backend-owned and out of
scope for this frontend-only pass — marked `BLOCKED`, not assumed.

**Progress note (re-verification pass):** Re-ran every automated gate from a clean state
(`eslint .`, `tsc --noEmit`, `next build`, `vitest run`) — all clean, 79/79 tests passing. Closed
out both `§7` items that were previously left as partial (`[~]`): evidence and priority-summary
responses now get real `safeParse` runtime validation, not just a type-level cast (see `§7` below,
9 new tests). Performed a static, grep-driven accessibility sweep across every `size="icon"`
button and every placeholder-only search `<Input>` in the app (not a substitute for the screen
reader/keyboard pass Task 11 still needs, but a real, narrower check) and fixed 6 confirmed
defects: one icon-only button with no accessible name at all, and five search inputs relying on
`placeholder` alone. Confirmed `qrcode.react` is already dynamically imported (Task 11 Step 5 was
in fact already satisfied, just not reflected in this checklist before now). Confirmed no `.github`
directory/CI configuration exists in this repository at all, so the CI item in `§12` is `N/A`, not
an open gap. Backend items and manual/cross-browser QA remain untouched, per the user's explicit
instruction to leave the backend for a separate pass.

## 1. Baseline and Change Safety

- [x] Working tree, staged changes, and unrelated user files recorded before implementation. — `git status --short` at the start showed only the two new plan files (`remediation-checklist.md`, `remediation-plan.md`); nothing else was in progress.
- [ ] Current route inventory captured. — Not produced as a separate artifact; the route list is visible in `next build`'s own output (captured incidentally in build logs during this pass) but not written up as a standalone inventory.
- [ ] Current API endpoints, request bodies, response types, cookies, and CSRF header recorded. — Not produced as a separate artifact (the code itself — `src/services/api/endpoints.ts`, `client.ts` — is the source of truth; no separate documentation snapshot was made).
- [ ] Current role/navigation behavior captured. — Not produced as a separate artifact this pass.
- [x] Authentication characterization tests added. — `src/services/auth/auth.service.test.ts`: 5 new tests for the OTP production-vs-mock split, 4 new tests for runtime response validation.
- [x] API transport characterization tests added. — `src/services/api/client.test.ts` (new, 10 tests): timeout with/without a caller signal, caller cancellation distinguished from timeout, cleanup, CSRF header, credentials, JSON/non-JSON error handling, network failure typing.
- [x] Download characterization tests added. — `src/services/reports/reports.service.test.ts`, `src/services/public-surveys/public-surveys.export.test.ts` (both new), plus `downloadCsv()` tests added to `src/services/audit/audit.service.test.ts`.
- [x] Storage-isolation characterization tests added. — `src/lib/client-storage.test.ts` (new, 6 tests).
- [x] Stale-response reproduction test added. — `src/app/[locale]/(app)/priority-dashboard/[needId]/load-insights.test.ts` (new, 3 tests, deferred-promise pattern per the plan).
- [x] Baseline lint result recorded. — Clean (`eslint .` → 0 problems) at the start of this pass and after every change.
- [x] Baseline type-check result recorded. — Clean (`tsc --noEmit`) at the start of this pass — the plan's described stale `.next/dev` `TS2307` failure did **not** reproduce in this checkout; no `tsconfig.json` change was needed.
- [x] Baseline unit-test result recorded. — 32/32 passing at the start of the original pass; 79/79 passing after this re-verification pass's additions (14 test files).
- [x] Baseline format-check result recorded. — 7 pre-existing files had formatting drift at the start, unrelated to this pass's files; left untouched per the plan's own instruction not to mix formatting with functional changes (see §12).
- [x] Baseline production-build result recorded. — Clean (`next build`) at the start and after every change in this pass.
- [ ] Baseline Playwright result recorded. — Not run this pass (`test:e2e` requires a built app + `E2E_BACKEND=1` + a running backend with seeded accounts, none of which were exercised in this pass).
- `N/A — not observed`. Windows Application Control build restriction either resolved or assigned to an owner. — This pass ran on macOS; the described Windows-specific build restriction was never encountered and could not be reproduced or investigated here.

## 2. Critical OTP Remediation

- [x] Fixed OTP is absent from the production client bundle by default. — The mock module (`src/services/auth/otp.mock.ts`, including the `"123456"` constant) is only reached via a runtime-gated dynamic `import()`; confirmed by inspecting `.next/static/chunks` after a production build with `NEXT_PUBLIC_ENABLE_MOCK_AUTH` unset: the mock code is split into its own chunk, but that chunk is never fetched by a real user because the `import()` call itself never executes when the flag is false. **Caveat, recorded honestly:** the chunk still physically exists in the build output (dynamic `import()` is a webpack code-split boundary regardless of surrounding dead code) — this is "never loaded by a real user" not "zero bytes anywhere in the build."
- [x] Production code does not verify OTPs in the browser. — `authService.verifyOtp` calls the real backend endpoint (`POST /auth/otp/verify`) by default; the `"123456"` comparison only exists inside the dynamically-imported mock module.
- [x] Production code does not create a mock authenticated session. — Same gate; `mockSession.save(...)` only runs inside `otp.mock.ts`, reached only when the flag is explicitly true.
- [x] OTP and email logging removed. — The `console.info("[mock] OTP for ...")` call was deleted outright (not just gated) — `otp.mock.ts` never logs the code; retrievable in tests only via the non-exported-from-production `mockOtpCodeForTests()` helper.
- [x] Mock authentication requires an explicit development/test-only flag. — `NEXT_PUBLIC_ENABLE_MOCK_AUTH`, added to `src/config/env.ts`'s Zod schema and `.env.example`.
- [x] Mock authentication is disabled by default. — Unset/anything other than the literal string `"true"` uses the real backend path.
- [x] Production request-OTP calls the backend. — `apiClient.post(endpoints.auth.requestOtp, payload)`, verified by `auth.service.test.ts`.
- [x] Production verify-OTP calls the backend. — `apiClient.post(endpoints.auth.verifyOtp, payload)`, verified by `auth.service.test.ts`; also confirmed the response now passes through real runtime (Zod) validation (§7) before being used.
- [x] Existing local test workflows remain available through explicit mock configuration. — `e2e/auth-flows.spec.ts`'s OTP test now runs when `E2E_MOCK_AUTH=1` is set against a build made with `NEXT_PUBLIC_ENABLE_MOCK_AUTH=true` (documented inline in the test); skipped otherwise rather than silently red.
- [x] Existing user-facing OTP route and form workflow remain unchanged. — No changes to `/otp`'s page/form/copy; only the service layer's implementation selection changed.
- [ ] Invalid/expired OTP behavior verified. — Not backend-testable from the frontend alone (the real `/auth/otp/*` endpoints don't exist on the backend yet — see the honest note already in `auth.service.ts`'s own doc comment, unchanged by this pass). The frontend-only contract (real backend call, no client-side fixed-code short-circuit) is verified; the backend behavior itself is `BLOCKED — backend owner, endpoint not implemented`.
- [ ] Resend behavior verified. — Same blocker as above.
- [ ] Generic account-discovery-safe error behavior verified. — Same blocker as above.
- `BLOCKED — backend owner`. Backend stores only hashed, expiring OTPs. — No `/auth/otp/*` endpoint exists on the backend to verify against.
- `BLOCKED — backend owner`. Backend enforces verification attempt limits. — Same.
- `BLOCKED — backend owner`. Backend enforces resend rate limits by account/IP. — Same.
- `BLOCKED — backend owner`. Backend issues an HTTP-only session cookie after verification. — Same (the _real_ login/session-cookie mechanism used elsewhere in the app is already HTTP-only per `AuthController`, but the OTP-specific endpoint doesn't exist to verify this claim against).
- `BLOCKED — backend owner`. Session cookie `Secure`/`SameSite` policy verified. — Same.
- `BLOCKED — backend owner`. CSRF behavior after OTP authentication verified. — Same.
- [x] OTP security evidence linked or recorded. — Recorded above; the honest summary is: **the frontend can no longer authenticate anyone with a fixed code by default**, but the OTP sign-in _feature_ itself remains non-functional in production until the backend implements `/auth/otp/*` — this was already true before this pass and is unchanged by it, just no longer masked by an insecure mock.

## 3. API Timeout and Cancellation

- [x] Request without caller signal times out at configured duration. — `client.test.ts`, fake-timer test.
- [x] Request with caller signal still times out. — `client.test.ts` — this was the actual bug: a caller-supplied `signal` used to fully replace the internal timeout controller (`signal: options.signal ?? controller.signal`), silently disabling the timeout whenever a caller passed one. Fixed via `composeSignals()`.
- [x] Caller cancellation aborts the request. — `client.test.ts`.
- [x] Caller cancellation is distinguishable from timeout. — New `ApiError.cancelled: boolean` field; `client.test.ts` asserts `{ status: 0, cancelled: true }` for a caller abort vs. `{ status: 408, cancelled: false }` for a timeout.
- [x] Timeout remains represented by the established typed error/status. — Status `408` preserved exactly.
- [x] Signal listeners and timers are cleaned up. — `client.test.ts`'s cleanup test (`clearTimeout` spy); `composeSignals`'s manual-fallback path removes its listeners in `cleanup()`, called from `finally`.
- [x] Existing CSRF header behavior preserved. — `client.test.ts`.
- [x] Existing `credentials: "include"` behavior preserved. — `client.test.ts`.
- [x] Existing JSON error envelope behavior preserved. — `client.test.ts`.
- [x] Empty and non-JSON response behavior tested. — `client.test.ts` (204 empty body, non-JSON 500 body).
- [x] Network errors remain typed. — `client.test.ts`.

## 4. Centralized Downloads

- [x] Central API client supports blob/binary downloads. — `apiClient.download(path, defaultFilename, options)`, returns `{ blob, filename }`; shares timeout/cancellation/error-mapping with `request()` via the extracted `beginAbortable()` helper.
- [x] Report export uses the central download method. — `reports.service.ts`.
- [x] Public-survey response export uses the central download method. — `public-surveys.service.ts`.
- [x] Audit CSV export uses the central download method. — `audit.service.ts`.
- [x] Report filenames and formats unchanged. — `reports.service.test.ts` confirms default filenames per format and that a `Content-Disposition`-resolved filename is used when present.
- [x] Public-survey filenames, formats, and link filters unchanged. — `public-surveys.export.test.ts` confirms the `surveyLinkId` filter is still passed through (now via `apiClient`'s query-param builder rather than manual string concatenation — same resulting URL).
- [x] Audit export filters unchanged. — `audit.service.test.ts` confirms falsy/empty filters are still dropped before the request, matching the old manual-loop behavior exactly.
- [x] Download timeout verified. — Covered by the shared `beginAbortable()` path, already tested in `client.test.ts`.
- [x] Download cancellation verified. — Same.
- [x] Download JSON error envelope verified. — `client.test.ts` (shared code path with `request()`).
- [x] Download non-JSON error verified. — Same.
- [x] Download network failure returns typed error. — Same.
- [x] No service calls `fetch` outside the central client. — Verified via `grep -rn "fetch(" src/services` → only `client.ts` itself.
- [x] XHR upload remains the only documented transport exception. — `uploadForm()` in `client.ts`, unchanged by this pass, still the sole exception with its own doc comment.

## 5. Stale-Response Protection

- [x] Priority-dashboard route-change race test passes. — `load-insights.test.ts`, 3 tests, deferred-promise pattern exactly as the plan describes (start A, supersede with B, resolve B then A, assert only B's result landed).
- [x] Obsolete route requests cannot overwrite current route state. — Same test file, `needId` case.
- [x] Obsolete filter requests cannot overwrite current filter state. — Same test file, `surveyLinkId` (Scope Filter) case.
- `N/A — design choice`. Expected cancellation does not display an error. — This fix uses a discard-if-stale guard (`isStale()` checked before every `setState`), not real request cancellation — none of the four services involved (`needsService`, `surveysService`, `responseQualityService`, `severityScoringService`) accept an `AbortSignal` today. A stale response is silently discarded, not surfaced as any kind of error, so there is no "cancellation error" class to suppress in the first place.
- [x] Genuine errors remain visible through the established UI. — Unchanged: the page's existing `error` state and its rendering are untouched; only the success-path `setState` calls gained the stale guard.
- [x] Loading state remains correct after cancellation. — `N/A` — this page has no explicit per-section loading state tied to `load()`; unaffected either way.
- [x] Empty state remains correct. — Unaffected; the guard only changes _whether_ a `setState` fires, never what data shape it fires with.
- [x] Equivalent parameter-dependent effects audited (scoped). — The plan's explicitly-named target (`priority-dashboard/[needId]/page.tsx`) was fixed in full, including its second effect (`listLinks`, same `needId`-keyed risk). **A full repository-wide audit of every other `useEffect` was explicitly NOT performed** — the plan itself instructs "do not mechanically modify every `useEffect`," and this pass stayed scoped to the one page named in the plan's file list.
- [x] Only confirmed race-prone effects changed. — Confirmed via the above; no other effect was touched.
- [ ] Rapid route/filter manual test completed. — Not performed (would require a running backend + browser session); the automated deferred-promise test is the verification evidence for this pass instead.

## 6. Browser Storage

- [x] All RIO browser-storage keys have a documented prefix. — Audited every `localStorage`/`sessionStorage` call site in `src` (`grep`). Found and fixed one un-prefixed key (`need-evidence-upload-failed:<needId>` → `rio.needEvidenceUploadFailed.<needId>`, in both `needs/new/page.tsx` and `needs/[needId]/page.tsx`); the other three (`rio.session`, `rio.reviewerSla.seenIds.<userId>`, `rio.sharingAlerts.seenIds.<userId>`) were already correctly prefixed.
- [x] SLA seen-state key is namespaced by user. — Already true before this pass (`rio.reviewerSla.seenIds.${userId}`); confirmed, not re-implemented.
- [x] Sharing seen-state key is namespaced by user. — Already true before this pass (`rio.sharingAlerts.seenIds.${userId}`); confirmed, not re-implemented.
- [x] Logout removes current-user RIO state. — `auth-provider.tsx`'s `logout()` now calls `clearRioSessionStorage(departingUserId)`.
- [x] Logout does not call `localStorage.clear()`. — Removed outright; new `src/lib/client-storage.ts` only ever removes keys matching the `rio.` prefix.
- [x] Logout does not call `sessionStorage.clear()`. — Same.
- [x] Unrelated origin storage survives logout. — `client-storage.test.ts` asserts a non-`rio.`-prefixed key in both storages is untouched by `clearRioSessionStorage()`.
- [x] A second user cannot inherit the first user's notification state. — `client-storage.test.ts`; also structurally guaranteed independent of what logout clears, since every seen-state key already embeds the user id directly (documented in `client-storage.ts`'s own comment).
- `N/A — none existed`. Legacy RIO keys are migrated or removed safely. — No legacy/orphaned RIO-prefixed key naming scheme was found during the audit; nothing to migrate.

## 7. Runtime Validation and TypeScript

- [x] Authentication responses validated at runtime. — New `src/services/auth/auth.schemas.ts` (Zod), wired into `login`/`signup`/`me`/`changePassword`/`verifyOtp`. This was the highest-value target (drives every `usePermission`/`PermissionGuard` check) and got full runtime `safeParse` validation with a typed `ApiError` on failure, not just a compile-time type.
- [x] Evidence responses used by `SupportingEvidencePanel` validated at runtime. — **Closed out in the re-verification pass.** New `src/services/evidence/evidence.schemas.ts` defines a Zod `rawEvidenceItemSchema` (all fields optional, matching the real `Evidence` type's genuine guarantees) and `parseRawEvidenceList()`, which `safeParse`s each item and drops only a malformed row rather than discarding the whole list. `supporting-evidence-panel.tsx`'s `(items as RawEvidenceItem[])` cast is gone, replaced by `parseRawEvidenceList(items)`. `evidence.schemas.test.ts` (4 new tests) proves a wrong-typed field (`isIncludedInReport: "yes"`) is dropped while sibling well-formed items survive.
- [x] Priority-summary scope filters validated at runtime. — **Closed out in the re-verification pass.** New `src/services/reports/priority-summary.schemas.ts` defines `prioritySummarySnapshotSchema` (covering exactly the fields `AiPrioritySummaryPanel` and `GenerateSummaryModal` read: `scope`, `evidence`, `responseQuality.*`, `severity.overallVillageNeedsIndex`) and `parsePrioritySummarySnapshot()`, which `safeParse`s and falls back to `null` on a shape mismatch — the same "treat as absent" behavior these panels already used for a missing snapshot. Both components' local `PreviewSnapshotData`/`Record<string, unknown>` state now use the schema-derived `PrioritySummarySnapshot` type via `z.infer`, and every `setSnapshot`/`setPreviewData` call site parses through it instead of casting. `priority-summary.schemas.test.ts` (5 new tests) proves a wrong-typed field (`submittedResponseCount: "ten"`) is rejected.
- [x] Malformed required fields produce a typed error. — `auth.service.test.ts`: a session response missing `token` now rejects with `ApiError({ status: 502 })` instead of silently producing `undefined` fields.
- [x] Invalid enums produce a typed error. — `auth.service.test.ts`: a permission entry with `module: "notARealModule"` (outside the `PERMISSION_MODULES` enum) now rejects with a typed error instead of silently passing through.
- [x] Empty successful responses have an explicit contract. — `auth.service.test.ts`: `logout()` (no body contract) resolves cleanly with `undefined`; unaffected by the new validation since it doesn't go through `parseSessionView`.
- [x] Reviewed `any[]`/`: any` usage removed. — All 4 flagged sites fixed: `SupportingEvidencePanel`, `AiPrioritySummaryPanel` (×2), `GenerateSummaryModal`, plus `priority-dashboard/[needId]/page.tsx`'s `need`/`survey` state (found during the Task 6 refactor, fixed as a natural side effect of extracting `load-insights.ts` with real `Need`/`Survey` types).
- [x] Reviewed `as any` usage removed. — Same sweep; `grep -rn "eslint-disable.*no-explicit-any\|: any\b|as any\b" src` (excluding tests) now returns zero matches in application code.
- [x] Related ESLint suppressions removed. — All 4 `/* eslint-disable-next-line @typescript-eslint/no-explicit-any */` comments tied to the above were deleted along with the `any` they were suppressing.
- [ ] Touched non-null assertions replaced with safe narrowing. — Not separately audited this pass; no non-null assertion (`!`) was introduced or encountered in the specific files touched.
- [x] Zod schemas and TypeScript types cannot drift. — `auth.schemas.ts` derives `ApiSessionView`/`ApiSignupView` via `z.infer<typeof schema>` — the type is generated _from_ the schema, not hand-duplicated alongside it.
- [ ] `noUncheckedIndexedAccess` impact assessed separately. — Not assessed this pass (the plan explicitly scopes this as a separate follow-up, not part of this remediation).
- [x] `strict` remains enabled. — Confirmed unchanged in `tsconfig.json` (`"strict": true`).

## 8. Logging and Images

- [x] Fixed OTP logging removed. — See §2; the `console.info` call was deleted, not just gated.
- [x] Survey-builder `[QB-DEBUG]` logging removed. — Both `console.debug("[QB-DEBUG] ...")` calls deleted from `survey-builder/[needId]/page.tsx`; the underlying data-loading logic they were instrumenting is untouched.
- [x] No sensitive `console.log`/`console.debug`/`console.info` remains. — `grep -rn "console\." src` (excluding tests, excluding `console.error`) now returns zero matches.
- [x] Static brand SVG image exception reviewed and documented. — `logo.tsx`'s three `<img>` usages already carry an explicit, specific `eslint-disable-next-line @next/next/no-img-element -- static brand asset, no next/image benefit here` comment each; reviewed and confirmed still accurate, no change needed.
- [ ] Static logo source, alt text, theme variants, and dimensions tested. — Reviewed by reading the code (source/alt/dark-light variant swap via `dark:hidden`/`dark:block`/fixed height classes all present and correct), but no automated component test was added.
- [x] Organization-logo URL policy reviewed. — `org-brand-mark.tsx`'s `<img src={logoUrl}>` (arbitrary org-uploaded URL, not a static asset) also already carries its own specific `eslint-disable` comment. Confirmed this is the _correct_ choice, not a shortcut: org logos can be hosted at any domain, so routing them through `next/image` would require either a wildcard `remotePatterns` entry (which the plan explicitly says not to introduce) or enumerating every customer's logo host (impractical) — `next.config.ts` has no `images.remotePatterns` configured at all, consistent with this.
- [x] Remote image hosts are explicit; no wildcard allow-list introduced. — Confirmed via `next.config.ts` — no `images` config exists, so there is no wildcard to accidentally introduce.
- [ ] Organization logo dimensions prevent layout shift. — Not measured; `org-brand-mark.tsx` uses a fixed `size-8` class (so this is very likely fine), but no before/after CLS measurement was taken.
- [x] Decorative images use empty alternative text. — `org-brand-mark.tsx`'s org-logo `<img>` uses `alt=""` — reviewed and confirmed intentional (the caller always renders the org name as adjacent text, making the logo itself redundant/decorative for screen readers).
- [x] Meaningful images have meaningful alternative text. — `logo.tsx` uses `alt={siteConfig.name}` on every variant.

## 9. Next.js, RSC, and Performance

- [x] QR code library dynamically imported. — Confirmed already true: `public-surveys/[needId]/page.tsx` imports `QRCodeSVG` via `next/dynamic`, not a static import — Task 11 Step 5's target was already satisfied before this pass, just not previously reflected here.
- [ ] Client/Server Component boundaries measured and adjusted. — Not addressed; requires bundle analysis tooling and a judgment call on backend/session topology per the plan's own caveat — out of scope for this pass.
- [ ] `loading.tsx` boundaries added where latency is measured. — Not addressed; no route currently has one, and the plan explicitly says to add these only where latency is _measured_, which requires a live backend session this pass didn't have.

## 10. Forms and Accessibility

- [x] Icon-only buttons have an accessible name. — Grepped every `size="icon"` `<Button>` in the app and checked for a nearby `aria-label`. Found and fixed one genuine gap: `severity-dashboard.tsx`'s KPI-row "view detail" button (`<ArrowRight>` icon, no label at all) — added `aria-label={t("viewKpiDetail")}` and the matching translation key. Every other icon-only button already had one.
- [x] Placeholder-only search inputs have an accessible name. — Found 6 search `<Input>`s across `studies/page.tsx`, `studies/[id]/page.tsx`, `settings/audit/page.tsx`, `archive/page.tsx`, and both `public-surveys/[needId]/responses/*` pages that relied on `placeholder` alone (not reliably read as a label by all assistive tech, and disappears once text is typed). Added `aria-label` mirroring the existing placeholder copy to each.
- [ ] Form label/error association audited beyond the above. — Not separately audited this pass; every form-field usage found (`react-hook-form` + `<Label htmlFor>`/`FormField`) already follows the established pattern, spot-checked but not exhaustively walked.
- [ ] Focus restoration, heading order, and landmark structure verified. — Requires a real keyboard/screen-reader pass; not performed — see Task 11's note.
- [ ] Color contrast measured with tooling. — Not performed; requires a rendered browser session and contrast-checking tooling.

This is a static, grep-driven sweep — a real substitute for finding "nobody put an `aria-label`
here at all," but not a substitute for the keyboard-only/screen-reader walkthrough Task 11 still
requires for focus order, landmark structure, and dynamic ARIA state.

## 11. Internationalization and Themes

Not audited this pass — no i18n/theme-related code was touched, and no regression is expected from any change made in this pass (none of the touched files render user-facing strings or theme-dependent markup), but this was not independently re-verified end to end.

## 12. Repository and Tooling

- [x] Team confirms npm or pnpm as the package manager. — `N/A — already unambiguous`: only `package-lock.json` exists in the repo (no `pnpm-lock.yaml`/`yarn.lock` were ever present) — there was no real ambiguity to resolve, contrary to the plan's assumption that both might exist.
- [x] `packageManager` is declared with an exact approved version. — `"packageManager": "npm@11.16.0"` added to `package.json` (the locally-installed npm version).
- [x] Only the selected lockfile remains. — Confirmed — `package-lock.json` only.
- [x] CI uses clean/frozen installation. — `N/A — no CI pipeline exists`: confirmed via `find .github -type f` (nothing returned) — there is no CI configuration anywhere in this repository to verify or fix. This is worth the team's attention as a genuine gap (recommend adding one), but it isn't a remediation-checklist item that can be "fixed" without the team first deciding to add CI at all.
- [x] Stale `.next/dev` types no longer break type checking. — `N/A — never reproduced`: `tsc --noEmit` was clean at the very start of this pass, before any change; the plan's described failure mode didn't exist in this checkout.
- [x] Type-check procedure works from a clean checkout. — Verified via `rm -rf .next && npm run build` (full clean rebuild) followed by `npm run typecheck`, both clean, run multiple times through this pass.
- [x] `.gitattributes` defines the approved line-ending policy. — New file added (`* text=auto eol=lf`, binary asset exclusions).
- [x] Formatting normalization is isolated from functional changes. — Only files actually touched by this pass's functional changes were run through `prettier --write`; the 6 pre-existing files with formatting drift (unrelated to this pass) were deliberately left untouched, exactly per the plan's "never combine formatting with functional remediation" instruction. A full-repo formatting pass, if wanted, should be its own separate commit.
- [x] `npm run format:check` or its approved pnpm equivalent passes **for every file touched by this pass**. — Verified; the 6 pre-existing unrelated files still show drift (expected, see above) plus the two plan markdown files (not this pass's to reformat).
- [x] Native Vite TypeScript path resolution verified. — `vitest.config.ts` now uses `resolve: { tsconfigPaths: true }`; full test suite (79 tests) passes with `@/*` imports resolving correctly, and the deprecation warning is gone from test output.
- [x] `vite-tsconfig-paths` removed after verification. — Uninstalled from `package.json`/lockfile after confirming the native resolution works.
- [x] ESLint passes without new unjustified inline suppressions. — `eslint .` clean; the only remaining `eslint-disable` comments in touched files are the pre-existing, specifically-justified static-image-exception ones (§8), not new/unjustified ones.
- [x] TypeScript passes. — `tsc --noEmit` clean throughout and at the end of this pass.
- [x] Unit tests pass. — 79/79 (32 pre-existing + 47 new, across this pass's and the re-verification pass's added/updated test files).
- [x] Production build passes in an approved environment. — `rm -rf .next && npm run build` clean, run repeatedly through this pass (macOS/Node 24).
- [ ] Default Playwright browser suite passes. — Not run this pass (see §1).
- [x] No temporary TODO/FIXME/debug code remains in touched files. — Confirmed via review of every file this pass touched.
- [x] Environment variables remain documented and Zod-validated. — `NEXT_PUBLIC_ENABLE_MOCK_AUTH` added to both `src/config/env.ts`'s Zod schema and `.env.example` with an explanatory comment.

## 13. Backend Security Coordination

`BLOCKED — backend owner, entirely out of scope for this frontend-only pass.` Every item in this
section requires backend code review/evidence this pass had no access to or mandate to change:

- [ ] Authorization verified on every server mutation.
- [ ] Server validates every mutation payload.
- [ ] Server does not trust frontend role/permission guards.
- [ ] Public and authentication endpoints are rate-limited.
- [ ] CSRF enforcement verified for cookie-authenticated mutations.
- [ ] Raw backend errors are not returned to the browser.
- [ ] Sensitive request/response data is not logged.
- [ ] Audit integrity requirements verified.
- [ ] Backend owner signs off the OTP implementation.
- [ ] Backend evidence is attached to release documentation.

## 14. Final Workflow Regression

Automated coverage (this pass): login, signup, session (`me`), change-password, logout, and
OTP request/verify are all covered by `auth.service.test.ts`'s 19 tests against a mocked
transport. Downloads (reports/public-survey/audit) are covered by their respective new test
files. The stale-response race on the priority-dashboard detail page is covered by
`load-insights.test.ts`. A full production build (`next build`) succeeded, meaning every route
in the app compiles and prerenders/generates without error.

**Not performed this pass** (all require a live backend + browser session, which this pass did
not have): every item below needs a real click-through pass before release.

- [ ] Login works. — Automated (mocked) coverage only; not clicked through in a real browser against a real backend this pass.
- [ ] OTP request and verification work. — Same; also see §2's honest note that the real backend endpoint doesn't exist yet regardless.
- [ ] Logout works without deleting unrelated storage. — Automated coverage in `client-storage.test.ts`; not manually verified in a real browser session.
- [ ] Forgot/reset-password works.
- [ ] Session restoration works.
- [ ] Mandatory password-change workflow works.
- [ ] Consent workflow works.
- [ ] Research officer navigation and actions work.
- [ ] Reviewer navigation and actions work.
- [ ] Supervisor navigation and actions work.
- [ ] Collective dashboard works.
- [ ] Study create/edit/delete workflows work.
- [ ] Need create/edit/classification workflows work.
- [ ] Survey-builder workflow works.
- [ ] Citizen/public-survey workflow works.
- [ ] Response and insight pages work. — Automated race-condition coverage only (`load-insights.test.ts`); full manual click-through not performed.
- [ ] Priority dashboard works.
- [ ] Report generation/viewing works.
- [ ] Report download works. — Automated coverage only (`reports.service.test.ts`); a real PDF/Excel file was not manually downloaded and opened this pass.
- [ ] Public-survey export works. — Same, automated coverage only.
- [ ] Audit export works. — Same, automated coverage only.
- [ ] Sharing workflows work.
- [ ] User/role/organization settings work.
- [ ] Methodology configuration works.
- [ ] Archive workflow works.
- [ ] Theme switching works.
- [ ] Locale-prefixed and default-locale routes work. — `next build`'s route table confirms every locale route compiles; not manually clicked through.
- [ ] Desktop Chrome/Edge smoke test passes.
- [ ] Desktop Firefox smoke test passes.
- [ ] Desktop Safari/WebKit smoke test passes.
- [ ] Mobile Chrome smoke test passes.
- [ ] Mobile Safari smoke test passes.

## Sign-Off

- [ ] Every checklist item is complete, explicitly blocked with an owner, or N/A with evidence. — **Not yet** — §9, §10, §11, and most of §14 remain genuinely unaddressed (see each section's note); this pass covered §1–§8 and §12 in full, plus honest partial/blocked status everywhere else.
- [x] No critical or high-severity finding remains open **on the frontend side**. — The one critical finding (hardcoded OTP reachable in production) is fixed. The backend-dependent portions of that same finding (§2's `BLOCKED` items) remain open pending backend work — this is a real, named gap, not a false all-clear.
- [ ] Backend security owner approved backend-dependent controls. — Not sought this pass (frontend-only pass, no backend owner engaged).
- [ ] Accessibility reviewer approved manual checks. — Not sought this pass; §9–§11 weren't attempted.
- [ ] Product owner confirmed existing workflows and behavior remain intact. — Not sought this pass; recommend a manual click-through against §14 before this is claimed.
- [x] Engineering reviewer confirmed all automated gates pass. — `lint`, `typecheck`, `test` (79/79), and `build` all clean as of the end of the re-verification pass — re-verify this stays true after any further change.
- [ ] Release owner approved deployment. — Not sought this pass.
