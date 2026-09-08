import type { PermissionModule } from "@/types/permissions";

/**
 * Universal, single source of truth for the audit-log vocabulary. Every
 * audit event references an action and an entity type from these lists —
 * never a free-form string — so the log stays consistent everywhere in the
 * app. This mirrors how `config/sectors.ts` and `types/permissions.ts`
 * centralise their fixed vocabularies.
 *
 * Maps to the `audit_logs` table (see the ER diagram): frontend `action` →
 * `audit_logs.action`, `entityType` → `entity_type`, `entityId` →
 * `entity_id`. The DB stores those columns as free VARCHAR; keeping the set
 * closed here is a deliberate app-side guardrail. Add an entry here (and its
 * label in messages/en.json under app.settings.audit.actions / .entities) to
 * make a new kind of event auditable across the whole app.
 */

/**
 * The key lifecycle events tracked in the audit log. `create/edit/approve/
 * share` are the governed actions called out in scope.md (approve ↔ the
 * `approvals` table, share ↔ the `sharing_requests` flow); `delete` is
 * included so destructive removals are never silently lost. `login`/
 * `logout` are recorded server-side on every authentication event (see
 * the backend's AuthService.login()/logout()). `consent` is RIO-FR-Add-02's
 * data-sharing consent acceptance — its own event, not folded into `edit`,
 * so it's independently auditable/reportable.
 */
export const AUDIT_ACTIONS = [
  "create",
  "edit",
  "approve",
  "share",
  "delete",
  "login",
  "logout",
  "consent",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/**
 * The kinds of records an audit event can be about — one per governed entity
 * in the schema. `study` carries the community need statement (scope.md's
 * needs → survey → evidence → report loop); `evidence` covers uploaded
 * documents and their extracted key points; `sharing_request` backs the
 * cross-organisation share flow.
 */
export const AUDIT_ENTITY_TYPES = [
  "organization",
  "user",
  "study",
  "need",
  "ai_decision",
  "survey",
  "survey_response",
  "evidence",
  "report",
  "sharing_request",
  // Client-confirmed (2026-08-27) — the versioned Terms of Use / Data Sharing
  // Policy content itself, drafted and published from Methodology
  // Configuration. Distinct from `consent` the action, which is a user
  // accepting one of these versions.
  "consent_policy",
  // The remaining six were emitted by the backend (grep `entityType: '` in
  // Project-RIO-Backend/src/modules) but missing from this union entirely —
  // found during the 2026-09-08 bilingual audit while classifying which
  // `entityLabel` values are safe to auto-translate. Harmless at runtime
  // (this type only describes the shape, it isn't validated against it), but
  // worth keeping complete so this list is the actual source of truth again.
  "initiative",
  "need_decision",
  "priority_score",
  "question",
  "ncnp_report",
  "backup_run",
] as const;

export type AuditEntityType = (typeof AUDIT_ENTITY_TYPES)[number];

/**
 * Which permission module governs each entity type. Keeps audit entries
 * aligned with the RBAC matrix in `mocks/data/roles.ts` — the single place
 * that decides who may act on (and therefore appear in the log for) an entity.
 */
export const AUDIT_ENTITY_MODULE: Record<AuditEntityType, PermissionModule> = {
  organization: "entityTeam",
  user: "entityTeam",
  study: "studySurvey",
  need: "dataCollection",
  ai_decision: "aiReview",
  survey: "studySurvey",
  survey_response: "studySurvey",
  evidence: "dataCollection",
  report: "reportsDashboards",
  sharing_request: "archiveSharingAudit",
  consent_policy: "onboardingConsent",
  initiative: "initiatives",
  need_decision: "priorityScoring",
  priority_score: "priorityScoring",
  question: "surveyBuilder",
  ncnp_report: "ncnpReport",
  backup_run: "backups",
};

/**
 * Whether an audit event's `entityLabel` is safe to run through
 * `<AutoTranslate>` (2026-09-08 bilingual audit). `entityLabel` is NOT
 * uniformly one kind of thing — inspected every call site that sets it in
 * Project-RIO-Backend/src/modules and found it's a genuine mix:
 *  - a proper identifier for some entity types (a user's email, an
 *    uploaded file's filename, a Need's own UUID for `priority_score`) —
 *    must NEVER be translated, same policy as everywhere else in the app.
 *    An organization's registered name used to be grouped here too, but
 *    NOT any more — client reversal 2026-09-08: org names get translated,
 *    same as person names (see use-auto-translate.ts's doc comment);
 *  - real user-typed content (a Study/Need/Report/Initiative/Question title)
 *    or a server-composed English sentence that embeds one (e.g. sharing.
 *    service.ts's `Sharing request for study "${title}" ...`, need-decisions.
 *    service.ts's `${decisionType} — ${needTitle}`, ncnp-report-review.
 *    service.ts's `NCNP Compiled Report approved`) for the rest — these
 *    read in English regardless of UI locale today, and translating the
 *    whole label (title and surrounding phrase together) reads correctly in
 *    Arabic since it's one sentence, not two things concatenated on screen.
 */
export function isEntityLabelTranslatable(entityType: AuditEntityType): boolean {
  const NEVER_TRANSLATE: ReadonlySet<AuditEntityType> = new Set([
    // "organization" REMOVED — client reversal 2026-09-08: org names must be
    // translated too, same as everywhere else in the app (see
    // use-auto-translate.ts's own doc comment for the full history).
    "user",
    "evidence",
    "priority_score",
  ]);
  return !NEVER_TRANSLATE.has(entityType);
}
