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

/**
 * Narrow an arbitrary backend `sector` value to the frontend's known set.
 * The API models sector as a free `string | null`, so a value the UI has no
 * label for (outside SECTORS) is treated as "not set" — this keeps unknown
 * values from ever reaching `tSectors(...)`, which would throw on a missing
 * translation key.
 */
export function toSector(value: string | null | undefined): Sector | null {
  return value && (SECTORS as readonly string[]).includes(value)
    ? (value as Sector)
    : null;
}
