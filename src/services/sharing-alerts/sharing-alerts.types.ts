export type SharingAlertType =
  "request_created" | "request_approved" | "request_rejected";
export type SharingAlertEntity = "study" | "report";

export interface SharingAlert {
  id: string;
  type: SharingAlertType;
  entity: SharingAlertEntity;
  requestId: string;
  title: string;
  orgName: string;
  reason: string | null;
  createdAt: string;
}
