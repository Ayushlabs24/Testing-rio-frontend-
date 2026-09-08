/**
 * A Study is a pure container — no status/domain/subDomain of its own. Each
 * Need under it runs its own independent lifecycle (see needs.types.ts's
 * NeedStatus) — a Study stays open for new Needs regardless of how far
 * along its existing ones are.
 *
 * `villages` is the set the study concerns, chosen at create. A Need carries
 * its own `village` list (see `needs.types.ts`) which starts from the Study's
 * but can then diverge — the Study's is the wider scope, the Need's is what
 * that specific need is actually about.
 */
export interface Study {
  id: string;
  // RIO-RBAC-002 (client-confirmed, 2026-08-27 round) — System Admin is
  // platform-wide; acting on an already-existing Study (e.g. adding a Need)
  // needs to know which org to send as X-Act-As-Org. Always present.
  orgId: string;
  title: string;
  villages: string[];
  // Mandatory multi-select subsets of the owning Organization's own
  // selected Governorates/Centers. No Region field here — it's derived live
  // from the owning Organization's own single region.
  governorateIds: string[];
  centerIds: string[];
  // Optional link to the real, status-gated MethodologyVersion master data
  // — must be PUBLISHED when set, settable at creation or later.
  methodologyVersionId: string | null;
  // RIO-FR-024: entered once at creation ("What is the population of your
  // area?"); requiredSampleSize/minimumDetectableEffect are computed and
  // stored at that same moment — never recomputed, so these three never
  // change after creation. Null for studies created before this feature
  // shipped.
  population: number | null;
  marginOfError: number | null;
  requiredSampleSize: number | null;
  minimumDetectableEffect: number | null;
  // Sequential per-org counter (1, 2, 3... across every Study the org has
  // ever created) — server-assigned at creation, never client-writable.
  // RIO-DATA-002 imports count backwards from 0 instead, so they sort
  // before cycle 1 rather than taking a live cycle's number.
  cycleNumber: number;
  // RIO-DATA-002 — true when this Study is a pre-platform study imported
  // from the Archive (RIO-FR-013) rather than a cycle run on the platform.
  isHistorical: boolean;
  // ISO date (YYYY-MM-DD) the original study was conducted. `createdAt` is
  // only the import date, so comparing an old study against a current one
  // has to read this. Null for anything that is not a historical import.
  historicalStudyDate: string | null;
  historicalStudyId: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // RIO-FR-012 (Q3/Q4/Q35) — configurable-list values, see CreateStudyPayload.
  studyType: string | null;
  targetSector: string | null;
  // Populated by the list endpoint for a cross-org reader (System Admin,
  // System Reviewer, Center Supervisor) who now sees every org's studies —
  // undefined for a same-org caller, which already knows its own org.
  orgName?: string;
}

/** `GET /studies/{id}` only — the list endpoint doesn't compute this per row. */
export interface StudyDetail extends Study {
  evidenceCount: number;
  needCount: number;
}

export type StudySummary = Study;

export interface CreateStudyPayload {
  title: string;
  villages?: string[];
  governorateIds: string[];
  centerIds: string[];
  // Mandatory: a Study must bind to a specific (published) methodology
  // version at creation.
  methodologyVersionId: string;
  population: number;
  marginOfError?: number;
  // RIO-FR-012 (Q3/Q4/Q35) — validated server-side against the active
  // StudyTypeOption/TargetSectorOption names, not free text.
  studyType?: string;
  targetSector?: string;
}

export interface UpdateStudyPayload {
  title?: string;
  villages?: string[];
  governorateIds?: string[];
  centerIds?: string[];
  // Optional to omit on a PATCH (leaves the existing binding untouched),
  // but never nullable — once set at creation, a Study can no longer be
  // left without a methodology version.
  methodologyVersionId?: string;
  studyType?: string;
  targetSector?: string;
}

export interface ListStudiesParams {
  limit?: number;
  offset?: number;
  search?: string;
  // Cross-org readers only — filters to one organization's studies.
  organizationId?: string;
}

/** Dashboard counters. Still mock-backed — no stats endpoint exists yet. */
export interface PlatformStudyStats {
  activeStudies: number;
  pendingReviews: number;
  reportsGenerated: number;
}
