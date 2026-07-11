export type StudyStatus = "draft" | "active" | "completed";
export type ReviewStatus = "none" | "pending" | "approved";

export interface MockStudy {
  id: string;
  organizationId: string;
  name: string;
  status: StudyStatus;
  reviewStatus: ReviewStatus;
  reportGenerated: boolean;
}

/**
 * There's no Study/Survey feature built yet (see `studySurvey` in
 * permissions.ts — a module with no page behind it so far). This seed
 * exists only so the System Admin dashboard's "Active studies / Pending
 * reviews / Reports generated" stats reflect real, if minimal, mock
 * records rather than fabricated numbers. Replace once studies are a real
 * feature.
 */
export const studies: MockStudy[] = [
  {
    id: "study_1",
    organizationId: "org_demo",
    name: "2026 Yorkshire Livelihoods Assessment",
    status: "active",
    reviewStatus: "pending",
    reportGenerated: false,
  },
  {
    id: "study_2",
    organizationId: "org_demo",
    name: "Winter Water Access Follow-up",
    status: "completed",
    reviewStatus: "approved",
    reportGenerated: true,
  },
  {
    id: "study_3",
    organizationId: "org_demo",
    name: "Chipping Norton Education Baseline",
    status: "draft",
    reviewStatus: "none",
    reportGenerated: false,
  },
  {
    id: "study_4",
    organizationId: "org_second",
    name: "Wayanad Water Scarcity Study",
    status: "active",
    reviewStatus: "pending",
    reportGenerated: false,
  },
  {
    id: "study_5",
    organizationId: "org_second",
    name: "Kalpetta Health Access Review",
    status: "active",
    reviewStatus: "approved",
    reportGenerated: true,
  },
];
