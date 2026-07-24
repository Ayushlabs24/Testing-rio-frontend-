/** KSA Geographic Reference — Region -> Governorate -> Center, seeded from
 * the official administrative hierarchy (see the backend's
 * prisma/import-geography.ts). Read-only reference data. */
export interface Region {
  id: string;
  code: number;
  name: string;
  isoCode: string;
  capital: string;
}

export interface Governorate {
  id: string;
  code: string;
  regionId: string;
  name: string;
  category: string;
}

export interface Center {
  id: string;
  code: string;
  governorateId: string;
  name: string;
  category: string;
}
