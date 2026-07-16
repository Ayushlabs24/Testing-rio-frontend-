/**
 * Domain / Sub-Domain reference — mirrors "new scope.md" §4 (Domain / Sub-Domain
 * / Indicator / KPI Reference), methodology version v1.0. This is the closed
 * vocabulary a Human Reviewer picks from when overriding an AI Classification
 * suggestion — not a master-data table yet, just a static reference list, per
 * the same "don't promote to master data without an explicit ticket" call
 * made for Need.village/Study.villages.
 *
 * A reviewer can still type a value that isn't in this list (a genuine edge
 * case the methodology doesn't cover yet) — this list only powers the
 * dropdown's suggestions, it doesn't restrict what can be submitted.
 */
export const DOMAIN_SUBDOMAINS: Record<string, string[]> = {
  Health: [
    "Access to Basic Healthcare",
    "Maternal & Child Health",
    "Disease Burden",
    "Mental Health",
    "Service Quality",
    "Emergency Preparedness",
  ],
  Education: [
    "Access to Basic Education",
    "Education Equity",
    "Education Quality",
    "School Infrastructure",
    "Vocational & Adult Education",
  ],
  "Water & Sanitation": [
    "Drinking Water Access",
    "Water Quality",
    "Sanitation Access",
    "Hygiene & Waste Management",
  ],
  "Energy & Environment": [
    "Electricity Access",
    "Clean Cooking",
    "Environmental Quality",
    "Environmental Awareness",
  ],
  Livelihood: [
    "Employment & Income",
    "Agriculture & Primary Production",
    "Entrepreneurship",
    "Vocational Skills & Capacity",
    "Women's Economic Empowerment",
  ],
  Infrastructure: [
    "Roads & Transport",
    "Communications & Digital Connectivity",
    "Housing & Built Environment",
    "Public & Community Facilities",
  ],
  "Social Development": [
    "Social Safety",
    "Vulnerable Groups",
    "Child & Youth Protection",
    "Social Cohesion",
  ],
  Culture: [
    "Cultural Heritage",
    "Cultural Programs & Participation",
    "Community Identity",
  ],
  "Governance & Services": [
    "Access to Government Services",
    "Digital Government",
    "Community Participation",
    "Accountability & Institutional Trust",
  ],
};

export const DOMAINS = Object.keys(DOMAIN_SUBDOMAINS);

/** Every sub-domain across every domain, flattened — used before a reviewer
 * has picked any domain yet, so the sub-domain dropdown isn't empty. */
export const ALL_SUBDOMAINS = Array.from(
  new Set(Object.values(DOMAIN_SUBDOMAINS).flat()),
);

/** Sub-domains for the currently-selected domain(s), falling back to every
 * sub-domain when nothing is selected yet. */
export function subDomainsFor(domains: string[]): string[] {
  if (domains.length === 0) return ALL_SUBDOMAINS;
  const set = new Set<string>();
  for (const domain of domains) {
    for (const sub of DOMAIN_SUBDOMAINS[domain] ?? []) set.add(sub);
  }
  return Array.from(set);
}
