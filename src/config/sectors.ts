/**
 * Fixed set of nonprofit sectors an organization can operate in. Single
 * source of truth for the sector dropdown — add/remove an entry here (and
 * its label in messages/en.json under app.settings.organization.sectors)
 * to change what's selectable everywhere in the app.
 */
export const SECTORS = [
  "education",
  "healthcare",
  "agriculture",
  "wash",
  "livelihoods",
  "disaster_relief",
  "other",
] as const;

export type Sector = (typeof SECTORS)[number];
