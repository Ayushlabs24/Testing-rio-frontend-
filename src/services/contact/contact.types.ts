/** An org as offered by the public contact picker. The backend deliberately
 *  exposes only id and name here — this is the one unauthenticated read of org
 *  data (see contact.service.ts on the backend). */
export interface OrganizationOption {
  id: string;
  name: string;
}

export interface ContactPayload {
  organizationId: string;
  name: string;
  email: string;
  /** The enquirer's village or region — not the org's. */
  region: string;
  purpose: string;
}

export interface ContactSubmissionResult {
  delivered: boolean;
  recipientCount: number;
}
