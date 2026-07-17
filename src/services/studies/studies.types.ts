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
  title: string;
  villages: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /studies/{id}` only — the list endpoint doesn't compute this per row. */
export interface StudyDetail extends Study {
  evidenceCount: number;
  needCount: number;
}

/**
 * There is no cross-entity studies listing on the backend (unlike
 * Organizations/Users) — `GET /studies` always scopes to the caller's own
 * org via ambient org context, even for a cross-entity role. So list rows
 * are just `Study`, no `organizationName` column to show.
 */
export type StudySummary = Study;

export interface CreateStudyPayload {
  title: string;
  villages?: string[];
}

export interface UpdateStudyPayload {
  title?: string;
  villages?: string[];
}

export interface ListStudiesParams {
  limit?: number;
  offset?: number;
  search?: string;
}

/** Dashboard counters. Still mock-backed — no stats endpoint exists yet. */
export interface PlatformStudyStats {
  activeStudies: number;
  pendingReviews: number;
  reportsGenerated: number;
}
